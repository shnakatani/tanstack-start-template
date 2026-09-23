/**
 * `src/styles.css` のトークンからコントラスト比を出す。
 *
 * 対の一覧を持たない。呼ぶときに渡す。一覧を持つと、列挙漏れと、一覧が実際の描画と
 * 食い違う乖離の 2 つを抱えることになり、どちらも検出する手段が無い (ADR-0036)。
 *
 * ここは検査ではない。合否は `src/components/contrast.stories.tsx` の axe が持つ。
 *
 * 引数と出力の組み立ては `scripts/contrast/lib/contrast-cli.ts` にある。この層が持つのは
 * 入出力 (argv / `styles.css` / stdout / stderr / 終了コード) と、純粋層どうしの配線だけである
 */

import { readFileSync } from "node:fs";

import { formatReport, parseContrastArgs } from "./lib/contrast-cli.ts";
import { measurePair, parseTokenTable } from "./lib/contrast.ts";
import { describeError } from "./lib/describe-error.ts";
import { STYLES_CSS } from "./lib/styles-css.ts";

const USAGE = `使い方:
  mise run contrast -- --theme <light|dark> --bg <トークン> [--bg <トークン>...] --fg <トークン>

  トークンは src/styles.css の :root / .dark が宣言している --background の形。
  不透明度は --input/30 のように百分率で付ける。
  --bg は下から順に重ねる。--theme と --fg は 1 つだけ。

例:
  mise run contrast -- --theme dark --bg '--popover' --bg '--input/30' --fg '--placeholder'
`;

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    process.stdout.write(USAGE);
    return;
  }
  const args = parseContrastArgs(argv);
  const css = readFileSync(STYLES_CSS, "utf8");
  const measured = measurePair({
    table: parseTokenTable(css)[args.theme],
    backdrop: args.backdrop.map((layer) => layer.spec),
    foreground: args.foreground.spec,
  });
  process.stdout.write(formatReport(args, measured));
}

try {
  main();
} catch (error) {
  // `process.exit` は使わない。stderr が pipe のとき書き込みは非同期で、exit が待たずに
  // 落とすと原因の連鎖が切れる。終了コードだけ立てて自然に終わらせる
  process.exitCode = 1;
  process.stderr.write(`[contrast] ${describeError(error)}\n`);
}
