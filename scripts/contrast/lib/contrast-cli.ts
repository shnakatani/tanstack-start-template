import {
  parseLayerSpec,
  toHex,
  type LayerSpec,
  type MeasuredPair,
  type Theme,
} from "./contrast.ts";

/**
 * `mise run contrast` の引数と出力の組み立て。
 *
 * 実行口 (`scripts/contrast/report.ts`) から分けているのは、`process.argv` も CSS も
 * 要らない純粋関数だからである。ここに置くと境界条件を単体テストで固定できる
 * (`scripts-tools` project)
 */

/**
 * 引数の綴りと、それを読んだ結果。
 *
 * 綴りを捨てずに持つ。`alpha` から逆算すると `alpha * 100` が桁を落とし、
 * `--input/0.0000001` が `--input/1e-7` という再パースできない綴りになる (2026-09-22 実測)。
 * 測定は綴りを読まないので、測定層の `LayerSpec` ではなくこちらが持つ
 */
export type SourcedLayer = {
  readonly spec: LayerSpec;
  readonly source: string;
};

export type ContrastArgs = {
  readonly theme: Theme;
  readonly backdrop: readonly SourcedLayer[];
  readonly foreground: SourcedLayer;
};

/**
 * `--theme` / `--bg` / `--fg` を読む。
 *
 * `--bg` だけが複数回を許す (下から順に重ねる)。`--theme` と `--fg` の重複は throw する。
 * 黙って後勝ちにすると、`--theme` を 2 回打った人が light を測ったつもりで dark の値を
 * 書き写す。この実行口の産物は ADR へ写す数値なので、取り違えが文書へ残る
 */
export function parseContrastArgs(argv: readonly string[]): ContrastArgs {
  let theme: Theme | undefined;
  let foreground: SourcedLayer | undefined;
  const backdrop: SourcedLayer[] = [];
  // フラグと値で 2 つずつ進む。増分をヘッダへ置くと、本体を足したときに書き忘れようがない
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    // 値を取る前に知っているフラグかを見る。逆にすると、未知のフラグが末尾へ来たときに
    // 「値がない」と出て、存在しないフラグへ値を足せと誘導する
    if (flag !== "--theme" && flag !== "--bg" && flag !== "--fg") {
      throw new Error(`知らない引数: ${flag ?? "(空)"}`);
    }
    const value = argv[index + 1];
    if (value === undefined) {
      throw new Error(`${flag} に値がない`);
    }
    if (flag === "--theme") {
      if (theme !== undefined) {
        throw new Error("--theme は 1 つだけ書く");
      }
      if (value !== "light" && value !== "dark") {
        throw new Error(`--theme は light か dark: ${value}`);
      }
      theme = value;
    } else if (flag === "--bg") {
      backdrop.push({ spec: parseLayerSpec(value), source: value });
    } else {
      if (foreground !== undefined) {
        throw new Error("--fg は 1 つだけ書く");
      }
      foreground = { spec: parseLayerSpec(value), source: value };
    }
  }
  if (theme === undefined || foreground === undefined || backdrop.length === 0) {
    throw new Error("--theme と --bg と --fg は必須");
  }
  return { theme, backdrop, foreground };
}

/**
 * 出力の行を組み立てる。
 *
 * 前景の色には「画面に出る色」と添える。`--border` のようにトークン自身が alpha を
 * 宣言している場合、綴りに手がかりが残らないまま合成後の色が出る。背景の矢印は
 * 畳んだ後の色、前景の矢印は下地へ載せた後の色で、同じ記号が違うものを指す
 */
export function formatReport(args: ContrastArgs, measured: MeasuredPair): string {
  return [
    `テーマ  ${args.theme}`,
    `背景    ${args.backdrop.map((layer) => layer.source).join(" + ")}  →  ${toHex(measured.backdrop)} (畳んだ後)`,
    `前景    ${args.foreground.source}  →  ${toHex(measured.foreground)} (画面に出る色)`,
    `比      ${measured.ratio.toFixed(2)}`,
    `        SC 1.4.3 (4.5:1)  ${measured.ratio >= 4.5 ? "満たす" : "割る"}`,
    `        SC 1.4.11 (3:1)   ${measured.ratio >= 3 ? "満たす" : "割る"}`,
    "",
  ].join("\n");
}
