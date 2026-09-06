---
paths:
  - "src/features/**"
  - "src/server/**"
  - "src/routes/**"
  - "src/start.ts"
---

# server function の境界

server function は、それを呼ぶ画面とは独立に到達できる RPC endpoint になる。
どこで守るかの経緯と却下案は ADR-0011 が持つ。

## 関心事の置き場所

| 関心事                                         | 置き場所                                                     |
| ---------------------------------------------- | ------------------------------------------------------------ |
| 全 server function に必ず要るもの (認証・CSRF) | `src/start.ts` の `functionMiddleware` / `requestMiddleware` |
| fn ごとに要否が変わるもの (認可)               | `createServerFn` を包む base builder                         |
| 未ログインを login へ送る画面遷移              | route の `beforeLoad`                                        |

認証は global へ載せれば付け忘れる場所が無い。認可の付け忘れに機械強制は無く、規範として守りレビューで見る (ADR-0011)。

- `beforeLoad` をデータの防御にしない。server function は route を読み込まずに呼べるので、route を守っても endpoint は無防備なまま残る (ADR-0011)
- 認証 middleware を個々の `createServerFn` へ書かない。`createMiddleware({ type: "function" })` で作り `src/start.ts` の `functionMiddleware` へ渡す。1 件の付け忘れが無認証の endpoint になる (ADR-0011)
- 型付きの context を得る目的で個々の `createServerFn` へ `.middleware()` を足さない。global の値は `.middleware()` なしでも型付きで読め、global の方が先に走る (ADR-0011)
- 認可の base builder は、ロールによる出し分けが要るようになった時点で足す。先に置くと守る対象の無い装置になる (ADR-0011)

## ファイルの置き場所と名前

| 対象                                   | 置き場所                                   |
| -------------------------------------- | ------------------------------------------ |
| 1 つのドメインに属する server fn       | `src/features/<domain>/functions.ts`       |
| その実処理                             | `src/features/<domain>/handlers.server.ts` |
| ドメインに属さない server fn と helper | `src/server/` 直下                         |

- 実処理のファイル名に `.server.` を必ず入れる。既定の遮断はファイル名パターンだけなので、`src/server/db/` を引かない実処理 (外部 API や secret だけを扱うもの) は接尾辞を落とすと client から import できてしまう (ADR-0012)
- `createServerFn` の宣言と実処理を 1 ファイルにまとめない。実処理を server function を経由せず単体テストできる側に残すため (ADR-0012)
