import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, lazyPlugins } from "vite-plus";

const OXLINT_DEFAULT_PLUGINS = ["typescript", "unicorn", "oxc"] as const;

export default defineConfig({
  // Vite の .env 読み込みを切る。秘密を暗号化して .env ごとコミットする方式 (dotenvx 等) は、
  // Vite が .env を native に読むと暗号文をそのまま import.meta.env / process.env へ流し込む。
  // vitejs/vite#19373 がその衝突の報告で、`envDir: false` はその解として追加された。
  // このプロジェクトは環境ごとに変わらない値をモジュール定数で持つため (src/lib/app-name.ts)、
  // 読み込む .env がそもそも無い。将来 .env を置いても勝手に読まれない状態を先に固定する
  envDir: false,
  staged: {
    // --no-error-on-unmatched-pattern: staged 対象が ignorePatterns の生成ファイル
    // (routeTree.gen.ts) だけのコミットで、対象ゼロを error にしない
    "*.{ts,tsx,js,jsx}": [
      "vp fmt --write --no-error-on-unmatched-pattern",
      "vp lint --fix --no-error-on-unmatched-pattern",
    ],
    "*.md": ["vp fmt --write --no-error-on-unmatched-pattern"],
  },
  lint: {
    // plugins は既定集合を追加ではなく置換する。明示しないと無効になり、rules に書いた
    // 設定が無言で無視される。eslint のコアルールだけは plugins の指定によらず常時有効
    plugins: [
      ...OXLINT_DEFAULT_PLUGINS,
      "react",
      "import",
      "promise",
      "jsdoc",
      "vitest",
      "jsx-a11y",
    ],
    // oxlint はネイティブに tailwind 領域のルールを持たない。JS プラグインとして載せる
    // (ADR-0004)。プラグイン名は package が meta.name で持つ better-tailwindcss になる
    jsPlugins: [{ name: "better-tailwindcss", specifier: "eslint-plugin-better-tailwindcss" }],
    settings: {
      "better-tailwindcss": {
        // theme の正本。解決に失敗すると素の Tailwind theme へ暗黙に落ち、初期化したはずの
        // 既定 palette が既知クラスとして復活する。プラグインは警告を診断へ添えるだけなので、
        // 解決の成否は解決後設定に出ないため、fixture (bg-red-500) の抑制が不要になることで見る
        entryPoint: "src/styles.css",
      },
    },
    // カテゴリ丸ごとの有効化は correctness と perf に限る。他はプラグインごとの上流
    // recommended を基準に rules へ名指しする (ADR-0004)。
    // vp check は --deny-warnings 相当を持たず既定の warn では exit 0 で通るため error で入れる
    // (scripts/checks/integrity/lint-config.test.ts が解決後設定の値で機械強制)
    categories: { correctness: "error", perf: "error" },
    options: { typeAware: true, typeCheck: true },
    rules: {
      // -- 基準から外れる名指し (ADR-0004) --
      "typescript/consistent-type-assertions": ["error", { assertionStyle: "never" }],

      // -- eslint コア: @eslint/js の recommended (ADR-0004) --
      "no-case-declarations": "error",
      "no-empty": "error",
      "no-fallthrough": "error",
      "no-prototype-builtins": "error",
      // ESM では重複宣言がパースエラー、TypeScript では型検査の TS2451 になる。関数
      // オーバーロードや宣言マージでも鳴らないため、報告する場面が残っていない
      "no-redeclare": "off",
      "no-regex-spaces": "error",
      // oxlint は実行環境ごとの globals 定義を持たず、console / process の参照を全て未定義と
      // 見なす。未定義の識別子は型検査が TS2304 で報告する
      "no-undef": "off",
      "no-unexpected-multiline": "error",
      "no-useless-assignment": "error",
      "preserve-caught-error": "error",

      // -- eslint コア: typescript-eslint の eslint-recommended が error にする分 (ADR-0004) --
      // TypeScript が var と apply を過去のものにし、const と rest 引数がより良い型を与える
      // ことが根拠で、@eslint/js の recommended には入らない。接頭辞なしで書くと eslint コアへ
      // 解決されるため、同名の unicorn/prefer-spread は有効にならない (CLI の -D では両方が鳴る)
      "no-var": "error",
      "prefer-const": "error",
      "prefer-rest-params": "error",
      "prefer-spread": "error",

      // -- typescript: typescript-eslint の strict / strict-type-checked のうち、oxlint の
      // correctness に入っていない分 (ADR-0004)。オプションも基準に揃える --
      // 上流が eslint コアルールを拡張したもの (extension rule) は、oxlint がプラグイン接頭辞を
      // 落としてコアルールへ解決する。ここに書けるが診断は eslint(...) 名で出る。同じ理由で
      // no-unused-expressions と no-unused-vars は書かない (コアルールが correctness にあり既に有効)。
      // restrict-template-expressions は名指しでオプションを上書きできるが、上流本体と oxc が
      // 揃って既定の位置にいるため書かない (ADR-0004)
      "typescript/ban-ts-comment": ["error", { minimumDescriptionLength: 10 }],
      "typescript/no-array-constructor": "error",
      // ignoreVoidReturningFunctions は基準から外す。素の設定は戻り値型が void の
      // prop へ渡すアロー省略記法 (onClick={() => close()}) にも鳴り、void を値として
      // 使う本来の誤りと区別できない。typescript-eslint 本体も strictTypeChecked の上で
      // 同じオプションを置いている (eslint.config.mjs)
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
      // throw redirect() は TanStack Router の制御フロー契約で、SSR では投げた Response
      // がそのまま HTTP 307 になる。TanStack 公式が only-throw-error との衝突を認めて
      // この allow 設定を案内している (docs の eslint-plugin-router)。notFound() は
      // 使っていないため登録しない。使い始めたら lint が鳴るので、そこで足す
      "typescript/only-throw-error": [
        "error",
        { allow: [{ from: "package", package: "@tanstack/router-core", name: "Redirect" }] },
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
      "typescript/return-await": ["error", "error-handling-correctness-only"],
      "typescript/unified-signatures": "error",
      "typescript/use-unknown-in-catch-callback-variable": "error",

      // -- react: eslint-plugin-react の recommended と jsx-runtime (ADR-0004) --
      "react/display-name": "error",
      "react/jsx-no-comment-textnodes": "error",
      "react/jsx-no-target-blank": "error",
      "react/no-unescaped-entities": "error",
      "react/no-unknown-property": "error",
      "react/require-render-return": "error",

      // -- react-hooks: eslint-plugin-react-hooks の recommended-latest (ADR-0004)。
      // React Compiler の診断は oxlint 1.79 で 22 の per-category ルールへ分割され、
      // 束ねていた react/react-compiler は廃止された (oxc-project/oxc#25500)。上流の 17 の
      // うち 13 は oxlint の correctness に入りカテゴリ経由で error、config と gating は
      // oxlint に実装が無い。名指しが要るのは残る 2 つで、必要な理由は別々 --
      // Compiler が「対応する予定がない」構文 (this / with / インライン class 宣言)。
      // 未実装による bail out (react/todo) とは別で、書き換えれば消えるためコード側の
      // 欠陥として扱う (ADR-0009)。oxlint では restriction のため既定 off
      "react/unsupported-syntax": "error",
      // 分割されたルール群とは別系統の、従来からある Rules of Hooks 検査。Compiler は
      // コンポーネントまたは hook として認識した関数しか解析しないため、通常の関数から
      // hook を呼ぶコードを検出できない。その穴を埋める。oxlint では pedantic のため既定 off
      "react/rules-of-hooks": "error",

      // -- import: eslint-plugin-import の recommended (ADR-0004) --
      "import/export": "error",
      // TypeScript ファイルでは存在しない named import に対して何も報告しない。同じ誤りは
      // 型検査が TS2305 で報告するため、鳴らないルールを有効に見せかけない
      "import/named": "off",
      "import/no-duplicates": "error",
      "import/no-named-as-default": "error",
      "import/no-named-as-default-member": "error",

      // -- promise: eslint-plugin-promise の recommended (ADR-0004) --
      // ignoreLastCallback: void で捨てる終端 callback は戻り値の行き先が無く、return を
      // 足しても実行時の意味が変わらない。連鎖の途中で値を落とす誤りの検出は残る
      "promise/always-return": ["error", { ignoreLastCallback: true }],
      // 引数名が next / done / cb のいずれかであることだけで発火する。node 形式の callback を
      // 持たないコードベースでは、状態機械の遷移値を next と名付けただけで鳴る (ADR-0004)
      "promise/no-callback-in-promise": "off",
      "promise/catch-or-return": "error",
      "promise/no-nesting": "error",
      "promise/no-promise-in-callback": "error",
      "promise/no-return-in-finally": "error",
      "promise/no-return-wrap": "error",
      "promise/param-names": "error",

      // -- jsdoc: eslint-plugin-jsdoc の recommended-typescript (ADR-0004) --
      "jsdoc/check-access": "error",
      "jsdoc/check-tag-names": ["error", { typed: true }],
      "jsdoc/empty-tags": "error",
      // JSDoc は挙動と判断の理由を散文で書くために使い、引数と戻り値はシグネチャが持つ。
      // @param / @returns を必須にすると説明だけの JSDoc が書けなくなる
      "jsdoc/require-param": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/require-param-description": "error",
      "jsdoc/require-param-name": "error",
      "jsdoc/require-returns-description": "error",
      "jsdoc/require-throws-type": "error",
      "jsdoc/require-yields-type": "error",
      // recommended-typescript が off にする 3 ルール。型はシグネチャが持つため、JSDoc に
      // {type} を書くと同じ情報が 2 箇所になる。require-property-type は correctness 由来で
      // 有効になっているため、ここで明示的に落とす
      "jsdoc/require-param-type": "off",
      "jsdoc/require-property-type": "off",
      "jsdoc/require-returns-type": "off",

      // -- oxc: 上流に対応する設定がない。correctness と perf で拾う (ADR-0004) --
      // 公式が示す修正は元オブジェクトの破壊的更新で、確保を 1 回に減らすもの。読み出し
      // 結果や fixture を壊せない箇所では新規オブジェクトを作るしかなく、確保回数が
      // spread と同じになって効果が消える (ADR-0004)
      "oxc/no-map-spread": "off",

      // -- vitest: @vitest/eslint-plugin の recommended (ADR-0004) --
      // assertFunctionNames は既定 (expect / expectTypeOf / assert / assertType) へ足すのでは
      // なく置換する。expect* が既定の 2 つとテスト側のアサーションヘルパーを覆い、残りは
      // 名指しする。assert* まで広げると本体コードの引数検証関数まで assertion と見なす
      "vitest/expect-expect": [
        "error",
        { assertFunctionNames: ["expect*", "assert", "assertType"] },
      ],
      "vitest/no-commented-out-tests": "error",
      "vitest/no-identical-title": "error",
      "vitest/no-import-node-test": "error",
      "vitest/no-interpolation-in-snapshots": "error",
      "vitest/no-mocks-import": "error",
      "vitest/no-unneeded-async-expect-function": "error",
      "vitest/prefer-called-exactly-once-with": "error",
      // Vitest は expect(value, message) を正式に受け付ける。第 2 引数が変数の場合も許可する
      // ため、リテラルだけを例外扱いするルール既定値ではなく引数の上限を指定する
      "vitest/valid-expect": ["error", { maxArgs: 2 }],
      // 上流 recommended には含まれず correctness から有効になる。mock の型引数を必須に
      // しない oxc 自身の設定に合わせ、カテゴリ由来の有効化を明示的に取り消す
      "vitest/require-mock-type-parameters": "off",

      // -- jsx-a11y: eslint-plugin-jsx-a11y の recommended (ADR-0004) --
      // 名指しは 1 つも無い。recommended のルールは全て oxlint に実装があり correctness から
      // error で有効になるため、足す先が残らない (確認は vp lint --print-config)。correctness は
      // recommended 外の control-has-associated-label / lang / no-aria-hidden-on-focusable /
      // prefer-tag-over-role も併せて有効にする。実装があるルールは rules へ書けば足せるが
      // (例: anchor-ambiguous-text)、基準を recommended に置いているので広げない

      // -- better-tailwindcss: recommended 集合ではなく色の統制に要る 2 つだけを名指しする
      // (ADR-0004)。整形系と他の correctness は採らない --
      // src/styles.css が既定 palette を初期化しているため、bg-red-500 は theme に無いクラスと
      // してここで落ちる。生成レベルの無効化と対で palette を塞ぐ
      "better-tailwindcss/no-unknown-classes": "error",
      // theme を迂回して任意値へ色を書く経路を塞ぐ。var(--...) は semantic token の正規の
      // 参照方法なので通す
      "better-tailwindcss/no-restricted-classes": [
        "error",
        {
          restrict: [
            {
              message: "任意値に hex 色を書かない。色は semantic token を参照する",
              pattern: "\\[[^\\]]*#[0-9a-fA-F]{3,8}",
            },
            {
              // var(--...) を含む任意値は除外する。registry の
              // color-mix(in oklch, var(--secondary), var(--foreground) 5%) のように、
              // token を材料にして値を導く書き方は semantic token の正規の使い方
              message: "任意値に色を直書きしない。色は semantic token を参照する",
              pattern:
                "\\[(?![^\\]]*var\\(--)[^\\]]*(?:rgba?|hsla?|hwb|oklab|oklch|lab|lch|color-mix|color|light-dark)\\(",
            },
          ],
        },
      ],
    },
    // 緩和はテストの 1 経路に限る (ADR-0004)
    overrides: [
      {
        // モックは意図的に型を外した値を扱い、assertion は要素の存在を前提に書く。
        // typescript-eslint 本体が自身のテストディレクトリで off にしている 5 ルールと同一
        files: ["**/*.test.ts", "**/*.test.tsx", "src/test/**"],
        rules: {
          "typescript/no-non-null-assertion": "off",
          "typescript/no-unsafe-assignment": "off",
          "typescript/no-unsafe-call": "off",
          "typescript/no-unsafe-member-access": "off",
          "typescript/no-unsafe-return": "off",
        },
      },
    ],
    ignorePatterns: [
      "src/routeTree.gen.ts",
      ".claude/worktrees/**",
      ".agents/**",
      ".claude/skills/**",
      // registry の生成時 baseline (ADR-0006)。上流のコードをそのまま保存する記録なので
      // lint / 型検査の対象にしない。整形だけは合わせるため fmt 側では除外しない
      "docs/registry-baseline/**",
    ],
  },
  fmt: {
    sortImports: true,
    ignorePatterns: [
      "src/routeTree.gen.ts",
      ".claude/worktrees/**",
      ".agents/**",
      ".claude/skills/**",
    ],
  },
  resolve: {
    tsconfigPaths: true,
  },
  // lazyPlugins: lint / fmt / check / staged / pack / create と run・cache のタスク探索、
  // エディタ連携は config をメタデータとしてしか読まない。素の配列で書くとそれらの経路でも
  // プラグイン factory が毎回評価され、watcher の起動などの副作用まで走る。dev / build /
  // test / preview と vp run / vp exec が spawn するビルドでは従来どおり読み込まれる
  plugins: lazyPlugins(() => [
    devtools(),
    tailwindcss(),
    tanstackStart({
      router: { routeFileIgnorePattern: "\\.test\\.tsx?$" },
      importProtection: {
        client: {
          // better-sqlite3 は native binding (node-gyp) を持ち、client bundle に含めると
          // ビルドが壊れる。DB アクセスは src/server/ 配下のみで行う (server 専用)
          specifiers: ["better-sqlite3"],
          // 永続化層 (src/server/db/) と *.server.* を client から遮断する。schema.ts の
          // ように native を引かないファイルは specifiers だけでは素通りし、UI が直接
          // import しても壊れずに層が漏れるため、パス単位で止める。
          // src/server/functions/ の *.ts (RPC スタブ境界) は client から import する
          // 正当な経路なので対象にしない
          files: ["**/src/server/db/**", "**/*.server.*"],
        },
        // 既定は dev が "mock"、build が "error"。dev のままだと境界違反が再帰 Proxy へ
        // 差し替わって止まらず、遮断を機械保証する目的が開発中だけ外れる
        behavior: "error",
      },
    }),
    nitro({
      builder: "rolldown",
      // 全レスポンスへ静的なセキュリティヘッダを付ける。Nitro 層の機能なので preset に
      // 依存しないが、TanStack Start 公式の Cloudflare 手順は nitro() を使わない構成
      // (@cloudflare/vite-plugin + wrangler.jsonc) なので、そこへ移すときは付け直しが要る。
      // CSP はここに置かない。nonce をリクエストごとに変える必要があり、headers は静的な
      // 文字列しか取れないため (配線は router の ssr.nonce と対で設計する)。
      // 実レスポンスに乗ることは scripts/checks/runtime/security-headers.ts が押さえる
      routeRules: {
        "/**": {
          headers: {
            // MIME スニッフィングを止める。Content-Type を偽装した応答を実行させない
            "X-Content-Type-Options": "nosniff",
            // frame への埋め込みを禁じ、clickjacking を塞ぐ
            "X-Frame-Options": "DENY",
            // Referer に path とクエリを載せない。外部サイトへ遷移するときの漏れを防ぐ
            "Referrer-Policy": "strict-origin-when-cross-origin",
            // 別 origin の window と browsing context group を分ける
            "Cross-Origin-Opener-Policy": "same-origin",
            // 別 origin からの読み込みを拒む
            "Cross-Origin-Resource-Policy": "same-origin",
            // HTTPS へ固定する。http で配信する開発サーバは routeRules を通らないので影響しない
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
          },
        },
      },
    }),
    // logDiagnostics: Compiler が諦めた箇所 (bail out) をビルドログへ出す。既定は false で、
    // 最適化が外れたことがどこにも現れない。fatal は常に transform を失敗させる
    viteReact({ compiler: { logDiagnostics: true } }),
  ]),
});
