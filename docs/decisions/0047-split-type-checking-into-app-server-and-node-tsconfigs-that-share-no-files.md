# ADR-0047: 型検査の tsconfig を app・server・Node の 3 つに分け、どのファイルも 1 つにだけ入れる

- Status: Accepted
- Date: 2026-11-03
- 関連: ADR-0010 (実行環境をファイル名の接尾辞で宣言し、実行時の境界は `importProtection` が持つ)、ADR-0038 (`lib` の `ESNext.Error`)

## Context

`vp check` は、oxlint の type-aware の経路 (tsgolint) で型検査を行う (`docs/guides/dependencies-and-toolchain.md`「`typescript` を直接の依存に置かない理由」、`tooling/lint/config.ts` の `typeCheck: true`)。
tsgolint は、ファイルを `include` に持つ tsconfig の program でそのファイルを検査する。import で別の program に入っただけのファイルは、その program では検査しない (oxc-project/tsgolint#817 のメンテナの回答 "To fix this you should use project references, this allows us (and tsc) to automatically work out what tsconfig to use for each file")。

このテンプレートのファイルは、動く環境で 3 つに分かれる。

| 動く環境          | ファイル                                                                                                                    | 区分の出典                                                                                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ブラウザと SSR    | `src/` のうち、次の行に当たらないもの。そのテストと story も同じ行に数える (テストは Node かブラウザのテストランナーで動く) | TanStack Start docs「Execution Model」の "**All code in TanStack Start is isomorphic by default** - it runs and is included in both server and client bundles unless explicitly constrained." |
| サーバーだけ      | `src/server.ts`、`src/**/*.server.ts`、`src/**/*.server.tsx`、`src/server/`                                                 | ADR-0010。環境は接尾辞で宣言する。`src/server/` はドメインに属さない server の基盤 (DB の接続とテーブルの定義など) を置き、横断的な server function の宣言も置ける                            |
| Node (開発の道具) | `scripts/`、`tooling/`、`vite.config.ts`、`drizzle.config.ts`、`.storybook/main.ts`                                         |                                                                                                                                                                                               |

型の境界と bundle の境界は、別の import の連なりで引かれる。

- bundle では、TanStack Start のコンパイラが client の build で `createServerFn()` の handler を RPC の stub に置き換え、handler だけが使っていた server の import を外す (docs「Import Protection」の "when the compiler replaces a `createServerFn()` handler with a client RPC stub, it can also remove server-only imports that were only used by the removed implementation.")。import protection は build では tree-shaking の後に判定する ("In **build mode**, import protection defers violation checks until after tree-shaking.")
- 型検査は、置き換える前の import を辿る。DB を引く server function が 1 つでもあれば、server function を宣言するファイル (`src/features/<domain>/functions.ts`) から `handlers.server.ts`、`src/server/db/index.ts` を経て DB の driver の型 (`@types/better-sqlite3` 9.6.0 の `/// <reference types="node" />`) が入り、ブラウザの program に Node の型が入る (2026-11-03、`tsc --explainFiles`)。サンプル実装を消した直後のテンプレートには DB を引く server function が無く、この連なりも無い
- docs「Execution Model」の「Module-Level `process.env` Reads」は、`createServerFn().handler()` の中で `process.env` を読む形を正しい形 (✅) として示す。この形のファイルはブラウザの program に入る

公式の案内は 2 つの向きがある。

| 出典                                                                                        | tsconfig の形                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TanStack Start の docs「Build from Scratch」「Path Aliases」                                | ルートの `tsconfig.json` に設定を書く形を示す。`references` の記述は無い                                                                                                                                                                                       |
| TanStack/router の `examples/react/start-*`                                                 | `tsconfig.json` を持つ 22 本はどれも `tsconfig.json` 1 本だけで、`tsconfig.*.json` は 0 本 (main `f723f3b8be` の git tree を `^examples/react/start-[^/]+/tsconfig\.[^/]+\.json$` で数えた。2026-11-03)                                                        |
| TanStack CLI の雛形 (`packages/create/src/frameworks/react/project/base/tsconfig.json.ejs`) | `include: ["**/*.ts", "**/*.tsx"]`、`lib` に `DOM`、`types: ["vite/client"]` (Vite のとき) の 1 つ (TanStack/cli main `270f9b06fd`、2026-11-03)                                                                                                                |
| create-vite の react-ts (vitejs/vite main `b3cb0575af`)                                     | ルートは `files: []` と `references` だけで、`tsconfig.app.json` (`src`、`lib` に DOM) と `tsconfig.node.json` (`vite.config.ts`、`types: ["node"]`) に分ける。動機は vitejs/vite#15913 の "`tsc` doesn't fail when there are type errors in `vite.config.ts`" |
| TypeScript の handbook「Project References」の「Guidance」                                  | 共通の `compilerOptions` は継承の元の 1 つの tsconfig に置く。ルートは `references` と空の `files` だけにする ("otherwise the solution file will cause double compilation of files")                                                                           |
| Vite docs「Shared Options > tsconfig」                                                      | `tsconfig` option を設定しないよう勧める警告の中で "Prefer placing a `tsconfig.json` near the files it configures and using TypeScript references for multi-project setups." と書く                                                                            |

## Decision

**型検査の tsconfig を app (ブラウザと SSR)・server (サーバーだけ)・node (Node) の 3 つに分け、ルートの `tsconfig.json` の `references` でつなぐ。どのファイルも 3 つのうち 1 つの `include` にだけ入れ、重なりは app の `exclude` で無くす。**

| ファイル               | 中身                                                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsconfig.base.json`   | 共通の `compilerOptions`。`paths` (`@/*`) と、DOM を持たない `lib` (`ES2024`、`ESNext.Error`) を持つ                                                                                                                            |
| `tsconfig.json`        | `extends: "./tsconfig.base.json"`、`files: []`、`references` (app・server・node)                                                                                                                                                |
| `tsconfig.app.json`    | `include` は `src/**/*.ts`・`src/**/*.tsx`・`.storybook/preview.tsx`、`exclude` は server の `include` と同じ範囲。`lib` に `DOM` と `DOM.Iterable`、`types` は `vite-plus/client`・`vite-plus/test/browser-playwright`・`node` |
| `tsconfig.server.json` | `include` は `src/server/**/*.ts`・`src/server/**/*.tsx`・`src/server.ts`・`src/**/*.server.ts`・`src/**/*.server.tsx`。`lib` は base のまま、`types: ["node"]`                                                                 |
| `tsconfig.node.json`   | `include` は `scripts/**/*.ts`・`tooling/**/*.ts`・`vite.config.ts`・`drizzle.config.ts`・`.storybook/main.ts`。`lib` は base のまま、`types: ["node"]`                                                                         |

1. 重なりは `exclude` で無くす。`references` の並び順に意味を持たせない。どのファイルも `include` で持つ tsconfig が 1 つに決まるので、`vp check` と `tsc -p <tsconfig>` で、ファイルを根に持つ program が食い違わない (並び順で割り当てる案の却下の理由は「検討した選択肢」)
2. テストと story は app に入れる。`src/server/` の下のテスト (`src/server/db/index.test.ts` など) だけが server に入り、`*.server.ts` の横に置くテストは `src/**/*.server.ts` に当たらないので app に入る。テストが `declare module` を持つファイル (`src/lib/page-name.ts` など) と同じ program に入るので、型を補う宣言のファイルは要らない
3. app の `types` に `node` を書く。app の単体テスト (`src/**/*.test.ts`) は Node で動き、`node:vm` と `process.env` を使う (`src/lib/server-error-exposure.test.ts`、`src/test/test-time-zone.tz.test.ts`)
4. ルートの `tsconfig.json` は base を `extends` して `paths` を持つ。shadcn の CLI はルートの `tsconfig.json` の `paths` だけを読む (shadcn-ui/ui#11466 "tsconfig.app.json tsconfig.node.json are ignored"、fallback を足す shadcn-ui/ui#11469 は 2026-11-03 時点で open)。`vp exec shadcn info` の `importAlias` は、この形で `@`、`extends` を外すと `-` だった (2026-11-03、shadcn 4.22.2)
5. `composite` は書かない。この形で `vp dlx -p typescript@6.0.3 tsc -b` は exit 0 だった (2026-11-03)。create-vite の react-ts も、空のルートから参照する形では `composite` が要らないとして外している (vitejs/vite#17774)

`vp check` での境界は次のとおりである (probe を置いて `vp check --no-fmt` を打ち、probe は消した。2026-11-03、vite-plus 1.4.0)。

| probe を置いた場所 (program)                                     | 書いた式                                                                    | 結果                                                                                    |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/server/` (server)                                           | `document.title`                                                            | TS2584 `Cannot find name 'document'`、`no-unsafe-assignment`、`no-unsafe-member-access` |
| `src/lib/<name>.server.ts` を app のファイルから import (server) | `document.title`                                                            | 同上。app の program に import で入っても、server の program で検査される               |
| `src/server/` (server)                                           | `process.env.HOME`                                                          | 通る                                                                                    |
| `src/lib/` (app)                                                 | `Buffer.from("a").toString("base64")`、`process.env.HOME`、`document.title` | 通る。`Buffer.from("a")` を `number` に入れた行は TS2322 で、`Buffer` に型が付いている  |
| `scripts/` (node)                                                | `document.title`、`Buffer.from("a").toString("base64")`                     | 通る。`document.title` を `number` に入れた行は TS2322 で、`document` に型が付いている  |

app と node に境界ができない理由は、どちらも依存の型の連なりである (`vp dlx -p typescript@6.0.3 tsc -p <tsconfig> --noEmit --explainFiles`、2026-11-03)。

| program | 外せない型 | 入る連なり                                                                                                                                                                                                                                                                                                                                         |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| app     | Node       | story の型 (`@storybook/tanstack-react` → `@storybook/builder-vite` → Vite の Node 向けの型。story 1 本だけの program にも `@types/node` が入った)、ブラウザテストの型 (`@vitest/browser` → `vitest/node`)、`types` の `node`、DB を引く server function があればその driver の型 (Context)。`types` から `node` を外しても `@types/node` は残った |
| node    | DOM        | `scripts/contrast/` が使う `colorjs.io` 0.7.1 の型が `/// <reference lib="dom" />` を持つ                                                                                                                                                                                                                                                          |

### 検討した選択肢

| 案                                                                                     | 評価                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 採否     |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 3 つ (app・server・node)。重なりを `exclude` で無くす                                  | server の program で DOM の global が止まる。app と node には境界ができない (上の表)。server の `include` と app の `exclude` に同じ範囲の glob を書く                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | **採用** |
| `tsconfig.json` 1 つのまま                                                             | TanStack Start の docs・examples・CLI の雛形と同じ形。`src/server/` と `scripts/` に置いた `document.title` も、`src/lib/` に置いた `Buffer`・`process.env` も通る (2026-11-03 の probe)。サーバーだけのファイルの DOM の誤りを止める手段が無い                                                                                                                                                                                                                                                                                                                                                                                                                | 却下     |
| create-vite の 2 つ (app = `src/` の全部、node = `scripts/`・`tooling/`・設定ファイル) | app が `src/server/` を `include` に持つので、サーバーだけのファイルで DOM の global が通る。`src/server/db/index.ts` が DB の driver を直に import するので、サンプル実装の有無に関わらず app に Node の型が入る (2026-11-03、`tsc --explainFiles`)                                                                                                                                                                                                                                                                                                                                                                                                           | 却下     |
| 4 つ (app・test・server・node)                                                         | test の program で 26 件のエラー (`StaticDataRouteOption` に `pageName` が無い TS2353 が 16 件、`staticData.pageName` を持つ route の options の TS2345 が 6 件、`CDPSession` に `send` が無い TS2339 が 4 件。2026-11-03)。テストが `declare module` を持つファイルと、`tooling/` だけが import する `vite-plus/test/browser-playwright` の型に届かない。直すには test の program に型を補う宣言のファイルを置き、付随ファイルの種別を app の `exclude` と test の `include` の 2 か所に書き続ける。テストと story を外した app は、DB を引く server function が無い間だけ Node の型を持たない (サンプル実装を消した状態で `@types/node` は 0 件。2026-11-03) | 却下     |
| `references` の並び順で割り当てる 3 つ (node・server・app の順、`exclude` なし)        | `vp check` と `vp test run` は採用した形と同じに通った (2026-11-03)。tsgolint が重なったファイルを先に並ぶ tsconfig に割り当てるのは、`internal/utils/find_tsconfig.go` が `references` を幅優先で辿る実装による (oxlint-tsgolint 7.0.2004)。tsgolint の回答も TypeScript 3.9 のリリースノートの "the current `.ts` file probably belongs to one of the mentioned projects" も、順を定めない。`tsc -p tsconfig.app.json` と `tsc -b` は app の `include` にある server のファイルを app の program の根としても検査する。エディタの割り当ては確かめていない                                                                                                    | 却下     |

## Consequences

- サーバーでだけ動くファイルで DOM の global を書くと、`vp check` が TS2584 で止める
- `src/server/` に置いた横断的な server function の宣言のファイルは、クライアントからも import されるが、server の program で DOM なしに検査される。宣言のファイルはサーバーの bundle にも入るので (Context)、そこで DOM の global を書けばサーバーで壊れる
- ブラウザで動くコードで Node の global を書いても、Node で動くコードで DOM の global を書いても、型検査は止めない。実行時に壊れる import は `importProtection` が `vp build` で止める (ADR-0010)
- server の `include` と app の `exclude` は同じ範囲を指し続ける。片方だけ変えると、ファイルが 2 つの tsconfig に入るか、どちらにも入らない。どの `include` にも入らないファイルも `vp check` は検査し、DOM の global を通すが、既定の設定には `paths` が無いので `@/` の import は TS2307 で落ち、Node の型も無い (2026-11-04、vite-plus 1.4.0)。割り当ての確かめ方は `docs/guides/dependencies-and-toolchain.md`「tsconfig にファイルを割り当てる」にある
- リポジトリの直下にコードのディレクトリを足したら、3 つのどれかの `include` に足す
- 再評価条件: TanStack Start の docs か CLI の雛形が tsconfig を分ける形を示したとき。tsgolint か TypeScript の docs が `references` の順でファイルを割り当てると定めたとき (`exclude` を外せる)。shadcn の CLI が `references` の先の `paths` を読むようになったとき (ルートの `extends` を外せる)

## 出典

- TanStack Start docs「Execution Model」(isomorphic by default、`createServerFn().handler()` の中の `process.env`。main `f723f3b8be`、2026-11-03 に確認): https://github.com/TanStack/router/blob/f723f3b8be0699746e6e3192a16e3a8aaf3ce121/docs/start/framework/react/guide/execution-model.md
- TanStack Start docs「Import Protection」(「Common Pitfall: Why Some Imports Stay Alive」「False Positives: Dev vs Build」。main `f723f3b8be`、2026-11-03 に確認): https://github.com/TanStack/router/blob/f723f3b8be0699746e6e3192a16e3a8aaf3ce121/docs/start/framework/react/guide/import-protection.md
- TanStack Start docs「Build from Scratch」の TypeScript Configuration (main `f723f3b8be`): https://github.com/TanStack/router/blob/f723f3b8be0699746e6e3192a16e3a8aaf3ce121/docs/start/framework/react/build-from-scratch.md
- TanStack Start docs「Path Aliases」(main `f723f3b8be`): https://github.com/TanStack/router/blob/f723f3b8be0699746e6e3192a16e3a8aaf3ce121/docs/start/framework/react/guide/path-aliases.md
- TanStack/router の examples (main `f723f3b8be`): https://github.com/TanStack/router/tree/f723f3b8be0699746e6e3192a16e3a8aaf3ce121/examples/react
- TanStack CLI の tsconfig の雛形 (main `270f9b06fd`): https://github.com/TanStack/cli/blob/270f9b06fd13f12ec03cf2604922f99e86d9f9e7/packages/create/src/frameworks/react/project/base/tsconfig.json.ejs
- create-vite の react-ts の tsconfig (vitejs/vite main `b3cb0575af`): https://github.com/vitejs/vite/tree/b3cb0575aff63004a71301a1ec798aeea2aa05d7/packages/create-vite/template-react-ts
- create-vite の react-ts を references の形にした PR と動機 (2024-06-13 merge): https://github.com/vitejs/vite/pull/15913
- create-vite の tsconfig から `composite` を外した PR (2024-07-31 merge): https://github.com/vitejs/vite/pull/17774
- TypeScript の handbook「Project References」(TypeScript-Website v2 `205122bb73`、2026-11-03 に確認): https://github.com/microsoft/TypeScript-Website/blob/205122bb73dcbf6f3b373de5bdb0d9fa5434d015/packages/documentation/copy/en/project-config/Project%20References.md
- TypeScript 3.9 の release notes「Support for "Solution Style" `tsconfig.json` Files」(TypeScript-Website v2 `205122bb73`): https://github.com/microsoft/TypeScript-Website/blob/205122bb73dcbf6f3b373de5bdb0d9fa5434d015/packages/documentation/copy/en/release-notes/TypeScript%203.9.md
- Vite docs「Shared Options > tsconfig」(vitejs/vite main `b3cb0575af`、2026-11-03 に確認): https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/docs/config/shared-options.md
- tsgolint のメンテナの回答 (2026-03-23): https://github.com/oxc-project/tsgolint/issues/817
- tsgolint がファイルを tsconfig に割り当てる実装 (oxlint-tsgolint 7.0.2004 の版): https://github.com/oxc-project/tsgolint/blob/a61289117febcb1a60cf3bc75ef2b6bbccc4b665/internal/utils/find_tsconfig.go
- shadcn の CLI が `tsconfig.app.json` を読まない報告と、その fallback の PR (2026-11-03 時点で open): https://github.com/shadcn-ui/ui/issues/11466 / https://github.com/shadcn-ui/ui/pull/11469
