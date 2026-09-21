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

export type ContrastArgs = {
  readonly theme: Theme;
  readonly backdrop: readonly LayerSpec[];
  readonly foreground: LayerSpec;
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
  let foreground: LayerSpec | undefined;
  const backdrop: LayerSpec[] = [];
  let index = 0;
  while (index < argv.length) {
    const flag = argv[index];
    // フラグ以外が来たら、値の欠落ではなく「知らない引数」として落とす。位置で数えると
    // 余分な引数が偶数位置に落ちたときだけ「値がない」と誤誘導する
    if (flag === undefined || !flag.startsWith("--")) {
      throw new Error(`知らない引数: ${flag ?? "(空)"}`);
    }
    // 値を取る前に知っているフラグかを見る。逆にすると、未知のフラグが末尾へ来たときに
    // 「値がない」と出て、存在しないフラグへ値を足せと誘導する
    if (flag !== "--theme" && flag !== "--bg" && flag !== "--fg") {
      throw new Error(`知らない引数: ${flag}`);
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
      backdrop.push(parseLayerSpec(value));
    } else {
      if (foreground !== undefined) {
        throw new Error("--fg は 1 つだけ書く");
      }
      foreground = parseLayerSpec(value);
    }
    index += 2;
  }
  if (theme === undefined || foreground === undefined || backdrop.length === 0) {
    throw new Error("--theme と --bg と --fg は必須");
  }
  return { theme, backdrop, foreground };
}

/**
 * 面 1 枚を引数の綴りへ戻す。
 *
 * 丸めない (`--input/30.5` は受理される綴り) が、`alpha * 100` の逆算は桁を落とす。
 * `--input/57` が `--input/56.99999999999999` になり、ADR へ写す値が変わって見える。
 * `toPrecision(12)` を挟むと整数 0..100 と 0.1 刻みのどちらも往復する (2026-09-22 実測)
 */
export function describeLayer(spec: LayerSpec): string {
  return spec.alpha === 1
    ? spec.token
    : `${spec.token}/${Number((spec.alpha * 100).toPrecision(12))}`;
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
    `背景    ${args.backdrop.map(describeLayer).join(" + ")}  →  ${toHex(measured.backdrop)} (畳んだ後)`,
    `前景    ${describeLayer(args.foreground)}  →  ${toHex(measured.foreground)} (画面に出る色)`,
    `比      ${measured.ratio.toFixed(2)}`,
    `        SC 1.4.3 (4.5:1)  ${measured.ratio >= 4.5 ? "満たす" : "割る"}`,
    `        SC 1.4.11 (3:1)   ${measured.ratio >= 3 ? "満たす" : "割る"}`,
    "",
  ].join("\n");
}
