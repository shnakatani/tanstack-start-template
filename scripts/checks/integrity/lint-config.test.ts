import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { beforeAll, describe, expect, it } from "vite-plus/test";

import viteConfig from "../../../vite.config";
import { REPO_ROOT } from "../../lib/repo-root";

/**
 * lint の設定が「書いてあるだけ」ではなく解決後も生き残っていることを機械強制する。
 * 有効でないプラグインのルール設定は無診断で捨てられる (oxc-project/oxc#25579、ADR-0003)。
 *
 * 突き合わせの相手は `--print-config` の解決後設定にする。ルールが実際に発火することや、
 * categories の格上げで severity が上がることは oxlint 自身の責務なので踏まない。
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

/**
 * 解決後の `overrides` 全件。範囲 (files / excludeFiles) とルール名と severity を 1 つの期待値で
 * 固定する。個別のセレクタで種別ごとに絞ると、どのセレクタにも掛からない override が増えたときに
 * 無検知になる。全件を 1 つで持てば、増えた override は「期待値に無い要素」として名指しで落ちる
 */
const EXPECTED_OVERRIDES = [
  {
    // 緩和の範囲とルール。範囲を広げると本体コードでも no-unsafe-* が無効になり、ルールを増やすと
    // テストコードの型検査がその分だけ緩む (ADR-0004「テストファイルの緩和」)
    files: ["**/*.test.ts", "**/*.test.tsx", "src/test/**"],
    excludeFiles: undefined,
    rules: {
      "typescript/no-non-null-assertion": "allow",
      "typescript/no-unsafe-assignment": "allow",
      "typescript/no-unsafe-call": "allow",
      "typescript/no-unsafe-member-access": "allow",
      "typescript/no-unsafe-return": "allow",
    },
  },
  {
    // 層の境界に載せる規則と、その適用外にする層 (ADR-0020 / ADR-0021)。design system の著作側
    // (ui/ action/ parts/) だけを外し、消費側には規則を効かせる。excludeFiles を広げると、広げた
    // 先の層で className の上書きと動的な className が無診断で通る
    files: ["src/**"],
    excludeFiles: ["src/components/ui/**", "src/components/action/**", "src/components/parts/**"],
    rules: { "shadcn/no-restyle": "deny", "shadcn/require-static-classes": "deny" },
  },
  {
    // テスト専用のコードの import 禁止を当てる範囲。緩和ではなく範囲を絞った有効化なので、
    // テスト側は off ではなく excludeFiles で外す (ADR-0004「基準から外れる名指し」)。
    // excludeFiles を狭めるとテストや helper が自分の helper を import できなくなる
    files: ["src/**", "scripts/**"],
    excludeFiles: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.test-helpers.ts",
      "**/*.test-helpers.tsx",
      "src/test/**",
    ],
    rules: { "no-restricted-imports": "deny" },
  },
];

/** lint が見に行くべきソースの所在 */
const SOURCE_ROOTS = ["src", "scripts"];

/** 追跡されているのに lint されなくてよい唯一のソース。生成物 (ADR 対象外) */
const ALLOWED_INVISIBLE = ["src/routeTree.gen.ts"];

interface PrintedConfig {
  plugins: string[];
  /** jsPlugin を 1 つも宣言していない設定では key ごと現れない */
  jsPlugins?: { name: string; specifier: string }[];
  categories: Record<string, string>;
  options: Record<string, boolean>;
  rules: Record<string, unknown>;
  overrides: { files: string[]; excludeFiles?: string[]; rules: Record<string, unknown> }[];
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
    const jsPluginNames = (printedConfig.jsPlugins ?? []).map((plugin) => plugin.name);
    const written = Object.keys(viteConfig.lint?.rules ?? {}).filter(
      (rule) => !jsPluginNames.some((name) => rule.startsWith(`${name}/`)),
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

  it("categories の格上げが効いている", () => {
    // categories で有効になったルールは解決後設定の rules に列挙されない。値でしか見えない
    expect(printedConfig.categories).toEqual({ correctness: "deny", perf: "deny" });
  });

  it("型検査を lint へ合流させている", () => {
    expect(printedConfig.options).toEqual({ typeAware: true, typeCheck: true });
  });

  it("override の範囲とルールを全件固定している", () => {
    // 落ちたら: printedConfig.overrides を見て、増減した override を EXPECTED_OVERRIDES へ
    // 反映するか、意図しない変更なら vite.config.ts を直す。severity まで見るのは、ルールを
    // 残したまま "off" へ差し替える壊し方をキー集合だけでは拾えないため (2026-09-19 に実測)
    expect(
      printedConfig.overrides.map(({ files, excludeFiles, rules }) => ({
        files,
        excludeFiles,
        rules: Object.fromEntries(
          Object.entries(rules).map(([rule, value]) => [
            rule,
            Array.isArray(value) ? value[0] : value,
          ]),
        ),
      })),
      "override の範囲かルールか severity が変わった。範囲を広げるとその層で規則が無診断になり、" +
        "ルールを消すか off にすると規則が無言で外れる (ADR-0004 / ADR-0020 / ADR-0021)",
    ).toEqual(EXPECTED_OVERRIDES);
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
});
