import type { OxlintConfig } from "vite-plus/lint";

import {
  BROWSER_TEST_GLOB,
  companionGlobs,
  storyGlobs,
  testHelperGlobs,
} from "../../scripts/lib/companion-files";

const OXLINT_DEFAULT_PLUGINS = ["typescript", "unicorn", "oxc"] as const;

/**
 * `@shadcn/lint` が design system component として認識する層 (ADR-0011)。`routes/` などから
 * これらの部品へ渡す className を `no-restyle` と `require-static-classes` が検査する。
 * `action/` は ui 部品を async React (Transition) にした層で、ui と同じく design system の部品として
 * 認識する。外すと `ActionForm` への見た目の上書きや動的な className が無診断で通る
 */
const DESIGN_SYSTEM_COMPONENT_LAYERS = ["ui", "action", "parts"] as const;

/**
 * バレルがテストの import を重くするので、個別エントリポイントから引かせる依存 (ADR-0032)。
 * 足す手順は docs/guides/dependencies-and-toolchain.md「依存をバレルの禁止の対象に足す」。
 * `paths` は specifier の完全一致で、`date-fns/format` や `date-fns/locale/ja` は止めない。トップレベルの rules と、テスト専用コードの
 * import 禁止の override の両方へ渡す。override は同じルールのオプションを丸ごと置き換えるので、
 * 片方だけだと override の範囲 (src/ と scripts/ のアプリのコード) でバレルが素通りする
 */
const RESTRICTED_BARREL_IMPORTS = [
  {
    name: "date-fns",
    message:
      "date-fns はバレルから引かない。テストの import が重くなる。関数ごとの個別エントリポイント (date-fns/format など) から import する (ADR-0032)",
  },
  {
    name: "date-fns/locale",
    message:
      "date-fns/locale はバレルから引かない。テストの import が重くなる。ロケールごとの個別エントリポイント (date-fns/locale/ja など) から import する (ADR-0032)",
  },
];

/**
 * `vite.config.ts` の `lint`。`lintConfig` の中の文字列のパス (`jsPlugins` の specifier、`overrides` の `files` /
 * `excludeFiles`、`ignorePatterns`) は、このファイルではなく `vite.config.ts` のあるディレクトリから解決される。
 * 切り出し方とパスの解決元は `docs/guides/vite-configuration.md`「block を別のファイルへ切り出す」
 */
export const lintConfig = {
  // 既定集合を置換する (docs/guides/lint/configuration.md「plugins は既定集合を置換する」)
  plugins: [...OXLINT_DEFAULT_PLUGINS, "react", "import", "promise", "jsdoc", "vitest", "jsx-a11y"],
  // name は診断・rules のキー・抑制 directive で共有する (docs/guides/lint/custom-rules.md「JS plugin の落とし穴」)
  jsPlugins: [
    // Tailwind と shadcn/ui の領域のルール (ADR-0023)
    { name: "shadcn", specifier: "@shadcn/lint" },
    // story が storybook/test 経由で使う testing-library の検査 (docs/guides/lint/configuration.md「testing-library を当てる範囲」)
    { name: "testing-library", specifier: "eslint-plugin-testing-library" },
    // ブラウザテストの assert を見る自前ルール (ADR-0009)
    { name: "browser-test", specifier: "./scripts/lint/browser-test.ts" },
    // TanStack Query / Router の契約の検査 (ADR-0007、oxc-project/oxc#11648)
    { name: "tanstack-query", specifier: "@tanstack/eslint-plugin-query" },
    { name: "tanstack-router", specifier: "@tanstack/eslint-plugin-router" },
  ],
  settings: {
    shadcn: {
      componentImports: DESIGN_SYSTEM_COMPONENT_LAYERS.map(
        (layer) => `^@/components/${layer}(/|$)`,
      ),
      // ui/ が定義した variant 関数だけを宣言する。mergeFunctions は使わない
      // (docs/guides/lint/tailwind-and-shadcn.md「variant 関数を宣言する」、ADR-0023)
      variantFunctions: ["buttonVariants", "cardTitleVariants"],
    },
  },
  // カテゴリで有効にするのは correctness と perf だけ (ADR-0007)。
  // warn は exit code に出ないので error。lint-config.test.ts が固定する
  categories: { correctness: "error", perf: "error" },
  options: { typeAware: true, typeCheck: true },
  rules: {
    // -- 基準から外れる名指し (ADR-0007) --
    "typescript/consistent-type-assertions": ["error", { assertionStyle: "never" }],

    // バレルの禁止 (ADR-0032)。下の import 禁止の override にも同じ paths を渡す
    "no-restricted-imports": ["error", { paths: RESTRICTED_BARREL_IMPORTS }],

    // -- eslint コア: @eslint/js の recommended (ADR-0007) --
    "no-case-declarations": "error",
    "no-empty": "error",
    "no-fallthrough": "error",
    "no-prototype-builtins": "error",
    // ESM ではパースエラー、TS では TS2451 になる。報告する場面が残っていない
    "no-redeclare": "off",
    "no-regex-spaces": "error",
    // oxlint は環境の globals を持たない。未定義の識別子は TS2304 が報告する
    "no-undef": "off",
    "no-unexpected-multiline": "error",
    "no-useless-assignment": "error",
    "preserve-caught-error": "error",

    // -- eslint コア: typescript-eslint の eslint-recommended が error にする分 (ADR-0007) --
    // 接頭辞なしは eslint コアへ解決され、unicorn/prefer-spread は有効にならない
    // (docs/guides/lint/configuration.md「設定を書き換えたら解決後の設定で確かめる」)
    "no-var": "error",
    "prefer-const": "error",
    "prefer-rest-params": "error",
    "prefer-spread": "error",

    // -- typescript: typescript-eslint の strict / strict-type-checked のうち、oxlint の
    // correctness に入っていない分 (ADR-0007)。オプションも基準に揃える --
    // extension rule はコアへ解決される。no-unused-* はコアが correctness で有効なので書かない
    // (docs/guides/lint/configuration.md「設定を書き換えたら解決後の設定で確かめる」)
    "typescript/ban-ts-comment": ["error", { minimumDescriptionLength: 10 }],
    "typescript/no-array-constructor": "error",
    // 素の設定は void を返す prop へのアロー省略記法 (onClick={() => close()}) にも鳴る。
    // typescript-eslint 本体も同じ指定 (ADR-0007 の出典)
    "typescript/no-confusing-void-expression": ["error", { ignoreVoidReturningFunctions: true }],
    "typescript/no-deprecated": "error",
    "typescript/no-dynamic-delete": "error",
    "typescript/no-empty-object-type": "error",
    "typescript/no-explicit-any": "error",
    "typescript/no-extraneous-class": "error",
    "typescript/no-invalid-void-type": "error",
    "typescript/no-misused-promises": "error",
    "typescript/no-mixed-enums": "error",
    "typescript/no-namespace": "error",
    "typescript/no-non-null-asserted-nullish-coalescing": "error",
    "typescript/no-non-null-assertion": "error",
    "typescript/no-require-imports": "error",
    "typescript/no-unnecessary-boolean-literal-compare": "error",
    "typescript/no-unnecessary-condition": "error",
    "typescript/no-unnecessary-template-expression": "error",
    "typescript/no-unnecessary-type-arguments": "error",
    "typescript/no-unnecessary-type-assertion": "error",
    "typescript/no-unnecessary-type-constraint": "error",
    "typescript/no-unnecessary-type-conversion": "error",
    "typescript/no-unnecessary-type-parameters": "error",
    "typescript/no-unsafe-argument": "error",
    "typescript/no-unsafe-assignment": "error",
    "typescript/no-unsafe-call": "error",
    "typescript/no-unsafe-enum-comparison": "error",
    "typescript/no-unsafe-function-type": "error",
    "typescript/no-unsafe-member-access": "error",
    "typescript/no-unsafe-return": "error",
    "typescript/no-useless-constructor": "error",
    // throw redirect() / notFound() は Router の制御フロー。公式の案内どおり allow する。
    // allowThrowingAny と allowThrowingUnknown はルールの既定の true から外し (基準の
    // strict-type-checked はオプションを渡さない)、型が any か unknown の値の throw も止める。
    // Error でない値は server のエラーの文言を落とす adapter を通らない
    // (ADR-0038「Error でない値の throw を止める lint のオプション」)。allowRethrowing は、
    // src/start.ts の logServerFnErrors が catch の投げ直しに頼るので true を明示する
    "typescript/only-throw-error": [
      "error",
      {
        allow: [
          { from: "package", package: "@tanstack/router-core", name: "Redirect" },
          { from: "package", package: "@tanstack/router-core", name: "NotFoundError" },
        ],
        allowRethrowing: true,
        allowThrowingAny: false,
        allowThrowingUnknown: false,
      },
    ],
    "typescript/prefer-literal-enum-member": "error",
    "typescript/prefer-promise-reject-errors": "error",
    "typescript/prefer-reduce-type-parameter": "error",
    "typescript/prefer-return-this-type": "error",
    "typescript/related-getter-setter-pairs": "error",
    "typescript/require-await": "error",
    "typescript/restrict-plus-operands": [
      "error",
      {
        allowAny: false,
        allowBoolean: false,
        allowNullish: false,
        allowNumberAndString: false,
        allowRegExp: false,
      },
    ],
    // 整数の埋め込みにも鳴るので allowNumber だけを true に戻す。allowBoolean は "false" の埋め込みを止めるため
    // false のまま (ADR-0007)
    "typescript/restrict-template-expressions": [
      "error",
      {
        allowAny: false,
        allowBoolean: false,
        allowNever: false,
        allowNullish: false,
        allowNumber: true,
        allowRegExp: false,
      },
    ],
    "typescript/return-await": ["error", "error-handling-correctness-only"],
    "typescript/unified-signatures": "error",
    "typescript/use-unknown-in-catch-callback-variable": "error",

    // -- react: eslint-plugin-react の recommended と jsx-runtime (ADR-0007) --
    "react/display-name": "error",
    "react/jsx-no-comment-textnodes": "error",
    "react/jsx-no-target-blank": "error",
    "react/no-unescaped-entities": "error",
    "react/no-unknown-property": "error",
    "react/require-render-return": "error",

    // -- react-hooks: eslint-plugin-react-hooks の recommended-latest。名指しはカテゴリ外の 2 つ
    // (ADR-0007、oxc-project/oxc#25500) --
    // Compiler が対応しない構文。restriction で既定 off なので名指しする (ADR-0014)
    "react/unsupported-syntax": "error",
    // Compiler が解析しない通常の関数からの hook 呼び出しを拾う。pedantic で既定 off (ADR-0007)
    "react/rules-of-hooks": "error",

    // -- import: eslint-plugin-import の recommended (ADR-0007) --
    "import/export": "error",
    // TS ファイルでは鳴らない。同じ誤りは TS2305 が報告する
    "import/named": "off",
    "import/no-duplicates": "error",
    "import/no-named-as-default": "error",
    "import/no-named-as-default-member": "error",

    // -- promise: eslint-plugin-promise の recommended (ADR-0007) --
    // ignoreLastCallback: void で捨てる終端 callback は戻り値の行き先が無く、return を
    // 足しても実行時の意味が変わらない。連鎖の途中で値を落とす誤りの検出は残る
    "promise/always-return": ["error", { ignoreLastCallback: true }],
    // 引数名 (next / done / cb) だけで発火する (docs/guides/lint/configuration.md「ルールを off にする」)
    "promise/no-callback-in-promise": "off",
    "promise/catch-or-return": "error",
    "promise/no-nesting": "error",
    "promise/no-promise-in-callback": "error",
    "promise/no-return-in-finally": "error",
    "promise/no-return-wrap": "error",
    "promise/param-names": "error",

    // -- jsdoc: eslint-plugin-jsdoc の recommended-typescript (ADR-0007) --
    "jsdoc/check-access": "error",
    "jsdoc/check-tag-names": ["error", { typed: true }],
    "jsdoc/empty-tags": "error",
    // 説明だけの JSDoc を書けるようにする。引数と戻り値はシグネチャが持つ
    "jsdoc/require-param": "off",
    "jsdoc/require-returns": "off",
    "jsdoc/require-param-description": "error",
    "jsdoc/require-param-name": "error",
    "jsdoc/require-returns-description": "error",
    "jsdoc/require-throws-type": "error",
    "jsdoc/require-yields-type": "error",
    // recommended-typescript が off にする 3 つ。require-property-type は correctness から入る
    "jsdoc/require-param-type": "off",
    "jsdoc/require-property-type": "off",
    "jsdoc/require-returns-type": "off",

    // -- oxc: 上流に対応する設定がない。correctness と perf で拾う (ADR-0007) --
    // 公式の修正は元オブジェクトの破壊的更新。壊せない箇所では確保が減らない
    "oxc/no-map-spread": "off",

    // -- tanstack-query: @tanstack/eslint-plugin-query の recommended と prefer-query-options (ADR-0007) --
    "tanstack-query/exhaustive-deps": "error",
    // 上流は warn。型情報を使うケースは JS plugin では見えない (ADR-0007)
    "tanstack-query/no-rest-destructuring": "error",
    "tanstack-query/stable-query-client": "error",
    "tanstack-query/no-unstable-deps": "error",
    "tanstack-query/infinite-query-property-order": "error",
    "tanstack-query/mutation-property-order": "error",
    // recommended-strict から足す (ADR-0007)
    "tanstack-query/prefer-query-options": "error",
    // no-void-query-fn は登録しない。型情報が要り、oxlint の JS plugin では常に無診断になる (ADR-0007)

    // -- tanstack-router: @tanstack/eslint-plugin-router の recommended (ADR-0007) --
    "tanstack-router/route-param-names": "error",
    // 上流は warn (ADR-0007)
    "tanstack-router/create-route-property-order": "error",

    // -- vitest: @vitest/eslint-plugin の recommended (ADR-0007) --
    // 既定を置換する。expect* が既定の 2 つと helper を覆い、assert* には広げない
    // (広げると本体の引数検証まで assertion になる)。名指しの assert / assertType は利用者が無くても残す
    // (docs/guides/lint/configuration.md「ルールを off にする」)
    "vitest/expect-expect": ["error", { assertFunctionNames: ["expect*", "assert", "assertType"] }],
    "vitest/no-commented-out-tests": "error",
    "vitest/no-identical-title": "error",
    "vitest/no-import-node-test": "error",
    "vitest/no-interpolation-in-snapshots": "error",
    "vitest/no-mocks-import": "error",
    "vitest/no-unneeded-async-expect-function": "error",
    "vitest/prefer-called-exactly-once-with": "error",
    // @vitest/eslint-plugin は vi.defineHelper の中の expect を許す (vitest-dev/eslint-plugin-vitest#894)。oxlint の移植は許さない
    // 撤去条件: oxlint の no-standalone-expect が vi.defineHelper を既定で許したとき
    "vitest/no-standalone-expect": ["error", { additionalTestBlockFunctions: ["vi.defineHelper"] }],
    // expect(value, message) は Vitest の正式な形。第 2 引数が変数でも許す
    "vitest/valid-expect": ["error", { maxArgs: 2 }],
    // 上流 recommended に無く correctness から入る。mock の型引数を必須にしない
    "vitest/require-mock-type-parameters": "off",

    // -- jsx-a11y: eslint-plugin-jsx-a11y の recommended (ADR-0007)。名指しはゼロ
    // (docs/guides/lint/configuration.md「jsx-a11y は名指しがゼロになる」) --

    // -- shadcn: 設計判断と対にして名指しする (ADR-0023)。層の境界を持つ 2 つは overrides --
    "shadcn/no-unknown-classes": "error",
    "shadcn/no-raw-colors": "error",
    // color だけを deny する。色以外の arbitrary value (min-h-[50vh] など) は許す (ADR-0023)
    "shadcn/no-arbitrary-values": ["error", { deny: ["color"] }],
  },
  overrides: [
    {
      // testing-library は story と story 専用の helper に限る。glob は companion-files.ts が唯一の定義
      // (docs/guides/lint/configuration.md「testing-library を story に限る理由」)
      files: storyGlobs("**/"),
      rules: {
        // eslint-plugin-testing-library の flat/react (`docs/guides/lint/configuration.md`「testing-library を当てる範囲」)
        "testing-library/await-async-events": ["error", { eventModule: "userEvent" }],
        "testing-library/await-async-queries": "error",
        "testing-library/await-async-utils": "error",
        "testing-library/no-await-sync-events": ["error", { eventModules: ["fire-event"] }],
        "testing-library/no-await-sync-queries": "error",
        "testing-library/no-container": "error",
        // 上流は warn (docs/guides/lint/configuration.md「testing-library を story に限る理由」)
        "testing-library/no-debugging-utils": "error",
        "testing-library/no-dom-import": ["error", "react"],
        "testing-library/no-global-regexp-flag-in-query": "error",
        "testing-library/no-manual-cleanup": "error",
        // storybook/test 経由の story では発火しない (docs/guides/lint/configuration.md「testing-library を story に限る理由」)
        "testing-library/no-node-access": "off",
        "testing-library/no-promise-in-fire-event": "error",
        "testing-library/no-render-in-lifecycle": "error",
        "testing-library/no-unnecessary-act": "error",
        "testing-library/no-wait-for-multiple-assertions": "error",
        "testing-library/no-wait-for-side-effects": "error",
        "testing-library/no-wait-for-snapshot": "error",
        "testing-library/prefer-find-by": "error",
        "testing-library/prefer-presence-queries": "error",
        "testing-library/prefer-query-by-disappearance": "error",
        "testing-library/render-result-naming-convention": "error",
        // play の canvas を render の結果と誤読する (docs/guides/lint/configuration.md「testing-library を story に限る理由」)
        "testing-library/prefer-screen-queries": "off",
      },
    },
    {
      // 緩和はこの 1 経路に限る (docs/guides/lint/configuration.md「テストファイルの緩和」)
      files: ["**/*.test.ts", "**/*.test.tsx", "src/test/**"],
      rules: {
        "typescript/no-non-null-assertion": "off",
        "typescript/no-unsafe-assignment": "off",
        "typescript/no-unsafe-call": "off",
        "typescript/no-unsafe-member-access": "off",
        "typescript/no-unsafe-return": "off",
      },
    },
    {
      // design system の内部 (ui/) だけを適用範囲から外す (ADR-0011 / ADR-0022)
      files: ["src/**", ".storybook/**"],
      excludeFiles: ["src/components/ui/**"],
      rules: {
        // ScrollArea は器に合わせる角丸だけを呼び出し側に許す (ADR-0011)
        "shadcn/no-restyle": [
          "error",
          {
            allow: ["layout"],
            contracts: [{ pattern: "^ScrollArea$", allow: ["layout", "rounded"] }],
          },
        ],
        "shadcn/require-static-classes": "error",
      },
    },
    {
      // ブラウザテストと locator を配る helper に当て、unit のテストは外す (ADR-0009)。
      // 除外を **/*.test.ts で書かない。その綴りは import 禁止の override の印 (lint-config.test.ts が検査する)
      files: [BROWSER_TEST_GLOB, "src/test/**", ...testHelperGlobs("**/")],
      excludeFiles: ["src/test/**/*.test.ts"],
      rules: {
        "browser-test/prefer-locator-methods": "error",
        // `locator.findElement()` を止める (ADR-0009)。正当な呼び出し元は無く、除外も置かない
        "browser-test/no-find-element": "error",
        // スタイルの否定 assert が素通りする形を止める (ADR-0009)
        "browser-test/no-negated-style-literal": "error",
        // 不在の assert を helper の名前で読み分けさせる (ADR-0009)
        "browser-test/no-bare-absence-assertion": "error",
      },
    },
    {
      // テストと story だけが使うコードをアプリから import させない。範囲を絞った有効化なので
      // テスト側は off にせず excludeFiles で外す。.storybook/** は対象外 (ADR-0008)
      files: ["src/**", "scripts/**"],
      excludeFiles: [...companionGlobs("**/"), "src/test/**"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            // トップレベルの paths をここでも渡す。渡さないと、この override の範囲でバレルの禁止が外れる
            paths: RESTRICTED_BARREL_IMPORTS,
            patterns: [
              {
                // alias (@/test/) と相対 (./test/ ../test/) の両方の specifier を止める
                regex: "\\.(test|story)-helpers$|\\.stories$|(^@|\\.)/test/",
                message:
                  "テストと story だけが使うコード。アプリのコードから import しない (ADR-0008)",
              },
            ],
          },
        ],
      },
    },
  ],
  ignorePatterns: [
    "src/routeTree.gen.ts",
    ".claude/worktrees/**",
    ".agents/**",
    ".claude/skills/**",
    // registry の生成時 baseline (ADR-0020)。`vite.config.ts` の `fmt` では除外しない
    "docs/registry-baseline/**",
  ],
} satisfies OxlintConfig;
