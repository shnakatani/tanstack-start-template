# tanstack-start-template

TanStack Start と Vite+ で組んだ Web アプリケーションの template repository。
バックエンドサービス・認証・デプロイ先は選定しておらず、DB をローカルの SQLite に仮置きしたうえで、それぞれ置き換える箇所だけを用意してある。
テンプレートから始めたら、`TEMPLATE_SETUP.md` の手順を済ませてから、その文書ごと消す。

## 技術スタック

| カテゴリ       | 技術                                                             |
| -------------- | ---------------------------------------------------------------- |
| フレームワーク | TanStack Start (React 19 + TanStack Router / Query)              |
| フォーム       | TanStack Form                                                    |
| テーブル       | TanStack Table v9 (headless。shadcn Data Table の構成、ADR-0018) |
| バリデーション | Valibot                                                          |
| UI             | shadcn/ui (`base-vega` style、Base UI ベース) + Tailwind CSS v4  |
| アイコン       | lucide-react                                                     |
| DB             | SQLite (better-sqlite3) + Drizzle ORM                            |
| サーバー       | Nitro (builder は rolldown)                                      |
| ツールチェーン | mise + Vite+ (`vp`)                                              |
| テスト         | Vitest (browser mode は Playwright chromium)                     |
| 最適化         | React Compiler (`oxc-transform-react`)                           |

版の pin は、Node.js と pnpm が `package.json` (`devEngines.runtime` と `packageManager`)、Vite+ 一族が `pnpm-workspace.yaml` の `catalog:` (ADR-0004)。

## 環境を用意する

`vp` CLI だけは mise の外に入れる。

```bash
curl -fsSL https://vite.plus | bash
```

以降はリポジトリ直下で実行する。

```bash
mise trust && mise install                        # tasks と環境変数を有効にする
vp install                                        # 依存パッケージ
vp exec playwright install chromium --only-shell  # vp install では入らない。無いと browser project のテストが落ちる
mise run db:migrate                               # drizzle/ の migration を DB へ適用する
mise run serve                                    # dev server。port は worktree ごとに変わる (.mise.toml)
mise run storybook                                # 部品とデザイントークンのカタログ (docs/guides/storybook.md)
```

## コマンド一覧

| コマンド                       | 内容                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------- |
| `mise run serve`               | dev server を起動する                                                             |
| `mise run verify`              | `vp check` → `vp test run` → `vp build` → ヘッダ検査 を順に実行する               |
| `mise run db:generate`         | `src/server/db/schema.ts` から `drizzle/` へ migration を生成する                 |
| `mise run db:migrate`          | `drizzle/` の migration を `DB_FILE_NAME` の DB へ適用する                        |
| `vp test run --project <名前>` | project 単位で実行する。`unit` / `browser` / `checks-integrity` / `scripts-tools` |
| `vp check --fix`               | コミット前に format・lint・型検査を通す                                           |
| `vp build`                     | 本番ビルド。出力は `.output/`、起動は `vp run start`                              |

`vp <name>` は組み込みコマンド (一覧は `vp help`)、`vp run <name>` は `package.json` の script か `vite.config.ts` のタスクで、同名でも別物になる (ADR-0004)。

## ドキュメント

| パス                          | 内容                                           |
| ----------------------------- | ---------------------------------------------- |
| `TEMPLATE_SETUP.md`           | テンプレートから始めた直後の手順               |
| `docs/decisions/`             | ADR                                            |
| `docs/guides/`                | 設計ガイド                                     |
| `docs/registry-baseline/`     | shadcn registry の生成時の baseline (ADR-0020) |
| `docs/registry-deviations.md` | baseline から動かした行の台帳 (ADR-0020)       |
