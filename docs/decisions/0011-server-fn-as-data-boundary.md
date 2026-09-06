# ADR-0011: server function をデータ境界とし、全 fn 共通の middleware は global に載せる

- Status: Accepted
- Date: 2026-09-06
- 関連: ADR-0004 (lint ルールの選定基準)

## Context

このテンプレートは認証プロバイダを選定していない (リポジトリ直下の `README.md`「差し替え口」節)。
決めるのは「何で認証するか」ではなく、**どこで守るか**と**付け忘れをどう無くすか**の 2 つである。

TanStack Start の server function は、それを呼ぶ画面とは独立に到達できる RPC endpoint になる。
公式スキル `@tanstack/start-client-core#start-core/server-functions` は Common Mistakes の 1 件目に「route guard で server function を守る」を CRITICAL として置き、`beforeLoad` は route の UI を守るものでデータ境界ではないと述べる (skill の `library_version` は 1.170.14、2026-09-06 に確認)。

用意してあるのが差し替え口だけなので、埋め方を誤っても動くものは動く。
保護する route を `src/routes/_authed/` 配下へ移して `beforeLoad` で判定するところまでで止めると、画面は守られる一方で server function は無認証で呼べるまま残る。

付け忘れの防ぎ方は、規約と機械検査で守るか、付け忘れられない構造にするかの 2 通りある。
このテンプレートは CSRF で既に後者を採っている。`src/start.ts` が `createCsrfMiddleware` を `requestMiddleware` に置き、`filter` で server function に限定する。個々の fn は何も書かない。

### 実測

global function middleware の context が server function へ型として伝わることを 3 パターンで確認した (2026-09-06、`@tanstack/start-client-core` 1.170.27)。
baseline は `vp check --no-fmt --no-lint` が `Found no type errors`。プローブは次の 2 箇所へ置いた。

```ts
// src/start.ts — createStart の functionMiddleware へ渡す
const probeMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) =>
  next({ context: { probeUser: { uid: "u1" } } }),
);

// src/server/functions/notes.ts — .middleware() を持たない listNotes の handler で読む
console.log(context.probeUser.uid);
```

| プローブ                                  | `functionMiddleware` | 出力                                                                                                                      |
| ----------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `context.probeUser.uid` を読む            | 設定あり             | `Found no type errors` (増分なし)                                                                                         |
| 同上                                      | 設定なし             | `Found 2 errors` (`TS18048: 'context' is possibly 'undefined'` と `no-unsafe-member-access`)                              |
| `context.thisPropertyDoesNotExist` を読む | 設定あり             | `Found 1 error` (`TS2339: Property 'thisPropertyDoesNotExist' does not exist on type '{ probeUser: { uid: string; }; }'`) |

件数は読み方で変わる (中間変数へ代入すると `no-unsafe-assignment` が加わる)。上の表は `console.log` で読んだときの値である。
3 件目が示すとおり、`context` は `any` へ落ちず global middleware が足した context 型そのものへ解決する。

配線は `@tanstack/start-client-core` 1.170.27 の `dist/esm/createMiddleware.d.ts` で、`AssignAllServerFnContext` が `Register` の `config` から `functionMiddleware` を取り出す `GlobalServerFnContext` を合成する。`src/routeTree.gen.ts` が `config` を登録済みである。

実行順も同じ経路で決まる。同パッケージの `dist/esm/createServerFn.js` が middleware を平坦化するとき、global の `functionMiddleware` を per-function の指定より前に並べる。

`createServerFn` を包む base builder も公式の機構に載る。同ファイルの `.middleware()` は、渡されたものが server function factory なら、その middleware 構成を展開して取り込む。

## Decision

**server function を認証・認可のデータ境界とする。`beforeLoad` は画面遷移の UX として残し、データ境界として使わない。**

関心事は「全 fn に要るか」で置き場所を分ける。

| 関心事                                         | 置き場所                                                     | 付け忘れたとき                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 全 server function に必ず要るもの (認証・CSRF) | `src/start.ts` の `functionMiddleware` / `requestMiddleware` | 付け忘れる場所が無い                                                                            |
| fn ごとに要否が変わるもの (認可)               | `createServerFn` を包む base builder を選ぶ                  | base builder を選ばずに `createServerFn` を直に書ける。止め方は base builder を置く時点で決める |
| 未ログインを login へ送る画面遷移              | route の `beforeLoad`                                        | 画面が出るだけ。データは server function 側が守る                                               |

- 認証は `createMiddleware({ type: "function" })` で作り、`src/start.ts` の `functionMiddleware` へ渡す。個々の `createServerFn` には書かない
- 認可の base builder は、ロールによる出し分けが必要になった時点で足す。`createServerFn` の直接 import を lint で禁じるかも、その時点で ADR-0004 の選定基準に当てて判断する。禁じられること自体は oxlint の `no-restricted-imports` で確認した (下記「出典」)
- middleware の付与の有無を `scripts/checks/` の走査で検査しない

### 検討した選択肢

| 案                                                                                                                | 評価                                                                                                        | 採否     |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------- |
| server function をデータ境界とし、全 fn 共通の middleware を `src/start.ts` へ載せる (認可は base builder の選択) | 画面ではなくデータ側で止まり、認証は付け忘れる場所が無くなる。認可は fn ごとの選択として残る                | **採用** |
| `beforeLoad` の route guard だけで守る                                                                            | server function は route を読み込まずに直接呼べる。公式が Common Mistakes の 1 件目に置く形そのもの         | 却下     |
| 個々の `createServerFn` へ `.middleware([authMiddleware])` を付ける規約で守る                                     | 1 件の付け忘れが無認証の endpoint になる。守っているのが規約であって、コードの構造ではない                  | 却下     |
| 上に加えて付与の有無を `scripts/checks/` で走査する                                                               | 検査を足しても付け忘れられる形は残る。global へ載せれば付け忘れる場所自体が消える                           | 却下     |
| 認可も global へ載せる                                                                                            | fn ごとに要否が違う。全 fn へ一律に掛けると、権限が足りないことを本人へ説明するための fn 自体が呼べなくなる | 却下     |
| テンプレートの時点で base builder と lint を先に置く                                                              | 認可を要する server function がまだ無く、守る対象の無い装置になる                                           | 却下     |

## Consequences

- 認証を足す手順が `src/start.ts` の 1 箇所になる。server function を新設しても認証は自動で通る
- global function middleware が context へ足した値は、`.middleware()` を書かない server function からも型付きで読める (上記「実測」)
- `beforeLoad` は残るので、未ログインで保護画面を開いたときのリダイレクトは従来どおり書ける。変わるのは、それを唯一の防御にしないことだけ
- CSRF の現在の置き方 (global `requestMiddleware` + `filter`) は本 ADR の形と一致する。変更しない
- 認可の middleware を足すとき、認証は既に global で通っている。認証への依存を明示したいなら `.middleware([authMiddleware])` で chain する
- 認可の付け忘れを止める機械強制は持たない。base builder を置くまではレビューで見る
- lint で直接 import を禁じるなら、一律の禁止は base builder 自身の定義ファイルも落とす。lint の `overrides` でそのファイルだけ除外する (2026-09-06 に実測)
- 再評価条件: TanStack Start が server function への middleware 付与を型で強制する API を入れたとき。base builder と lint の必要性を見直す

## 出典

- server function がデータ境界であること: intent skill `@tanstack/start-client-core#start-core/server-functions` の Common Mistakes 1 件目
- global middleware の設定形と認可の middleware factory: intent skill `@tanstack/start-client-core#start-core/middleware` の Global Middleware / Middleware Factories
- 上記 2 スキルはどちらも `library_version: 1.170.14` を名乗り、`@tanstack/start-client-core` 1.170.27 に同梱されている (2026-09-06 に確認)
- context 型の合成: `@tanstack/start-client-core` 1.170.27 の `dist/esm/createMiddleware.d.ts` (`AssignAllServerFnContext` / `GlobalServerFnContext`)
- middleware の平坦化順と base builder の展開: 同 1.170.27 の `dist/esm/createServerFn.js`
- `createServerFn` の直接 import を `no-restricted-imports` で禁じられること: oxlint 1.79.0 へ一時 config を `--config` で渡して確認 (2026-09-06)。`vite.config.ts` の `lint.rules` 経由は未検証
