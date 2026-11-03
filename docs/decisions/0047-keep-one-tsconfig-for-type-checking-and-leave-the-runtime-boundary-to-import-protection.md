# ADR-0047: 型検査の tsconfig は 1 つのままにし、実行環境の境界は import protection に任せる

- Status: Accepted
- Date: 2026-11-03
- 関連: ADR-0004 (型検査は `vp check` が担う)、ADR-0010 (実行時の環境の境界は `importProtection` が持つ)

## Context

型検査は `vp check` が `tsconfig.json` 1 つで行う (ADR-0004)。`include` は `**/*.ts`・`**/*.tsx`・`.storybook/**`、`lib` は `DOM` と `DOM.Iterable` を持ち、`types` は `vite-plus/client` だけである。
`src/` も `scripts/`・`tooling/`・設定ファイルも 1 つの program に入るので、ブラウザの global と Node の global がどこでも型付きで通る。

| probe を置いた場所 | 書いた式                                             | `vp check` (2026-11-03) |
| ------------------ | ---------------------------------------------------- | ----------------------- |
| `src/lib/`         | `Buffer.from("a").toString("base64")`、`process.env` | 通る                    |
| `scripts/`         | `document.title`                                     | 通る                    |

tsconfig を実行環境ごとに分けて project references でつなぐ案は、「`src/` はブラウザで動き、`scripts/`・`tooling/`・設定ファイルは Node で動く」という前提に立つ。
TanStack Start の docs「Execution Model」は、この前提を `src/` について採らない。

- "**All code in TanStack Start is isomorphic by default** - it runs and is included in both server and client bundles unless explicitly constrained."
- 同じページの「Common Anti-Patterns」の「Module-Level `process.env` Reads」は、`createServerFn().handler()` の中で `process.env` を読む形を正しい形として示す。「Environment-Specific Implementations」は `createIsomorphicFn().server(() => ({ platform: process.platform }))` を示す
- このテンプレートも、`src/features/<domain>/functions.ts` の `createServerFn` の宣言をクライアントのコードから import する (ADR-0010)

公式の案内は 2 つの向きがある。

| 出典                                                                                        | tsconfig の形                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TanStack Start の docs「Build from Scratch」「Path Aliases」                                | ルートの `tsconfig.json` に設定を書く形を示す。`references` の記述は無い                                                                                                                                                                                             |
| TanStack/router の `examples/react/start-*`                                                 | `tsconfig.json` を持つ 22 本はどれも `tsconfig.json` 1 本だけで、`tsconfig.*.json` は 0 本 (main `f723f3b8be` の git tree を `^examples/react/start-[^/]+/tsconfig\.[^/]+\.json$` で数えた。2026-11-03)                                                              |
| TanStack CLI の雛形 (`packages/create/src/frameworks/react/project/base/tsconfig.json.ejs`) | `include: ["**/*.ts", "**/*.tsx"]`、`lib` に `DOM`、`types: ["vite/client"]` の 1 つ (TanStack/cli main `270f9b06fd`、2026-11-03)。このテンプレートの `tsconfig.json` と同じ並びである                                                                               |
| create-vite の react-ts (vitejs/vite main `b3cb0575af`)                                     | ルートは `references` だけで、`tsconfig.app.json` (`src`) と `tsconfig.node.json` (`vite.config.ts`) に分ける。分けた動機は vitejs/vite#15913 の "`tsc` doesn't fail when there are type errors in `vite.config.ts`" で、`tsc -b` で設定ファイルも検査するためである |
| Vite docs「Shared Options > tsconfig」                                                      | `tsconfig` option を設定しないよう勧める警告の中で "Prefer placing a `tsconfig.json` near the files it configures and using TypeScript references for multi-project setups." と書く                                                                                  |
| oxc-project/tsgolint#817 のメンテナの回答                                                   | tsgolint が tsconfig を尊重しないという報告に "This isn't a bug - this is working as expected." と答え、"To fix this you should use project references" と続ける                                                                                                     |

Vite と tsgolint の案内は、tsconfig が既に複数ある構成でのつなぎ方であり、分けることを求めてはいない。

## Decision

**型検査の tsconfig は `tsconfig.json` 1 つのままにし、ブラウザと Node で分けない。実行時の環境の境界は ADR-0010 の `importProtection` に任せ、tsconfig で境界を足さない。**

1. 分ける案の前提が `src/` で成り立たない。TanStack Start のコードは既定でサーバーとクライアントの両方の bundle に入り、docs はクライアントの bundle に入るファイルの中で `process.env` を読む形を示す (Context)
2. 試しに分けても、ブラウザと Node の型の境界はできない。一時の tsconfig を `tsconfig.json` から `extends` して `vp dlx -p typescript@6.0.3 tsc -p <一時の tsconfig> --noEmit --explainFiles` で引いた (2026-11-03)

   | 分けた program                                                                 | 外したのに残った型 | 入った経路                                                                                                                                                                                                                                           |
   | ------------------------------------------------------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | app (`src/` から付随ファイル・`src/test/`・`src/server/`・`*.server.*` を除く) | Node               | クライアントが import する `src/features/<domain>/functions.ts` が `handlers.server.ts` を import し、そこから `src/server/db/index.ts` が `better-sqlite3` を import する。`@types/better-sqlite3` 9.6.0 が `/// <reference types="node" />` を持つ |
   | node (`scripts/`・`tooling/`・設定ファイル。`lib` から `DOM` を外す)           | DOM                | `scripts/contrast/` が使う `colorjs.io` 0.7.1 の型が `/// <reference lib="dom" />` を持つ                                                                                                                                                            |

   どちらも正しい import の連なりで、取り除く対象ではない

3. 実行時の境界は `vite.config.ts` の `importProtection` が持つ。クライアントが `*.server.*` や `src/server/db/` を import すると `vp build` が落ちる (ADR-0010 の実測)。型検査の program はこの境界と別の線を引けない (2 の表)
4. 公式の 2 つの向きのうち、framework に固有の TanStack Start の形 (docs・examples・CLI の雛形がどれも 1 つ) に従う。create-vite が分けた動機の「設定ファイルを型検査する」は、`tsconfig.json` の `include` が `**/*.ts` で `vite.config.ts` と `scripts/` を拾うので、`vp check` で満たされている

### 検討した選択肢

| 案                                                                                     | 評価                                                                                                                                                                                                            | 採否     |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `tsconfig.json` 1 つのまま                                                             | TanStack Start の docs・examples・CLI の雛形と同じ形。設定ファイルも `vp check` が検査する。どのファイルでもブラウザと Node の global が通る                                                                    | **採用** |
| create-vite の 2 つ (app = `src/` の全部、node = `scripts/`・`tooling/`・設定ファイル) | app に `better-sqlite3` の型が Node を入れ、node に `colorjs.io` の型が DOM を入れる (Decision の 2)。分ける動機の設定ファイルの型検査は、今の形で満たされている                                                | 却下     |
| 4 つ (app・test・node・server)                                                         | server の program だけは `document` を止めた (`lib` から `DOM` を外し、TS2584 `Cannot find name 'document'`。2026-11-03、tsc 6.0.3)。server のファイルは app にも import で入るので、app の Node の型は消えない | 却下     |

## Consequences

- ブラウザで動くコードで Node の global (`Buffer`、`process`) を書いても、Node で動くコードで DOM の global を書いても、型検査は止めない。実行時に壊れる import は `importProtection` が `vp build` で止める (ADR-0010)
- 付随ファイルの種別・`src/test/`・`*.server.*` を、複数の tsconfig の `include` と `exclude` で揃え続ける手間は生じない
- 4 つに分けた案を 2026-11-03 に試したとき、`vp check` は test の program で 26 件のエラーを出した。include に頼る `declare module` (`src/lib/page-name.ts` の `StaticDataRouteOption.pageName`、`src/router.tsx` の `Register`) と、`tooling/` の import に頼る `vitest/browser` の拡張 (`CDPSession.send`) が test の program に入らなかったためで、分けるなら test の program に読ませる手当てが要る
- 分けた構成では、shadcn の CLI が `tsconfig.app.json` の `paths` を読まない (shadcn-ui/ui#11466 と、fallback を足す shadcn-ui/ui#11469。どちらも 2026-11-03 時点で open)
- 再評価条件: TanStack Start の docs か CLI の雛形が tsconfig を分ける形になったとき。server function の宣言と実処理を、クライアントの program が import しない形に置くことが公式の形になり、app の program から server のファイルが外れるとき

## 出典

- TanStack Start docs「Execution Model」(isomorphic by default、`createServerFn().handler()` の中の `process.env`、`createIsomorphicFn().server()`。main `f723f3b8be`、2026-11-03 に確認): https://github.com/TanStack/router/blob/f723f3b8be0699746e6e3192a16e3a8aaf3ce121/docs/start/framework/react/guide/execution-model.md
- TanStack Start docs「Build from Scratch」の TypeScript Configuration (main `f723f3b8be`): https://github.com/TanStack/router/blob/f723f3b8be0699746e6e3192a16e3a8aaf3ce121/docs/start/framework/react/build-from-scratch.md
- TanStack Start docs「Path Aliases」(main `f723f3b8be`): https://github.com/TanStack/router/blob/f723f3b8be0699746e6e3192a16e3a8aaf3ce121/docs/start/framework/react/guide/path-aliases.md
- TanStack/router の examples (main `f723f3b8be`): https://github.com/TanStack/router/tree/f723f3b8be0699746e6e3192a16e3a8aaf3ce121/examples/react
- TanStack CLI の tsconfig の雛形 (main `270f9b06fd`): https://github.com/TanStack/cli/blob/270f9b06fd13f12ec03cf2604922f99e86d9f9e7/packages/create/src/frameworks/react/project/base/tsconfig.json.ejs
- create-vite の react-ts の tsconfig (vitejs/vite main `b3cb0575af`): https://github.com/vitejs/vite/tree/b3cb0575aff63004a71301a1ec798aeea2aa05d7/packages/create-vite/template-react-ts
- create-vite の react-ts を references の形にした PR と動機 (2024-06-13 merge): https://github.com/vitejs/vite/pull/15913
- Vite docs「Shared Options > tsconfig」(vitejs/vite main `b3cb0575af`、2026-11-03 に確認): https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/docs/config/shared-options.md
- tsgolint のメンテナの回答 (2026-03-23): https://github.com/oxc-project/tsgolint/issues/817
- shadcn の CLI が `tsconfig.app.json` を読まない報告と、その fallback の PR (2026-11-03 時点で open): https://github.com/shadcn-ui/ui/issues/11466 / https://github.com/shadcn-ui/ui/pull/11469
