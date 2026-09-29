# server function

server function に認可を足すとき、例外をログに残すとき、ユーザー入力で検索を組むときの手順と、その形にしている理由を持つ。

| 決定                                                                         | ADR      |
| ---------------------------------------------------------------------------- | -------- |
| server function をデータ境界とし、全 fn 共通の middleware は global に載せる | ADR-0012 |

## explanation

### 認可の lint を src 全体に掛ける理由

server function は route ファイルでも宣言できる。lint の範囲を server function のディレクトリに絞ると、宣言を 1 つ外へ移すだけで迂回できる。

### 部分一致の検索を実 SQLite で確かめる理由

エスケープの純粋関数だけを単体で確かめると、SQL に `ESCAPE` 句を付け忘れても通る。エスケープと `ESCAPE` 句の対応は、実際に SQL を走らせないと確かめられない。

## how-to

### 認可を足す

認証は `src/start.ts` の global middleware に載せ、全 server function に通す (ADR-0012)。認可はその上に、要るようになった時点で次の順で足す。

1. `createServerFn` を包む base builder を作り、認可の middleware を載せる。認証への依存を明示したいなら `.middleware([authMiddleware])` で chain する
2. 認可の付け忘れを lint で止めるなら、`createServerFn` の直接の import を禁じる。適用範囲は `src` 全体 (`.ts` と `.tsx`) にする。理由は「認可の lint を src 全体に掛ける理由」
3. 一律の禁止は base builder 自身の定義ファイルも落とす。`overrides` の `excludeFiles` でそのファイルだけを外す (2026-09-06 に実測)

### 例外を server のログに残す

- server function の例外は、`src/start.ts` の `logServerFnErrors` (global の `functionMiddleware`) が `console.error` で残して投げ直す。本番の画面は例外の文言を出さない (`src/components/screens/route-error.tsx`) ので、原因は server のログにしか残らない
- redirect と notFound は制御のための throw なので残さない
- 個々の server function の中で catch してログを書かない。global の middleware と二重に残る
- middleware で例外を受けてログを残す形は、[TanStack Start docs「Observability」][] の Request/Response Middleware の形に倣う
- server function の外 (描画の途中など) で起きた例外は、この middleware を通らない。function middleware の範囲は server function だけである ([TanStack Start docs「Middleware」][])

### ユーザー入力で部分一致の検索を組む

- 呼び出し側はパターンと `ESCAPE` を手で組まず、`src/server/db/like-pattern.ts` の `likeContains` を使う。エスケープと `ESCAPE` 句を対で渡すことを忘れた検索は、`%` が効き `\` が消えて黙って壊れる
- 検証は実 SQLite (`:memory:`) で行い、`%` / `_` / `\` を含む検索語、ASCII の大文字小文字、日本語を見る。理由は「部分一致の検索を実 SQLite で確かめる理由」

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。

[TanStack Start docs「Observability」]: https://tanstack.com/start/latest/docs/framework/react/guide/observability
[TanStack Start docs「Middleware」]: https://tanstack.com/start/latest/docs/framework/react/guide/middleware
