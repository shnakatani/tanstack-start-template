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

## 3. サンプル機能

動作確認用のメモ機能 (`/notes`) が入っている。本体は `src/features/notes/` と `src/routes/notes/`。

## 4. 差し替え口を埋める

| 対象     | 差し替え点                                                                                 | 手順                                                                                                                                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB       | `src/server/db/index.ts` の接続 (`createDb` と、あれば `migrateDb`) と `drizzle.config.ts` | 接続を移行先のドライバへ替える。better-sqlite3 固有の設定が `vite.config.ts` と `pnpm-workspace.yaml` の `allowBuilds` に残るので外す。`src/server/db/schema.ts` と `drizzle/` はそのまま使える                                                                         |
| 認証     | `src/start.ts` の `createStart` と、新しく作る `src/routes/_authed.tsx`                    | `createStart` に `functionMiddleware` を足して認証の middleware を渡す。`src/routes/_authed.tsx` の `beforeLoad` で未ログインを login へ送り、保護する route を `src/routes/_authed/` の下へ移す (`_` で始まるセグメントは URL に出ない)。両方を埋める。決定は ADR-0012 |
| デプロイ | `vite.config.ts` の `nitro()` の `preset`                                                  | 選定理由を ADR へ記録してから `preset` を渡す                                                                                                                                                                                                                           |

## 5. 引き継いだ決定を見直す

`docs/decisions/` の ADR、`docs/guides/` のガイド、`.claude/rules/` は、このテンプレートの前提で下した判断をそのまま持っている。
前提が違うものは、ADR を `Superseded` にするか、ガイドと rules を書き換えてから実装に入る。

## 6. README を書き換える

`README.md` の冒頭の説明と技術スタックの表は、このテンプレートの説明のまま。自分のプロジェクトの説明と、差し替えた技術に書き換える。

## 7. この文書を消す

この文書と、この文書を指す 3 か所を消す。

- `README.md` の冒頭で `TEMPLATE_SETUP.md` を指す 1 文
- `README.md`「ドキュメント」の表の `TEMPLATE_SETUP.md` の行
- `.claude/rules/docs.md` の `paths` の `TEMPLATE_SETUP.md`
