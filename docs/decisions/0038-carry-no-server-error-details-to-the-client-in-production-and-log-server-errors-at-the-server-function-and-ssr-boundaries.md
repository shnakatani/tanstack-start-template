# ADR-0038: server で起きた例外は production では client へ運ばず、server のログには server function と SSR の 2 つの口で残す

- Status: Accepted
- Date: 2026-10-01
- 関連: ADR-0012 (server function の例外のログを global の middleware に置く)、ADR-0013 (読み出しの検証の文言に DB の値を載せない)

## Context

server で起きた 1 つの例外は、server のログ・client への応答・画面の 3 か所へ行く。TanStack Start の既定の構成では、3 か所それぞれに次の欠けがある。

| 行き先          | 既定の構成で起きること                                                                                                                                                                                                                                                                                                                                                                                                          | 欠け                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| client への応答 | 組み込みの `ShallowErrorPlugin` が Error の `message` を残して直列化する (router-core 1.171.32 の `dist/esm/ssr/serializer/ShallowErrorPlugin.js`)。production でも同じで、server function の応答と SSR の HTML (dehydrate) の両方に載る。TanStack Start docs「Server Functions」の Basic Errors も "Errors are serialized to the client" と書く                                                                                | アプリが投げた文言と SQLite の文言が client へ届く (下の「client へ届く文言」)                                                                                     |
| server のログ   | SSR の読み込み (validateSearch・beforeLoad・loader) の例外は route の `onError` に渡るだけで、console に出ない (router-core 1.171.32 の `dist/esm/load-server.js`。`validateSearch` の失敗は `matchRoutes` が match の `searchError` に持たせ、`load-server.js` が同じく `onError` に渡す)。server では errorComponent を throw せずに描く (react-router 1.170.39 の `dist/esm/Match.js`) ので、React の `onError` にも届かない | SSR の読み込みで server function を通さずに投げた例外 (`validateSearch` の失敗など) がどこにも残らない。server function の中の例外は ADR-0012 の middleware が残す |
| 画面            | client で復元した Error の stack は、復元した位置を指す。開発サーバーでは `ShallowErrorPlugin.deserialize` を指した (2026-10-01 に観測)                                                                                                                                                                                                                                                                                         | 画面に stack を出しても発生元を示さない                                                                                                                            |

### client へ届く文言

| 文言の出どころ          | 例                                                                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| アプリが投げる例外      | `削除対象のノートが見つかりません: id=42`、読み出しの検証が失敗した項目の位置と件数 (`src/features/notes/handlers.server.ts`)                                                       |
| SQLite (better-sqlite3) | `no such table: notes`、`NOT NULL constraint failed: notes.title`。テーブル名と列名を含む (better-sqlite3 13.0.3、2026-10-01 に実測)                                                |
| router                  | `validateSearch` の失敗で投げる `SearchParamError` の文言は valibot の issues の JSON で、検索の入力値 (`"input": 123`) を含む (開発サーバーの `/notes?q=123` で 2026-10-01 に観測) |

drizzle の `DrizzleQueryError` は、文言に SQL と params を入れる (`Failed query: <SQL>` と `params: <params>`、drizzle-orm 0.45.3 の `errors.js`)。このテンプレートの driver では、この例外は起きない。

| driver                                                         | 例外の扱い                                                                                                                                      | 確かめ方                                      |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `drizzle-orm/better-sqlite3` (`src` が使う唯一の driver)       | better-sqlite3 の例外を包まずに投げる。drizzle-orm 0.45.3 の `better-sqlite3/session.js` に `queryWithCache` と `DrizzleQueryError` は 0 件     | 本番ビルドで 2026-10-01 に実測 (下の「実測」) |
| libsql・d1・sqlite-proxy・op-sqlite                            | 各 `session.js` が `.queryWithCache(` を呼び、同じ版の `sqlite-core/session.js` の `queryWithCache` (38-100 行目) が `DrizzleQueryError` に包む | ソースを読んだだけで、実測していない          |
| bun-sqlite・durable-sqlite・expo-sqlite・sql-js・prisma/sqlite | better-sqlite3 と同じく `.queryWithCache(` を呼ばない                                                                                           | ソースを読んだだけで、実測していない          |

表の 2 行目の driver に替えると、SQL と params が例外の文言に入る。各 `session.js` の `.queryWithCache(` の件数は、`node_modules/drizzle-orm/*/session.js` の 1 階層と `node_modules/drizzle-orm/prisma/sqlite/session.js` について `grep -c '\.queryWithCache(' <session.js のパス>` で数えた (2026-10-01)。

### 公式の設定と先行例

- `createStart` に文言を隠す設定は無い。options は `serializationAdapters` / `defaultSsr` / `requestMiddleware` / `functionMiddleware` / `serverFns` の 5 つ (start-client-core 1.170.32 の `dist/esm/createStart.d.ts`)
- Start の docs に `serializationAdapters` の節は無い (TanStack/router の `docs/start/framework/react/guide/` の 37 本を 2026-10-01 に検索)。文書化は TanStack/router#7796 (open) が追う
- TanStack Start docs「Production Checklist」は "confirm the error interface offers recovery without leaking sensitive details" と求めるが、仕組みは示さない
- TanStack には、server で捕まえた例外がすべて届く口が無い。Router 全体の `defaultOnError` は TanStack/router#8495 (2026-09-25 に起票、返信なし) の要望の段階にある。`defaultOnCatch` は Router の ErrorBoundary が捕まえた例外の handler で、`componentDidCatch` からしか呼ばれない (react-router 1.170.39 の `dist/esm/CatchBoundary.js`)

他のフレームワークは、server を出る境界で例外の中身を一括して差し替え、server の例外を受ける口を 1 つ持つ。OWASP も同じ形を勧める。

| 出典                          | client への応答                                                                                                                                                                                | server の例外を受ける口                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| React Router (Framework Mode) | production のビルドでは、server の例外を browser へ送る前に sanitize する ("The original error is untouched on the server.")                                                                   | `handleError` ("This function is called whenever React Router catches an error in your application on the server.") |
| Next.js                       | Server Components の例外は "a generic message with an identifier" になる。開発中は元の例外の `message` を含める                                                                                | `instrumentation.js` の `onRequestError`                                                                            |
| SvelteKit                     | unexpected error は `{ "message": "Internal Error" }` の形になる ("unexpected error messages and stack traces are not exposed to users")                                                       | `handleError` ("Unexpected errors will go through the handleError hook")                                            |
| OWASP                         | "a generic response is returned by the application but the error details are logged server side for investigation, and not returned to the user." ASP.NET Core の例は DEV 以外でだけ有効にする | global error handler                                                                                                |

### 実測

2026-10-01 に、この ADR の決定どおりに組んだテンプレートを動かして測った。

- 起動: 本番ビルド (`vp build` の後に `node .output/server/index.mjs`) と開発サーバー (`mise run serve`)
- 本番ビルドの `DB_FILE_NAME`: テーブルの無い空の SQLite、migration を当てて INSERT を trigger で失敗させる SQLite、存在しないパスの 3 つを順に渡した
- 版: @tanstack/react-start 1.168.58、@tanstack/react-router 1.170.39、@tanstack/router-core 1.171.32、@tanstack/start-client-core 1.170.32、@tanstack/start-server-core 1.169.37、seroval 1.6.4、react / react-dom 19.3.0、nitro 3.0.260610-beta、drizzle-orm 0.45.3、better-sqlite3 13.0.3、vite-plus 1.0.0、Node.js v24.21.0

| 確かめたこと                                  | 観測                                                                                                                                                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/notes` の SSR の HTML (status 500)          | 元の文言 (`no such table`) は 0 件。dehydrate の match の error と TanStack Query の error は、どちらも adapter で差し替えた値 (`$_TSR.t.get("server-error")`) を指す。画面は固定文言          |
| 一覧の server function の応答 (status 200)    | 例外は `"c":"$TSR/t/server-error"` の空のオブジェクト。client は `SERVER_ERROR_MESSAGE` の Error に復元し、pageerror と hydration の警告は 0 件                                                |
| `/notes` を直接開いて hydration する          | dehydrate の差し替えた値を client が復元し、pageerror と hydration の警告は 0 件                                                                                                               |
| 作成の server function の応答 (INSERT の失敗) | 元の文言 (`measure: forced insert failure`)・入力値・`insert into` はどれも載らない。toast は固定文言                                                                                          |
| server のログ                                 | 読み出しの失敗は `SqliteError: no such table: notes`、書き込みの失敗は `SqliteError: measure: forced insert failure` のまま残る。`Failed query`・`params:`・入力値・`[cause]` はどちらにも無い |
| `/notes?q=123` (`validateSearch` の失敗)      | `[ssr] /notes/ SearchParamError` が 1 行増え、`[server fn]` の行は増えない。HTML に schema の文言は 0 件                                                                                       |
| DB のファイルが無い                           | `[server fn] listNotes` と `[ssr] /notes/` の行に `[db] DB のファイルが無い (<絶対パス>)` が出る。`[db]` で始まる単独の行は 0 件。HTML にパスは 0 件                                           |
| 存在しない URL                                | status 404。HTML の `server-error` は 0 件で、ログは増えない                                                                                                                                   |
| ビルド成果物                                  | 判定の関数は server と client の両方の bundle で `false` を返す関数に置き換わる。adapter は両方の bundle に入る                                                                                |
| 開発サーバー                                  | 画面に元の文言が出て、stack の表示は無い。pageerror と hydration の警告は 0 件。応答と SSR の dehydrate では `serverErrorAdapter` が message を運ぶ (`$TSR/t/server-error`)                    |

例外が起きた場所ごとの server のログは次のとおり。

| 例外が起きた場所                                                                            | 残すもの                                                         | 行数   | 根拠                                                                                                                                       |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| server function (client から HTTP で呼ばれた)                                               | `src/start.ts` の `logServerFnErrors`                            | 1      | 2026-10-01 に実測                                                                                                                          |
| server function (SSR の loader から呼ばれた)                                                | `logServerFnErrors` と `src/server.ts`                           | 2      | 2026-10-01 に実測                                                                                                                          |
| server function の中から呼んだ server function                                              | `logServerFnErrors` (内側と外側)                                 | 2      | @tanstack/react-start 1.168.49、2026-09-29 に実測                                                                                          |
| SSR の読み込み (validateSearch・beforeLoad・loader) で server function を通さずに投げた例外 | `src/server.ts`                                                  | 1      | 2026-10-01 に `validateSearch` の失敗で実測                                                                                                |
| SSR の描画中の throw                                                                        | TanStack の `console.error` (`Error in renderToReadableStream:`) | 未実測 | react-router 1.170.39 の `dist/esm/ssr/renderRouterToStream.js` を読んだ。`/notes` は loader が先に query を待つので、描画中には失敗しない |
| route の `head()` の throw                                                                  | TanStack の `console.error`                                      | 未実測 | router-core 1.171.32 の `dist/esm/load-server.js` を読んだ                                                                                 |
| Start の外へ抜けた例外 (request middleware の throw、handler callback の throw)             | h3 の `console.error` (unhandled の `HTTPError`)                 | 未実測 | h3 2.0.1-rc.20 の `dist/h3-Bz4OPZv_.mjs` の `prepareResponse` (220-227 行目) を読んだ。Error でない値は残らない                            |
| client で起きた例外 (遷移後の loader と描画で、server function を通さないもの)              | server には残らない。React がブラウザの console に出す           | —      | react.dev「hydrateRoot」。2026-10-01 にブラウザの console で観測                                                                           |

## Decision

**server で起きた例外は、production では元の文言を持たない Error として client へ運ぶ。server のログには、server function の例外を global の function middleware で、SSR の読み込みで error になった route の例外を server entry で残す。同じ例外が 2 つの口で 2 行になる場合は受け入れる。**

| 項目                     | 決定                                                                                                                                                                                                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 詳細を出す環境           | DEV は例外の文言を client と画面に出し、production は出さない。判定は 1 つの関数 (`src/lib/server-error-exposure.ts`) にまとめ、値はビルド時に置き換わる `import.meta.env.DEV`                                                                                                                                                             |
| client への応答          | `createStart` の `serializationAdapters` (`src/start.ts`) に、Error とそのサブクラスを掴む adapter (`serverErrorAdapter`) を DEV でも production でも 1 つ登録する。production では直列化で元の文言を落とし、client は `SERVER_ERROR_MESSAGE` の Error に復元する。DEV では文言を運ぶ。どちらにするかは adapter が判定の関数を読んで決める |
| server で描く HTML       | errorComponent (`src/components/screens/route-error.tsx`) が、production では固定文言、DEV では例外の文言を出す                                                                                                                                                                                                                            |
| stack の表示             | 画面に出さない。DEV でも出さない                                                                                                                                                                                                                                                                                                           |
| server function のログ   | global の function middleware (`src/start.ts`) が残す (ADR-0012)                                                                                                                                                                                                                                                                           |
| SSR のログ               | custom server entry (`src/server.ts`) の handler callback が、描画の前に `ctx.router.state.matches` のうち `status === "error"` の match の error を `[ssr] <routeId>` で `console.error` する                                                                                                                                             |
| ログの重複               | SSR の loader から呼んだ server function の例外は 2 行出る。受け入れ、同じオブジェクトを 1 回だけ出す仕組みは持たない                                                                                                                                                                                                                      |
| 例外の文言に載せないもの | 秘密と個人情報 (DB の行の値、ユーザーの入力)。文言は server のログに残り、DEV では画面にも出る。パスと id は載せてよい                                                                                                                                                                                                                     |

- 文言の差し替えとログを 1 本の ADR で決めるのは、互いに前提だからである。production では client に例外の文言が届かないので、原因は server のログにしか残らない。OWASP Error Handling Cheat Sheet の global error handler も、generic response と server 側のログを 1 つの仕組みで持つ (Context の先行例の表)
- 判定を 1 つの関数にまとめるのは、server で描く errorComponent が adapter を通らない生の Error を受けるためである (`Match.js` の server の分岐)。HTML に文言を入れるかは errorComponent が決めるので、adapter と errorComponent の判定が食い違うと、server の HTML と client の描画が食い違って hydration がずれる。1 つにまとめる形は自前の発案である
- stack を画面に出さないのは、画面の stack が console と server のログ以上の情報を持たないためである。client で起きた例外の stack は React が既定でブラウザの console に出す (react.dev「hydrateRoot」)。server で起きた例外の stack は、client では復元した位置を指し、発生元の stack は server のログにある
- 例外の文言に載せないものを決めるのは、production でも文言が server のログに残るためである。TanStack Start docs「Observability」の Security Considerations は "Never log sensitive data (passwords, tokens, PII)" と書く

### 検討した選択肢

#### 差し替えの口

経路ごとに、各口が例外の文言を覆えるかは次のとおり。server function の応答と SSR の dehydrate の行は、adapter の列を 2026-10-01 に実測した。function middleware の列は、middleware が server function の実行だけを包むことからの帰結である。

| 経路                                                                            | adapter で差し替える                                                                                                                                                   | function middleware で汎用の Error に投げ直す                    | 根拠                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| server function の応答                                                          | 覆える                                                                                                                                                                 | server function の中の例外だけ覆える                             | 表の上の文                                                                                                                                                                                                                                                                                                                                                                                                |
| SSR の dehydrate (match の error、TanStack Query の dehydrate)                  | 覆える                                                                                                                                                                 | server function 由来だけ覆える。loader の自前の throw は覆えない | 表の上の文                                                                                                                                                                                                                                                                                                                                                                                                |
| server で描く errorComponent                                                    | 覆えない (生の Error を受ける)                                                                                                                                         | server function 由来なら覆える                                   | `Match.js` の server の分岐                                                                                                                                                                                                                                                                                                                                                                               |
| SSR の描画中の throw                                                            | 覆えない (React が扱う。DEV のビルドは HTML へ文言を出す)                                                                                                              | 覆えない                                                         | 下の「受け入れる残りの穴」                                                                                                                                                                                                                                                                                                                                                                                |
| RawStream のエラーフレーム                                                      | 覆えない (message をバイト列へ直接書く)                                                                                                                                | 覆えない                                                         | start-server-core 1.169.37 の `dist/esm/frame-protocol.js` の `encodeErrorPayload`                                                                                                                                                                                                                                                                                                                        |
| Error でない値の throw                                                          | 覆えない (adapter は `instanceof Error` だけを掴む)                                                                                                                    | —                                                                | `src/lib/server-error-exposure.ts`                                                                                                                                                                                                                                                                                                                                                                        |
| route の `head()` の throw                                                      | 差し替えるものが無い。router が `console.error` で残して握りつぶし、match の error にしないので client へ運ばれない                                                    | —                                                                | ソースを読んだだけ。router-core 1.171.32 の `dist/esm/load-server.js` の `projectLane` (382-398 行目)                                                                                                                                                                                                                                                                                                     |
| Start の外へ抜けた例外 (request middleware の throw、handler callback の throw) | 通らない。Error は h3 が unhandled の `HTTPError` に包み、応答の文言を `"HTTPError"` に置き換える。Error でない値はこの分岐に入らない (「Error でない値の throw」の行) | 覆えない (server function の実行の外)                            | ソースを読んだだけ。start-server-core 1.169.37 の `dist/esm/request-response.js` の `requestHandler` (34-48 行目) が、例外を h3 2.0.1-rc.20 (start-server-core が `h3-v2` の名前で使う版) の `toResponse` に渡す。h3 の `dist/h3-Bz4OPZv_.mjs` の `prepareResponse` (214-231 行目) が `unhandled` を立てた `HTTPError` に包み、`HTTPError` の `toJSON` (158-168 行目) が文言を `"HTTPError"` に置き換える |

| 案                                                                                                                   | 評価                                                                                                                                                               | 採否     |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| adapter で一括して差し替える                                                                                         | 覆う経路が最も広く、仕組みは 1 つ。組み込みより先に効く順序は実装に依る (Consequences)                                                                             | **採用** |
| 上に加えて、function middleware でも汎用の Error に投げ直す                                                          | 並びが変わっても server function 由来の例外は守られる。仕組みが 2 つになり、SSR の loader とログが受ける例外も汎用になる (元の例外を `cause` に持たせる工夫が要る) | 却下     |
| 各 handler で catch して残し、汎用の Error を投げる (TanStack Start docs「Observability」の Error Boundaries 節の形) | fn ごとに書くので、書き忘れた fn が穴になる。loader の自前の throw を覆えない                                                                                      | 却下     |

#### DEV の扱い

| 案                                                                                 | 評価                                                                                                                                                         | 採否     |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| adapter を DEV でも登録し、文言を運ぶかを adapter の中で判定の関数を読んで決める   | plugin の並びが環境によらず同じになる。利用者が adapter を足す手順に環境の条件が入らず、並べ方の誤り (`serverErrorAdapter` の後ろに置く) が DEV でも再現する | **採用** |
| DEV では adapter を登録せず、組み込みの `ShallowErrorPlugin` に message を運ばせる | 並びが環境で変わる。利用者の adapter を環境の条件の外に置く規範が要り、並べ方の誤りは DEV では起きずに production で初めて文言が落ちる形で出る               | 却下     |

#### SSR の例外を残す口

| 口                                                                           | 評価                                                                                                                                                                                                                                                          | 採否     |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| custom server entry の handler callback で `ctx.router.state.matches` を読む | 1 か所で全 route の読み込み (validateSearch・beforeLoad・loader) の例外を拾える。部品は公式 (TanStack Start docs「Server Entry Point」の Custom Server Handlers)。`matches` の読み方は docs「Observability」の New Relic の例と同じ。ログに使うのは自前の発案 | **採用** |
| route の `onError`                                                           | 例外が起きた route の `onError` だけが呼ばれる (`load-server.js`)。全 route に書くことになる                                                                                                                                                                  | 却下     |
| `defaultOnCatch` / route の `onCatch`                                        | `componentDidCatch` からしか呼ばれない。server では errorComponent を throw せずに描くので、呼ばれない                                                                                                                                                        | 却下     |
| request middleware の try/catch                                              | 読み込み (validateSearch・beforeLoad・loader) の例外は router が match の error に変えて描画へ進むので、throw として届かない                                                                                                                                  | 却下     |
| nitro の error hook                                                          | request middleware と同じ理由で、throw として届かない                                                                                                                                                                                                         | 却下     |
| adapter の中でログを出す                                                     | 直列化の中に副作用を置くことになる。adapter は値しか受けないので、どの server function・route で起きたかが分からない                                                                                                                                          | 却下     |

#### ログの重複

Sentry は同じ形を取り、重複を SDK で落とす。

- TanStack Start SDK は、global の function middleware で例外を捕まえて投げ直す (`getsentry/sentry-javascript` の `packages/tanstackstart-react/src/server/globalMiddleware.ts`)
- sentry-docs は "SSR rendering exceptions are not captured by the middleware." と、middleware の外の穴を認める
- 複数の口で受けた同じ例外は、SDK 本体が同じオブジェクトに印を付けて落とす (`packages/core/src/utils/misc.ts` の `checkOrSetAlreadyCaught`: "The client runs this check for every captured exception")

| 案                                                           | 評価                                                                                                       | 採否     |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | -------- |
| 重複を受け入れる                                             | 2 つの口が独立したまま。`console.error` を報告ツールへ置き換えれば、ツールが同じオブジェクトの重複を落とす | **採用** |
| 2 つの口で WeakSet を共有し、同じオブジェクトを 1 回だけ出す | テンプレートが持つ仕組みが 1 つ増える。報告ツールへ置き換えたときは、ツールの重複排除と役目が重なる        | 却下     |

## Consequences

- production では、server function の応答と SSR の dehydrate で client へ運ぶ Error は、`SERVER_ERROR_MESSAGE` の Error として届く。Error でない値の throw など、この形で届かないものは下の「受け入れる残りの穴」の表に挙げる。画面と toast は固定文言を出し、原因は server のログで追う
- ユーザーに見せる文言を持つ例外を足すときは、専用の adapter を `src/start.ts` の `serializationAdapters` で `serverErrorAdapter` (`src/lib/server-error-exposure.ts`) より前に並べる。seroval は plugin を並びの先頭から試し、最初に当たったものを使う。同期・非同期・stream の 3 つの直列化のどれでも同じである (seroval 1.6.4 の `dist/index.js` の `parsePluginSync` (2506 行目)・`parsePlugin$1` (非同期、966 行目)・`parsePluginStream` (2512 行目))
- driver を Context の driver の表の 2 行目のもの (libsql・d1・sqlite-proxy・op-sqlite) に替えると、SQL と params を含む `DrizzleQueryError` の文言が server のログに残る (ソースを読んだ結果)。production の client には届かない
- 自分のコードが投げない例外の文言は、この ADR の「例外の文言に載せないもの」の外にある。router の `SearchParamError` は検索の入力値を含んだまま server のログに残る (2026-10-01 に観測)

### 受け入れる残りの穴

| 穴                                                                                    | 受け入れる理由                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RawStream のエラーフレーム                                                            | テンプレートは RawStream を使わない (`git grep -n RawStream -- src \| wc -l` が 0、2026-10-01)                                                                                                                                                                  |
| Error でない値の throw                                                                | 自分のコードは lint の `typescript/only-throw-error` (redirect と notFound だけを許す) と、`Promise.reject` に Error でない値を渡すのを禁じる `typescript/prefer-promise-reject-errors` が止める (`tooling/lint/config.ts`)。残るのはライブラリが投げる場合だけ |
| SSR の描画中の throw で、React の DEV ビルドが HTML に埋める `data-msg` / `data-stck` | DEV だけ。react-dom 19.3.0 の `cjs/react-dom-server.node.development.js` は境界の `errorMessage` に例外の message と stack を入れ、`.production.js` は `errorMessage` を持たない                                                                                |

### adapter が組み込みより先に効く順序

docs に保証は無く、実装の並びと上流の e2e に依る。

| 根拠       | 中身                                                                                                                                                                                                                                                                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 実装       | start-client-core 1.170.32 の `dist/esm/getDefaultSerovalPlugins.js` は `[...adapters.map(makeSerovalPlugin), ...routerPlugins]` を返す。router-core 1.171.32 の `dist/esm/ssr/ssr-server.js` も adapter を `ssrSerovalPlugins` の前に並べる                                                                                                        |
| 上流の e2e | TanStack/router の `e2e/react-start/serialization-adapters/tests/app.spec.ts` の `custom error` は、Error のサブクラスの独自プロパティ (`"foo":"bar"`) が client に届くことを確かめる。adapter が先に効かなければ `ShallowErrorPlugin` が落とすので、このテストは通らない。server function の経路だけで、同じファイルの SSR の節は Error を扱わない |

- TanStack を上げるときは、本番ビルドで確かめる。テーブルの無い空の SQLite を `DB_FILE_NAME` に渡して `node .output/server/index.mjs` を起動し、`/notes` の SSR の HTML と一覧の server function の応答に元の文言 (`no such table`) が無く、`server-error` の印があることを見る
- 一覧の server function の応答は、`/` を開いて hydration の完了を待ってから「メモ一覧へ」を押し、`/_serverFn/` の応答の本文で見る。本文に `$TSR/t/server-error` があり、元の文言が無いことを確かめる。完了は `self.$_TSR` が消えたことで見る (router-core 1.171.32 の `dist/esm/ssr/tsrScript.js` は、hydration と stream の終わりの両方が済んだときに消す)。待たずに押すと `/notes` が文書として読み込まれ、server function の応答を拾えないことがある (開発サーバーで 2026-10-01 に観測)
- 並びを固定する常設の検査は置かない。plugin の列を自分で組むテストでは、上流の並びの変化を検出できない

### 再評価の条件

- TanStack に server の例外を 1 か所で受ける口 (Router の `defaultOnError` など) が入ったら、`src/server.ts` と `logServerFnErrors` をそちらへ寄せる
- Start の docs に `serializationAdapters` と組み込みの直列化の並びが書かれたら、上の「adapter が組み込みより先に効く順序」を docs の記述で置き換える

## 出典

2026-10-01 に原文を開いて照合した。docs の文は公開ページで、GitHub のファイル・issue・discussion は既定のブランチで確かめた。

- TanStack Start docs「Observability」(Error Boundaries 節の handler で catch して投げ直す形、New Relic の `ctx.router?.state?.matches`、Security Considerations の "Never log sensitive data (passwords, tokens, PII)"): <https://tanstack.com/start/latest/docs/framework/react/guide/observability>
- TanStack Start docs「Production Checklist」("confirm the error interface offers recovery without leaking sensitive details"): <https://tanstack.com/start/latest/docs/framework/react/guide/production-checklist>
- TanStack Start docs「Server Entry Point」(Custom Server Handlers): <https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point>
- TanStack Start docs「Server Functions」(Basic Errors の "Errors are serialized to the client"): <https://tanstack.com/start/latest/docs/framework/react/guide/server-functions>
- TanStack Router docs `RouterOptionsType` の `defaultOnCatch` ("The default `onCatch` handler for errors caught by the Router ErrorBoundary"): <https://tanstack.com/router/latest/docs/api/router/RouterOptionsType>
- TanStack Router docs `RouteOptionsType` の `onError` ("called when an error is thrown during a navigation or preload event") と `onCatch`: <https://tanstack.com/router/latest/docs/api/router/RouteOptionsType>
- TanStack/router#7796 (Start の `serializationAdapters` の文書化。"Start now supports `serializationAdapters` through `createStart`, and applies them to SSR hydration and server-function serialization."): <https://github.com/TanStack/router/issues/7796>
- TanStack/router#8495 (`defaultOnError` の要望): <https://github.com/TanStack/router/discussions/8495>
- 上流の e2e `custom error` と `CustomError`: <https://github.com/TanStack/router/blob/main/e2e/react-start/serialization-adapters/tests/app.spec.ts> / <https://github.com/TanStack/router/blob/main/e2e/react-start/serialization-adapters/src/CustomError.ts>
- Sentry の TanStack Start SDK の global middleware: <https://github.com/getsentry/sentry-javascript/blob/develop/packages/tanstackstart-react/src/server/globalMiddleware.ts>
- Sentry SDK の `checkOrSetAlreadyCaught`: <https://github.com/getsentry/sentry-javascript/blob/develop/packages/core/src/utils/misc.ts>
- sentry-docs の TanStack Start の Manual Setup ("SSR rendering exceptions are not captured by the middleware."): <https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/manual-setup/>
- React Router docs「Error Boundaries」の Error Sanitization: <https://reactrouter.com/how-to/error-boundary>
- React Router docs「Error Reporting」の `handleError`: <https://reactrouter.com/how-to/error-reporting>
- Next.js docs `error.js` の `error.message` (開発中の挙動は同じ節の Good to know): <https://nextjs.org/docs/app/api-reference/file-conventions/error>
- Next.js docs `instrumentation.js` の `onRequestError`: <https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation>
- SvelteKit docs「Errors」の Unexpected errors (公開ページで照合): <https://svelte.dev/docs/kit/errors>
- OWASP Error Handling Cheat Sheet の Objective と ASP.NET Core の例 ("We enable the global error handler in others environments than DEV"): <https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html>
- react.dev `hydrateRoot` ("By default, React will log all errors to the console."。`createRoot` にも同じ文がある。Start の既定の client entry は `hydrateRoot` を使う): <https://react.dev/reference/react-dom/client/hydrateRoot>
