---
paths:
  - "src/features/**"
  - "src/server/**"
  - "src/routes/**"
  - "src/start.ts"
  - "src/server.ts"
  - "src/lib/server-error-exposure.ts"
  - "src/components/screens/route-error.tsx"
---

# server function の境界

server function は、それを呼ぶ画面とは独立に到達できる RPC endpoint になる。
どこで守るかの経緯と却下案は ADR-0012 が持つ。

## 関心事の置き場所

| 関心事                                                     | 置き場所                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------ |
| 全 server function に必ず要るもの (認証・CSRF・例外のログ) | `src/start.ts` の `functionMiddleware` / `requestMiddleware` |
| fn ごとに要否が変わるもの (認可)                           | `createServerFn` を包む base builder                         |
| 未ログインを login へ送る画面遷移                          | route の `beforeLoad`                                        |

認証は global へ載せれば付け忘れる場所が無い。認可の付け忘れに機械強制は無く、規範として守りレビューで見る (ADR-0012)。

- `beforeLoad` をデータの防御にしない。server function は route を読み込まずに呼べるので、route を守っても endpoint は無防備なまま残る (ADR-0012)
- 認証 middleware を個々の `createServerFn` へ書かない。`createMiddleware({ type: "function" })` で作り `src/start.ts` の `functionMiddleware` へ渡す。1 件の付け忘れが無認証の endpoint になる (ADR-0012)
- 型付きの context を得る目的で個々の `createServerFn` へ `.middleware()` を足さない。global の値は `.middleware()` なしでも型付きで読め、global の方が先に走る (ADR-0012)
- 認可の base builder は、ロールによる出し分けが要るようになった時点で足す。先に置くと守る対象の無い装置になる (ADR-0012)
- server function の例外を、個々の fn の中で catch して console へ書かない。global の `logServerFnErrors` (`src/start.ts`) が残して投げ直すので、二重に残る (`docs/guides/server-errors.md`「例外を server のログに残す」)
- 例外の文言に秘密と個人情報 (DB の行の値、ユーザーの入力) を入れない。文言は server のログに残り、DEV では画面にも出る (`docs/guides/server-errors.md`「例外の文言を書く」)
- SSR の読み込み (validateSearch・beforeLoad・loader) の例外を、route の `onError` や catch で console へ書かない。`src/server.ts` から呼ぶ `logSsrMatchErrors` (`src/server/ssr-errors.ts`) が `[ssr] <routeId>` で残すので、二重に残る (`docs/guides/server-errors.md`「例外を server のログに残す」)
- ユーザーに見せる文言を持つ例外の adapter は `serverErrorAdapter` より前に並べる。adapter は先頭から試されて最初に当たったものが使われるので、後ろに置くと `serverErrorAdapter` が先に掴んで素の Error に戻し、型の分岐が外れる (production では文言も落ちる) (ADR-0038)
- 例外の詳細を client と画面に出すかの判定は、`serverErrorAdapter` (`src/lib/server-error-exposure.ts`) と `route-error.tsx` で `import.meta.env.DEV` を直接読んで行い、関数で包まない。包むと呼び出し側で値が畳み込まれず、production の bundle に DEV の分岐が残る (ADR-0038)
- 2 か所の判定を変えるときは、両方を同じ条件に揃える。片方だけ変わると、server で描いた HTML と client の描画が食い違って hydration がずれる (`docs/guides/server-errors.md`「詳細を出す環境を変える」)
- 例外を描く errorComponent を足すときは、`RouteErrorContent` を使うか、`import.meta.env.DEV` の分岐の中で `thrownValueMessage` を通して文言を出す。分岐の外で出すと、production の server の HTML に例外の文言が入る (`docs/guides/server-errors.md`「詳細を出す環境を変える」)

## ファイルの置き場所と名前

| 対象                                   | 置き場所                                   |
| -------------------------------------- | ------------------------------------------ |
| 1 つのドメインに属する server fn       | `src/features/<domain>/functions.ts`       |
| その実処理                             | `src/features/<domain>/handlers.server.ts` |
| ドメインに属さない server fn と helper | `src/server/` 直下                         |

- 実処理のファイル名に `.server.` を必ず入れる。既定の遮断はファイル名パターンだけなので、`src/server/db/` を引かない実処理 (外部 API や secret だけを扱うもの) は接尾辞を落とすと client から import できてしまう (ADR-0010)
- 部分一致の検索は `likeContains` (`src/server/db/like-pattern.ts`) を使い、パターンと `ESCAPE` を手で組まない。忘れた検索は `%` `_` を含む入力で黙って壊れる (SQLite の LIKE: https://www.sqlite.org/lang_expr.html#like)
- `createServerFn` の宣言と実処理を 1 ファイルにまとめない。実処理を server function を経由せず単体テストできる側に残すため (`docs/guides/placement.md`「server function の置き場」)
