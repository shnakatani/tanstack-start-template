import { execFileSync, spawnSync } from "node:child_process";
import { relative, resolve } from "node:path";

import { beforeAll, describe, expect, it } from "vite-plus/test";

import viteConfig from "../../../vite.config";
import { REPO_ROOT } from "../../lib/repo-root";

/**
 * lint の設定が「書いてあるだけ」ではなく解決後も生き残っていることを機械強制する。
 * 有効でないプラグインのルール設定は無診断で捨てられる (oxc-project/oxc#25579、ADR-0003)。
 *
 * 突き合わせの相手は `--print-config` の解決後設定にする。ルールが実際に発火することや、
 * categories の格上げで severity が上がることは oxlint 自身の責務なので踏まない。
 * fixture を置くのは、解決後設定に現れない 1 件だけ。
 */

const VP = resolve(REPO_ROOT, "node_modules", ".bin", "vp");

/** 有効にするプラグイン。`vite.config.ts` の `OXLINT_DEFAULT_PLUGINS` + 追加分と対で持つ */
const EXPECTED_PLUGINS = [
  "typescript",
  "unicorn",
  "oxc",
  "react",
  "import",
  "promise",
  "jsdoc",
  "vitest",
  "jsx-a11y",
];

/** jsPlugin の宣言。診断コードの接頭辞になるのは meta.name で、specifier からは導けない */
const EXPECTED_JS_PLUGINS = [
  { name: "better-tailwindcss", specifier: "eslint-plugin-better-tailwindcss" },
];

/** 緩和の範囲。広げると本体コードでも no-unsafe-* が無効になる */
const EXPECTED_OVERRIDE_FILES = ["**/*.test.ts", "**/*.test.tsx", "src/test/**"];

/** 緩和するルール。増やすとテストコードの型検査がその分だけ緩む */
const EXPECTED_OVERRIDE_RULES = [
  "typescript/no-non-null-assertion",
  "typescript/no-unsafe-assignment",
  "typescript/no-unsafe-call",
  "typescript/no-unsafe-member-access",
  "typescript/no-unsafe-return",
];

/** lint が見に行くべきソースの所在 */
const SOURCE_ROOTS = ["src", "scripts"];

/** 追跡されているのに lint されなくてよい唯一のソース。生成物 (ADR 対象外) */
const ALLOWED_INVISIBLE = ["src/routeTree.gen.ts"];

const JS_PLUGIN_FIXTURE = "scripts/checks/integrity/fixtures/lint-config/better-tailwindcss.tsx";

interface PrintedConfig {
  plugins: string[];
  jsPlugins: { name: string; specifier: string }[];
  categories: Record<string, string>;
  options: Record<string, boolean>;
  rules: Record<string, unknown>;
  overrides: { files: string[]; rules: Record<string, unknown> }[];
}

interface Diagnostic {
  message: string;
  severity: string;
  filename?: string;
}

/** spawn 自体の失敗を「検査が通った」と読み違えないよう例外で落とす */
function runVp(args: string[]) {
  const { error, status, stdout, stderr } = spawnSync(VP, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (error) throw error;
  return { status, stdout, output: `${stdout}\n${stderr}` };
}

/**
 * `vp` は対象ゼロや設定エラーのとき、平文を stdout へ書いたうえで JSON も出す。素の
 * `JSON.parse` へ渡すと先頭数文字だけの SyntaxError になり、原因が読めない
 */
function parseJsonOutput(result: { stdout: string; output: string }) {
  if (!result.stdout.trimStart().startsWith("{")) {
    throw new Error(`JSON 出力ではない\n${result.output}`);
  }
  return JSON.parse(result.stdout);
}

let printedConfig: PrintedConfig;

beforeAll(() => {
  const result = runVp(["lint", "--print-config"]);
  if (result.status !== 0) {
    throw new Error(`lint --print-config が失敗した\n${result.output}`);
  }
  printedConfig = parseJsonOutput(result);
}, 20_000);

describe("書いた設定が解決後も残っている", () => {
  it("plugins が既定集合を保っている", () => {
    // 既定集合の spread を落とすと typescript / unicorn / oxc が無効になり、rules に書いた
    // それらの設定が無診断で捨てられる (ADR-0003)。unicorn と jsx-a11y は名指しルールを
    // 持たないため、下の突き合わせでは脱落を拾えない。plugins の値でしか見えない
    expect(
      [...printedConfig.plugins].sort(),
      "plugins が変わった。OXLINT_DEFAULT_PLUGINS の spread を落としていないか (ADR-0003)",
    ).toEqual([...EXPECTED_PLUGINS].sort());
  });

  it("rules に書いたルールが解決後設定に残っている", () => {
    // 無効なプラグインのルールは、ルール名が検証されるにもかかわらず解決後設定から消える。
    // 消えること自体が信号になるので、書いた側との差で名指し単位の取りこぼしを検出する。
    // jsPlugin のルールは有効でも出力に現れないため対象から外す (oxc#22117、ADR-0004)
    const written = Object.keys(viteConfig.lint?.rules ?? {}).filter(
      (rule) => !rule.startsWith("better-tailwindcss/"),
    );
    if (written.length === 0) {
      throw new Error("vite.config.ts の lint.rules を読めていない");
    }
    const printed = new Set(Object.keys(printedConfig.rules));
    const missing = written.filter((rule) => {
      // extension rule は typescript/ で書いてもコアルールの名前へ解決される (ADR-0003)
      const core = rule.startsWith("typescript/") ? rule.slice("typescript/".length) : rule;
      return !printed.has(rule) && !printed.has(core);
    });
    expect(
      missing,
      "書いたルールが解決後設定から消えた。plugins から該当プラグインが落ちていないか (ADR-0003)",
    ).toEqual([]);
  });

  it("jsPlugins をプラグイン名込みで宣言している", () => {
    // specifier だけの文字列形だと、rules に書く `better-tailwindcss/*` の接頭辞と
    // 結びつく相手が無くなる
    expect(printedConfig.jsPlugins).toEqual(EXPECTED_JS_PLUGINS);
  });

  it("categories の格上げが効いている", () => {
    // categories で有効になったルールは解決後設定の rules に列挙されない。値でしか見えない
    expect(printedConfig.categories).toEqual({ correctness: "deny", perf: "deny" });
  });

  it("型検査を lint へ合流させている", () => {
    expect(printedConfig.options).toEqual({ typeAware: true, typeCheck: true });
  });

  it("緩和するファイルの範囲を広げていない", () => {
    expect(
      printedConfig.overrides.map((override) => override.files),
      "緩和の範囲が変わった。広げると本体コードでも no-unsafe-* が無効になる",
    ).toEqual([EXPECTED_OVERRIDE_FILES]);
  });

  it("緩和するルールを増やしていない", () => {
    expect(
      printedConfig.overrides.flatMap((override) => Object.keys(override.rules)).sort(),
      "緩和するルールが変わった。増やすとテストコードの型検査がその分だけ緩む",
    ).toEqual([...EXPECTED_OVERRIDE_RULES].sort());
  });
});

/**
 * jsPlugin のロードと `lint.settings` の解決は、どちらも解決後設定に現れない。
 * fixture の directive が要らなくなることで検出する (fixture 自身のコメントを参照)。
 */
describe("解決後設定に現れない検査", () => {
  it("jsPlugin がロードされ settings が解決している", () => {
    const result = runVp([
      "lint",
      "--report-unused-disable-directives",
      "-f",
      "json",
      JS_PLUGIN_FIXTURE,
    ]);
    const diagnostics: Diagnostic[] = parseJsonOutput(result).diagnostics;
    expect(
      diagnostics.map((diagnostic) => diagnostic.message),
      `${JS_PLUGIN_FIXTURE} の directive が不要になった。jsPlugin の解決か settings.entryPoint を疑う`,
    ).toEqual([]);
  });
});

/**
 * lint が実際に見に行く範囲を、追跡しているソースとの差で見る。可視範囲は
 * `lint.ignorePatterns` だけでなく `.gitignore` からも縮むため、設定値を写しても塞がらない。
 */
describe("lint の可視範囲", () => {
  let linted: Set<string>;

  beforeAll(() => {
    // --debug=files は lint せずに対象一覧だけを出す
    const result = runVp(["lint", "--debug=files", ...SOURCE_ROOTS]);
    // beforeAll 内は expect を置けない (vitest/no-standalone-expect) ため throw で fail-loud にする
    if (result.status !== 0) {
      throw new Error(`vp lint --debug=files failed:\n${result.output}`);
    }
    linted = new Set(result.stdout.split("\n").filter(Boolean));
  }, 20_000);

  it("追跡しているソースが lint の対象に入っている", () => {
    const tracked = execFileSync("git", ["ls-files", ...SOURCE_ROOTS], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    })
      .split("\n")
      .filter((path) => path.endsWith(".ts") || path.endsWith(".tsx"));
    expect(
      tracked.filter((path) => !linted.has(path)),
      "lint から見えないソースが増えた。ignorePatterns と .gitignore を疑う",
    ).toEqual(ALLOWED_INVISIBLE);
  });

  it("fixture が lint の対象に入っている", () => {
    // 対象から外れると directive が評価されず、上の jsPlugin 検査が空振りする
    expect(linted.has(relative(REPO_ROOT, resolve(REPO_ROOT, JS_PLUGIN_FIXTURE)))).toBe(true);
  });
});
