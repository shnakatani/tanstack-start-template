# server で起きた例外

server で起きた例外を server のログに残し、production では client へ運ばないための手順と、その形にしている理由を持つ。

| 決定                                                                                                              | ADR      |
| ----------------------------------------------------------------------------------------------------------------- | -------- |
| server で起きた例外は production では client へ運ばず、server のログには server function と SSR の 2 つの口で残す | ADR-0038 |
| server function をデータ境界とし、全 fn 共通の middleware は global に載せる                                      | ADR-0012 |

## how-to

### 例外を server のログに残す

例外が起きた場所ごとに、残す口とログの 1 行目は次のとおり。

| 例外が起きた場所                                                                            | 残す口                                                                                        | ログの 1 行目                                       |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| server function (client から呼ばれた)                                                       | `src/start.ts` の `logServerFnErrors` (global の `functionMiddleware`)                        | `[server fn] <関数名>`                              |
| SSR の読み込み (validateSearch・beforeLoad・loader) で server function を通さずに投げた例外 | `src/server.ts` の handler callback から呼ぶ `logSsrMatchErrors` (`src/server/ssr-errors.ts`) | `[ssr] <routeId>`                                   |
| SSR の loader から呼んだ server function                                                    | 上の 2 つ                                                                                     | `[server fn] <関数名>` と `[ssr] <routeId>` の 2 行 |
| SSR の描画中、route の `head()`                                                             | TanStack が `console.error` で出す (ソースを読んだだけ。ADR-0038)                             | 描画中は `Error in renderToReadableStream:`         |
| client (遷移後の loader と描画で、server function を通さないもの)                           | server には残らない。React がブラウザの console に出す ([react.dev「hydrateRoot」][])         | —                                                   |

- server function の例外は `logServerFnErrors` が `console.error` で残して投げ直す。redirect と notFound は残さない。理由は「例外を global の function middleware で残す理由」
- ログの 1 行目の関数名は middleware の引数の `serverFnMeta.name` から取る。`serverFnMeta` は docs のガイドに無く、公開の型 (`ServerFnMeta`) と [TanStack/router#6213][] で入った
- 個々の server function の中で catch してログを書かない。global の middleware と二重に残る
- server function から別の server function を呼ぶと、内側と外側の両方で middleware が走り、同じ例外が 2 回残る (@tanstack/react-start 1.168.49、2026-09-29 に実測)
- SSR の例外は、`src/server.ts` の handler callback が描画の前に `ctx.router.state.matches` のうち `status === "error"` の match を残す。包み方は [TanStack Start docs「Server Entry Point」][] の Custom Server Handlers の形。notFound は 404 のための制御の throw なので残さない
- SSR の loader から呼んだ server function の例外が 2 行になるのは受け入れる。同じ例外を 1 回だけ出す仕組みは足さない (ADR-0038)

### 例外の文言を書く

- 文言に秘密と個人情報 (DB の行の値、ユーザーの入力) を入れない。文言は server のログに残り、DEV では画面にも出る ([TanStack Start docs「Observability」][] の Security Considerations)
- production では直列化で元の文言を落とし、client は `SERVER_ERROR_MESSAGE` (`src/lib/server-error-exposure.ts`) の Error に復元する (ADR-0038)。画面と toast は固定文言を出す
- パスや id は文言に入れてよい。調べるときの手がかりになる (`src/server/db/index.ts` の `createDb()` は開こうとした絶対パスを入れる)
- ユーザーに見せる文言を持つ例外を足すときは、専用の adapter を `src/start.ts` の `serializationAdapters` に `exposesServerErrorDetails()` の条件の外で常に登録して `serverErrorAdapter` より前に並べ、`src/lib/mutation-error.ts` の `curateMutationErrorMessage` に分岐を足す。adapter は並びの先頭から当たるので、後ろに置くと `serverErrorAdapter` が先に掴む。条件の中に並べると DEV で登録されない

### 詳細を出す環境を変える

- 判定は `src/lib/server-error-exposure.ts` の `exposesServerErrorDetails` だけが持ち、値はビルド時に置き換わる `import.meta.env.DEV` を返す。例外の詳細を出すかの判定で `import.meta.env.DEV` を直接読まない
- adapter の登録 (`src/start.ts`) と `src/components/screens/route-error.tsx` がこの関数を読む。環境を変えるときは関数の中身だけを変える
- 片方だけを変えると、server で描く HTML と client の描画が食い違って hydration がずれる。server で描く errorComponent は adapter を通らない生の Error を受けるので、HTML に文言を入れるかは `route-error.tsx` が決める (ADR-0038)
- テストでは `vi.stubEnv("DEV", …)` で切り替える。関数は呼んだ時点で値を読む

## explanation

### 例外を global の function middleware で残す理由

本番の画面は例外の文言を出さない (`src/components/screens/route-error.tsx`)。server で残さないと、原因はどこにも残らない。

| 案                                                                                                                             | 評価                                                                                                                                                         | 採否     |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| global の function middleware で `next()` を try で受けて残し、投げ直す                                                        | 全 server function に 1 か所で効く。handler と validator の例外が届く (@tanstack/react-start 1.168.49、2026-09-29 に実測)                                    | **採用** |
| 個々の server function の handler で catch して残す ([TanStack Start docs「Observability」][] の Server Function Logging の形) | fn ごとに書くので、付け忘れた fn の例外が残らない                                                                                                            | 却下     |
| request middleware で `next()` を try で受ける ([TanStack Start docs「Observability」][] の Request/Response Middleware の形)  | server function の例外は直列化されて HTTP 200 の応答で返り、request middleware には throw として届かない (@tanstack/react-start 1.168.49、2026-09-29 に実測) | 却下     |

redirect と notFound は、画面の遷移や 404 のための制御の throw で、異常ではないので残さない。

production では `serverErrorAdapter` が、client へ運ぶ例外の文言を差し替える (ADR-0038)。

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。

[TanStack Start docs「Observability」]: https://tanstack.com/start/latest/docs/framework/react/guide/observability
[TanStack Start docs「Server Entry Point」]: https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point
[TanStack/router#6213]: https://github.com/TanStack/router/pull/6213
[react.dev「hydrateRoot」]: https://react.dev/reference/react-dom/client/hydrateRoot
