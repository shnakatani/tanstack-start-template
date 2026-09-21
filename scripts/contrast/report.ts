import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  measurePair,
  parseLayerSpec,
  parseTokenTable,
  toHex,
  type LayerSpec,
  type Theme,
} from "../lib/contrast.ts";
import { REPO_ROOT } from "../lib/repo-root.ts";

/**
 * `src/styles.css` のトークンからコントラスト比を出す。
 *
 * 対の一覧を持たない。呼ぶときに渡す。一覧を持つと、列挙漏れと、一覧が実際の描画と
 * 食い違う乖離の 2 つを抱えることになり、どちらも検出する手段が無い (ADR-0028)。
 *
 * ここは検査ではない。合否は `src/components/contrast.stories.tsx` の axe が持つ。
 */

const USAGE = `使い方:
  mise run contrast -- --theme <light|dark> --bg <トークン> [--bg <トークン>...] --fg <トークン>

  トークンは --background の形。不透明度は --input/30 のように百分率で付ける。
  --bg は下から順に重ねる。

例:
  mise run contrast -- --theme dark --bg '--popover' --bg '--input/30' --fg '--placeholder'
`;

function parseArgs(argv: readonly string[]): {
  theme: Theme;
  backdrop: LayerSpec[];
  foreground: LayerSpec;
} {
  let theme: Theme | undefined;
  let foreground: LayerSpec | undefined;
  const backdrop: LayerSpec[] = [];
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (value === undefined) {
      throw new Error(`${flag ?? ""} に値がない`);
    }
    if (flag === "--theme") {
      if (value !== "light" && value !== "dark") {
        throw new Error(`--theme は light か dark: ${value}`);
      }
      theme = value;
    } else if (flag === "--bg") {
      backdrop.push(parseLayerSpec(value));
    } else if (flag === "--fg") {
      foreground = parseLayerSpec(value);
    } else {
      throw new Error(`知らない引数: ${flag ?? ""}`);
    }
  }
  if (theme === undefined || foreground === undefined || backdrop.length === 0) {
    throw new Error("--theme と --bg と --fg は必須");
  }
  return { theme, backdrop, foreground };
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    process.stdout.write(USAGE);
    return;
  }
  const { theme, backdrop, foreground } = parseArgs(argv);
  const css = readFileSync(join(REPO_ROOT, "src", "styles.css"), "utf8");
  const measured = measurePair({
    table: parseTokenTable(css)[theme],
    backdrop,
    foreground,
  });
  const lines = [
    `テーマ  ${theme}`,
    `背景    ${backdrop.map(describe).join(" + ")}  →  ${toHex(measured.backdrop)}`,
    `前景    ${describe(foreground)}  →  ${toHex(measured.foreground)}`,
    `比      ${measured.ratio.toFixed(2)}`,
    `        SC 1.4.3 (4.5:1)  ${measured.ratio >= 4.5 ? "満たす" : "割る"}`,
    `        SC 1.4.11 (3:1)   ${measured.ratio >= 3 ? "満たす" : "割る"}`,
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

function describe(spec: LayerSpec): string {
  // 丸めない。`--input/30.5` は受理される綴りなので、丸めると入力と違う行が出る
  return spec.alpha === 1 ? spec.token : `${spec.token}/${spec.alpha * 100}`;
}

main();
