# tanstack-start-template

TanStack Start と Vite+ で組んだ Web アプリケーションの template repository。
バックエンドサービス・認証・デプロイ先は選定しておらず、DB をローカルの SQLite に仮置きしたうえで、それぞれの差し替え口だけを用意してある。

## 技術スタック

| カテゴリ       | 技術                                                            |
| -------------- | --------------------------------------------------------------- |
| フレームワーク | TanStack Start (React 19 + TanStack Router / Query)             |
| フォーム       | TanStack Form                                                   |
| バリデーション | Valibot                                                         |
| UI             | shadcn/ui (`base-vega` style、Base UI ベース) + Tailwind CSS v4 |
| アイコン       | lucide-react                                                    |
| DB             | SQLite (better-sqlite3) + Drizzle ORM                           |
| サーバー       | Nitro (builder は rolldown)                                     |
| ツールチェーン | mise + Vite+ (`vp`)                                             |
| テスト         | Vitest (browser mode は Playwright chromium)                    |
| 最適化         | React Compiler (`oxc-transform-react`)                          |

版の pin は、Node.js と pnpm が `package.json` (`devEngines.runtime` と `packageManager`)、Vite+ 一族が `pnpm-workspace.yaml` の `catalog:` (ADR-0002)。

## 使い始める

### 1. リポジトリを作る

GitHub のリポジトリごと作る。`--template` は template repository の複製なので、元の履歴は引き継がず初期コミット 1 つで始まる。

```bash
gh repo create my-app --template shnakatani/tanstack-start-template --private --clone
```

リモートを作らずファイルだけ要るなら `vp create` を使う。degit で取得するため `.git` は作られない。出力先はリポジトリ名のディレクトリに固定され、`vite.config.ts` の `plugins` は `lazyPlugins(() => [...])` に包み直される。

```bash
vp create github:shnakatani/tanstack-start-template
```

### 2. 環境を用意する

`vp` CLI だけは mise の外に入れる。

```bash
curl -fsSL https://vite.plus | bash
```

以降はリポジトリ直下で実行する。

```bash
mise trust && mise install                        # tasks と環境変数を有効にする
vp install                                        # 依存パッケージ
vp exec playwright install chromium --only-shell  # browser mode 用の chromium
mise run db:migrate                               # drizzle/ の migration を DB へ適用する
mise run serve                                    # dev server
```

- Node.js と pnpm は `vp` が `package.json` から解決して用意する。`mise install` が要るのは tasks と `[env]` のため
- 素の `pnpm` を叩くなら `corepack enable` を一度実行する。Vite+ の shim は `node` / `npm` / `npx` / `corepack` までで `pnpm` を含まない
- chromium は `vp install` では入らない (`playwright` が install スクリプトを持たない)。未取得のまま `vp test run` すると browser project が落ちる
- dev server の port は worktree ごとに変わる。main checkout は 3000、linked worktree は 3001-3999 (`.mise.toml` の `DEV_PORT`)

### 3. 名前を置換する

```bash
grep -rn "tanstack-start-template" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.output .
```

grep に出ないものが 1 つある。画面の見出しと head の `title` が参照する `src/lib/app-name.ts` の `APP_NAME` (`TanStack Start Template`)。

### 4. サンプル機能を残すか決める

動作確認用にメモの一覧・作成・削除 (`/notes`) が入っている。消すなら対象は `grep -rln notes src/ drizzle/` で出る。

削除ではなく差し替えが要るのは 2 ファイル。`src/server/db/index.test.ts` の疎通ケースは自プロジェクトのテーブルへ、`src/components/button-link.test.tsx` の `to="/notes"` は残す側のパスへ替える (`to` は routeTree に実在するパスしか受け付けない)。
消したあとは `mise run db:generate` で migration を作り直す。

### 5. 引き継いだ決定を見直す

`docs/decisions/` の ADR と `.claude/rules/` は、このテンプレートの前提で下した判断をそのまま持っている。
前提が違うものは、ADR を `Superseded` にするか rules を書き換えてから実装に入る。

## コマンド一覧

| コマンド                       | 内容                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------- |
| `mise run serve`               | dev server を起動する                                                             |
| `mise run verify`              | `vp check` → `vp test run` → `vp build` → ヘッダ検査 を順に実行する               |
| `mise run db:generate`         | `src/server/db/schema.ts` から `drizzle/` へ migration を生成する                 |
| `mise run db:migrate`          | `drizzle/` の migration を `DB_FILE_NAME` の DB へ適用する                        |
| `vp test run --project <名前>` | project 単位で実行する。`unit` / `browser` / `checks-integrity` / `scripts-tools` |

`vp` 組み込みコマンドの一覧は `vp help`。コミット前は `vp check --fix`、本番ビルドは `vp build` (出力は `.output/`、起動は `vp run start`)。
`vp <name>` は組み込みコマンド、`vp run <name>` は `package.json` の script か `vite.config.ts` のタスク。同名でも別物になるので実行前に両方を確認する (ADR-0002)。

## 差し替え口

### DB

差し替え点は `src/server/db/index.ts` の `createDb` (接続) と `drizzle.config.ts` (dialect と schema / 出力先) の 2 つ。`src/server/db/schema.ts` と `drizzle/` は共通のまま使える。

- better-sqlite3 は、drizzle-orm 同梱のドライバのうち追加サービスなしでローカルに閉じて動く安定版として選んだ。D1 / libsql へは import を `drizzle-orm/d1` / `drizzle-orm/libsql` へ替えれば移せる
- 出口条件: drizzle-orm が `node:sqlite` を使うドライバを stable に収録したとき。ネイティブビルドを抱える better-sqlite3 を外せるか再評価する (0.45.2 に該当ドライバは無い、2026-08-17 確認)

### 認証

`src/routes/_authed.tsx` を足して `beforeLoad` で判定し、保護する route を `src/routes/_authed/` 配下へ移す。
`_` で始まるセグメントは生成される URL から除かれるため、パスを変えずに階層だけ足せる。

### デプロイ

デプロイ先は Nitro の preset で決まる。`vite.config.ts` の `nitro()` へ `preset` を渡す前に、選定理由を ADR へ記録する。

- `package.json` の `nitro` は `catalog:` ではなく `3.0.260610-beta` を exact pin する。TanStack Start が要求するのが nitro 3 の beta ラインで、`npm view nitro dist-tags` の `latest` も同じ版を指すため
- 出口条件: nitro 3 の stable 版が dist-tag `latest` に載ったとき。`catalog:` へ戻せるか再評価する (pin の規律は ADR-0005)

## ドキュメント

| パス                      | 内容                                                                        |
| ------------------------- | --------------------------------------------------------------------------- |
| `docs/decisions/`         | ADR。決定と却下理由。索引は `docs/decisions/README.md`                      |
| `.claude/rules/`          | 実装時に引く規範。`paths` に一致するファイルを触るときロードされる          |
| `AGENTS.md`               | エージェントへの指示。`CLAUDE.md` は symlink                                |
| `docs/registry-baseline/` | shadcn registry の生成時 baseline。改変と上流 drift の判別に使う (ADR-0006) |
| `docs/superpowers/`       | 設計仕様と実装計画の置き場所                                                |
