# server function

server function に認可を足すときと、ユーザー入力で検索を組むときの手順を持つ。

| 決定                                                                         | ADR      |
| ---------------------------------------------------------------------------- | -------- |
| server function をデータ境界とし、全 fn 共通の middleware は global に載せる | ADR-0012 |

## how-to

### 認可を足す

認証は `src/start.ts` の global middleware に載せ、全 server function に通す (ADR-0012)。認可はその上に、要るようになった時点で次の順で足す。

1. `createServerFn` を包む base builder を作り、認可の middleware を載せる。認証への依存を明示したいなら `.middleware([authMiddleware])` で chain する
2. 認可の付け忘れを lint で止めるなら、`createServerFn` の直接の import を禁じる。適用範囲は `src` 全体 (`.ts` と `.tsx`) にする。server function は route ファイルでも宣言できるので、server function のディレクトリに絞ると、宣言を 1 つ外へ移すだけで迂回できる
3. 一律の禁止は base builder 自身の定義ファイルも落とす。`overrides` の `excludeFiles` でそのファイルだけを外す (2026-09-06 に実測)

### ユーザー入力で部分一致の検索を組む

- 呼び出し側はパターンと `ESCAPE` を手で組まず、`src/server/db/like-pattern.ts` の `likeContains` を使う。エスケープと `ESCAPE` 句を対で渡すことを忘れた検索は、`%` が効き `\` が消えて黙って壊れる
- 検証は実 SQLite (`:memory:`) で行い、`%` / `_` / `\` を含む検索語、ASCII の大文字小文字、日本語を見る。エスケープの純粋関数だけを単体で見ると、`ESCAPE` 句との対応が抜けても通る
