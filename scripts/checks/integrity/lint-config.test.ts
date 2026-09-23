import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { beforeAll, describe, expect, it } from "vite-plus/test";

import viteConfig from "../../../vite.config";
import { companionGlobs } from "../../lib/companion-files";
import { REPO_ROOT } from "../../lib/repo-root";

/**
 * lint の設定が「書いてあるだけ」ではなく解決後も生き残っていることを機械強制する。
 * 有効でないプラグインのルール設定は無診断で捨てられる (oxc-project/oxc#25579、ADR-0008)。
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
    // testing-library の適用先とルール。story 本体と story 専用の helper の両方に当てる。
    // helper へ play を切り出すとルールが外れる穴を塞ぐためである。範囲を広げても既存の
    // helper で誤検出が出ないことは 2026-09-21 に確かめた (`vp lint` に testing-library の
    // 診断が出ない)。当時の helper が引いていたのは `storybook/test` だけで、`*.test.tsx` の
    // ような locator API は使っていなかった。`vitest-browser-react` を import する helper が
    // 出たら同名衝突の誤検出が起きうるので、そのとき測り直す。
    // 適用先を `*.test.tsx` へ広げると、vitest-browser-react の locator API を
    // testing-library の同名 API と誤認して誤検出が出る。`prefer-screen-queries` を allow から
    // 戻すと Storybook の `canvas` が落ちる。`no-node-access` は allow のままにする。
    // deny へ戻しても strict 判定で発火せず、有効に見えて無検査の状態になる
    // (ADR-0010)
    files: [
      "**/*.stories.ts",
      "**/*.stories.tsx",
      "**/*.story-helpers.ts",
      "**/*.story-helpers.tsx",
    ],
    excludeFiles: undefined,
    rules: {
      "testing-library/await-async-events": "deny",
      "testing-library/await-async-queries": "deny",
      "testing-library/await-async-utils": "deny",
      "testing-library/no-await-sync-events": "deny",
      "testing-library/no-await-sync-queries": "deny",
      "testing-library/no-container": "deny",
      "testing-library/no-debugging-utils": "deny",
      "testing-library/no-dom-import": "deny",
      "testing-library/no-global-regexp-flag-in-query": "deny",
      "testing-library/no-manual-cleanup": "deny",
      "testing-library/no-node-access": "allow",
      "testing-library/no-promise-in-fire-event": "deny",
      "testing-library/no-render-in-lifecycle": "deny",
      "testing-library/no-unnecessary-act": "deny",
      "testing-library/no-wait-for-multiple-assertions": "deny",
      "testing-library/no-wait-for-side-effects": "deny",
      "testing-library/no-wait-for-snapshot": "deny",
      "testing-library/prefer-find-by": "deny",
      "testing-library/prefer-presence-queries": "deny",
      "testing-library/prefer-query-by-disappearance": "deny",
      "testing-library/prefer-screen-queries": "allow",
      "testing-library/render-result-naming-convention": "deny",
    },
  },
  {
    // 緩和の適用先とルール。適用先を広げると本体コードでも no-unsafe-* が無効になり、ルールを
    // 増やすとテストコードの型検査がその分だけ緩む (ADR-0009「テストファイルの緩和」)
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
    // 層の境界に載せる規則と、その適用外にする層 (ADR-0014 / ADR-0032)。design system の著作側
    // (ui/ action/ parts/) だけを外し、消費側には規則を効かせる。広げると、広げた先の層で
    // className の上書きと動的な className が無診断で通る。.storybook/ も消費側として扱う
    // (decorator が design system component を包む置き場になる)
    files: ["src/**", ".storybook/**"],
    excludeFiles: ["src/components/ui/**", "src/components/action/**", "src/components/parts/**"],
    rules: { "shadcn/no-restyle": "deny", "shadcn/require-static-classes": "deny" },
  },
  {
    // ブラウザテストの assert を守る自前ルール (ADR-0047 / ADR-0049)。
    // 適用先と除外の理由は vite.config.ts の同じ override が持つ。
    // 期待値は手書きで持つ。`testHelperGlobs()` を spread すると vite.config.ts と同じ
    // 入力どうしの比較になり、種別が増えても検査が通ってしまう
    // (`companion-files.ts` の docstring が禁じている)
    files: ["src/**/*.test.tsx", "src/test/**", "**/*.test-helpers.ts", "**/*.test-helpers.tsx"],
    excludeFiles: ["src/test/*.test.ts"],
    rules: {
      "browser-test/prefer-locator-methods": "deny",
      "browser-test/no-find-element": "deny",
      "browser-test/no-negated-style-literal": "deny",
      "browser-test/no-bare-absence-assertion": "deny",
    },
  },
  {
    // テスト専用のコードの import 禁止。緩和ではなく適用先を絞った有効化なので、テスト側は
    // off ではなく excludeFiles で外す (ADR-0011)。付随ファイルぶんは
    // 下で差し引くので、ここに残るのは src/test/** だけになる
    files: ["src/**", "scripts/**"],
    excludeFiles: ["src/test/**"],
    rules: { "no-restricted-imports": "deny" },
  },
];

/** 期待値から差し引く付随ファイルの glob。唯一の定義は scripts/lib/companion-files.ts */
const COMPANION_GLOBS = new Set(companionGlobs("**/"));

/** lint が見に行くべきソースの所在 */
const SOURCE_ROOTS = ["src", "scripts", ".storybook"];

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
    // それらの設定が無診断で捨てられる (ADR-0008)。unicorn と jsx-a11y は名指しルールを
    // 持たないため、下の突き合わせでは脱落を拾えない。plugins の値でしか見えない
    expect(
      [...printedConfig.plugins].sort(),
      "plugins が変わった。OXLINT_DEFAULT_PLUGINS の spread を落としていないか (ADR-0008)",
    ).toEqual([...EXPECTED_PLUGINS].sort());
  });

  it("rules に書いたルールが解決後設定に残っている", () => {
    // 無効なプラグインのルールは、ルール名が検証されるにもかかわらず解決後設定から消える。
    // 消えること自体が信号になるので、書いた側との差で名指し単位の取りこぼしを検出する。
    // jsPlugin のルールは有効でも出力に現れないため対象から外す (oxc#22117、ADR-0009)
    const jsPluginNames = (printedConfig.jsPlugins ?? []).map((plugin) => plugin.name);
    const written = Object.keys(viteConfig.lint?.rules ?? {}).filter(
      (rule) => !jsPluginNames.some((name) => rule.startsWith(`${name}/`)),
    );
    if (written.length === 0) {
      throw new Error("vite.config.ts の lint.rules を読めていない");
    }
    const printed = new Set(Object.keys(printedConfig.rules));
    const missing = written.filter((rule) => {
      // extension rule は typescript/ で書いてもコアルールの名前へ解決される (ADR-0008)
      const core = rule.startsWith("typescript/") ? rule.slice("typescript/".length) : rule;
      return !printed.has(rule) && !printed.has(core);
    });
    expect(
      missing,
      "書いたルールが解決後設定から消えた。plugins から該当プラグインが落ちていないか (ADR-0008)",
    ).toEqual([]);
  });

  it("categories の格上げが効いている", () => {
    // categories で有効になったルールは解決後設定の rules に列挙されない。値でしか見えない
    expect(printedConfig.categories).toEqual({ correctness: "deny", perf: "deny" });
  });

  it("型検査を lint へ合流させている", () => {
    expect(printedConfig.options).toEqual({ typeAware: true, typeCheck: true });
  });

  it("override の適用先とルールを全件固定している", () => {
    // 落ちたら: printedConfig.overrides を見て、増減した override を EXPECTED_OVERRIDES へ
    // 反映するか、意図しない変更なら vite.config.ts を直す。severity まで見るのは、ルールを
    // 残したまま "off" へ差し替える壊し方をキー集合だけでは拾えないため (2026-09-19 に実測)。
    //
    // excludeFiles からは companionGlobs の分を差し引いてから比べる。付随ファイルの種別は
    // scripts/lib/companion-files.ts が唯一の定義で、そこに単体テストがある。ここへ写すと
    // 種別を足すたびに同じ変更を 2 度書くだけの手順が増える。差し引いた残り (手書きの層と
    // src/test/**) は写す。差し引きはどの override にも効くので、付随ファイルの除外が別の
    // override へ付く壊し方は下の検査が受け持つ
    expect(
      printedConfig.overrides.map(({ files, excludeFiles, rules }) => ({
        files,
        excludeFiles: excludeFiles?.filter((glob) => !COMPANION_GLOBS.has(glob)),
        rules: Object.fromEntries(
          Object.entries(rules).map(([rule, value]) => [
            rule,
            Array.isArray(value) ? value[0] : value,
          ]),
        ),
      })),
      "override の適用先かルールか severity が変わった。適用先を広げるとその層で規則が無診断になり、" +
        "ルールを消すか off にすると規則が無言で外れる (ADR-0033 / ADR-0010 / ADR-0011 / ADR-0014 / ADR-0032)",
    ).toEqual(EXPECTED_OVERRIDES);
  });

  it("付随ファイルの除外は import 禁止の override が全種類ぶん持つ", () => {
    // 上の検査は excludeFiles から付随ファイルの分を無条件に差し引く。差し引きは「付いている
    // か」を見ないので、別の override へ付ける壊し方も、1 本消す壊し方も差分が出ない。
    // どちらもここで受け持つ
    const holders = printedConfig.overrides.filter(({ excludeFiles }) =>
      excludeFiles?.some((glob) => COMPANION_GLOBS.has(glob)),
    );
    expect(
      holders.map(({ files }) => files),
      "付随ファイルの除外が想定外の override に付いた。その override の規則が" +
        "テストと story で無診断になる (ADR-0011 / ADR-0014 / ADR-0032)",
    ).toEqual([["src/**", "scripts/**"]]);
    expect(
      holders[0]?.excludeFiles?.filter((glob) => COMPANION_GLOBS.has(glob)),
      "付随ファイルの除外が欠けた。その種別のファイルが自分の helper を import できなくなる " +
        "(ADR-0011)",
    ).toEqual(companionGlobs("**/"));
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
