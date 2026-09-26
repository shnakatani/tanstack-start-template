# テンプレートから始めたときの手順

テンプレートから始めた直後に一度だけ要る手順をまとめた。
すべて済んだら、この文書ごと消す。ずっと使う情報は `README.md` が持つ。

## 1. リポジトリを作る

GitHub のリポジトリごと作るなら `gh repo create --template` を使う。元の履歴は引き継がない。

```bash
gh repo create my-app --template shnakatani/tanstack-start-template --private --clone
```

リモートを作らずファイルだけ要るなら `vp create` を使う。`.git` は作られない。

```bash
vp create github:shnakatani/tanstack-start-template
```

作ったら `README.md`「環境を用意する」を済ませる。

## 2. 名前を置換する

```bash
grep -rn "tanstack-start-template" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.output .
```

grep に出ないものが 1 つある。画面の見出しと head の `title` が参照する `src/lib/app-name.ts` の `APP_NAME` (`TanStack Start Template`)。

## 3. サンプル機能を残すか決める

動作確認用にメモの一覧・作成・削除 (`/notes`) が入っている。本体は `src/features/notes/` と `src/routes/notes/` の 2 ディレクトリ。その外に散っているものも含めた全対象は `grep -rln notes src/ drizzle/` で出る。

削除ではなく差し替えが要るのは 2 ファイル。

| ファイル                                    | 差し替え先                                                            |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `src/server/db/index.test.ts`               | 疎通ケースを自プロジェクトのテーブルへ                                |
| `src/components/parts/button-link.test.tsx` | `to="/notes"` を残す側のパスへ (`to` は routeTree に実在するパスだけ) |

消したあとは `mise run db:generate` で migration を作り直す。

## 4. 差し替え口を埋める

| 対象     | 差し替え点                                                                                        | 手順                                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB       | `src/server/db/index.ts` の `createDb` (接続) と `drizzle.config.ts` (dialect と schema / 出力先) | `createDb` の import を移行先のドライバ (`drizzle-orm/d1` / `drizzle-orm/libsql` など) へ替える。`src/server/db/schema.ts` と `drizzle/` はそのまま使える |
| 認証     | `src/start.ts` の `functionMiddleware` と `src/routes/_authed.tsx` の `beforeLoad`                | 両方を埋める。決定とコード例は ADR-0012                                                                                                                   |
| デプロイ | `vite.config.ts` の `nitro()` の `preset`                                                         | 選定理由を ADR へ記録してから `preset` を渡す                                                                                                             |

## 5. 引き継いだ決定を見直す

`docs/decisions/` の ADR、`docs/guides/` のガイド、`.claude/rules/` は、このテンプレートの前提で下した判断をそのまま持っている。
前提が違うものは、ADR を `Superseded` にするか、ガイドと rules を書き換えてから実装に入る。
