/**
 * `src/styles.css` のトークンからコントラスト比を出す。
 *
 * 対の一覧を持たない。呼ぶときに渡す。一覧を持つと、列挙漏れと、一覧が実際の描画と
 * 食い違う乖離の 2 つを抱えることになり、どちらも検出する手段が無い (ADR-0028)。
 *
 * ここは検査ではない。合否は `src/components/contrast.stories.tsx` の axe が持つ。
 *
 * 引数と出力の組み立ては `scripts/lib/contrast-cli.ts` にある。この層は I/O だけを持つ
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { formatReport, parseContrastArgs } from "../lib/contrast-cli.ts";
import { measurePair, parseTokenTable } from "../lib/contrast.ts";
import { REPO_ROOT } from "../lib/repo-root.ts";

const USAGE = `使い方:
  mise run contrast -- --theme <light|dark> --bg <トークン> [--bg <トークン>...] --fg <トークン>

  トークンは --background の形。不透明度は --input/30 のように百分率で付ける。
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
  const css = readFileSync(join(REPO_ROOT, "src", "styles.css"), "utf8");
  const measured = measurePair({
    table: parseTokenTable(css)[args.theme],
    backdrop: args.backdrop,
    foreground: args.foreground,
  });
  process.stdout.write(formatReport(args, measured));
}

try {
  main();
} catch (error) {
  // 利用者へ出すのは原因の連鎖だけにする。スタックの内部フレームは読ませる情報ではない。
  // `measurePair` と `layerOf` は `cause` に元の例外を入れるので、辿って全部出す
  process.stderr.write(`[contrast] ${describeError(error)}\n`);
  process.exit(1);
}

/** `cause` を辿って原因の連鎖を 1 行にする。循環する `cause` で止まらなくならないよう深さを切る */
function describeError(error: unknown): string {
  const messages: string[] = [];
  let current = error;
  // 10 段もあれば原因は読み取れる。超えたら連鎖が壊れているので打ち切る
  while (current instanceof Error && messages.length < 10) {
    messages.push(current.message);
    const next: unknown = current.cause;
    current = next;
  }
  return messages.length > 0 ? messages.join(" ← ") : String(error);
}
