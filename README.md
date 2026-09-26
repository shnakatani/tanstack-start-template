# tanstack-start-template

TanStack Start と Vite+ で組んだ Web アプリケーションの template repository。
バックエンドサービス・認証・デプロイ先は選定しておらず、DB をローカルの SQLite に仮置きしたうえで、それぞれの差し替え口だけを用意してある。
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

| パス                          | 内容                                                                                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/decisions/`             | ADR。決定と却下理由。索引は `docs/decisions/README.md`                                                                                                                                                        |
| `docs/guides/`                | 設計ガイド。部品をまたぐ作法の説明と、その作法で組む手順・落とし穴への対処。主題の一覧は `docs/guides/README.md`                                                                                              |
| `.claude/rules/`              | Claude が作業中に読み込む規範。`paths` に一致するファイルを読んだときロードされる。rules は ADR かガイドの節を指し、ADR とガイドとコードは rules を指さない (rules の置き場所や書き方を主題にする ADR は除く) |
| `TEMPLATE_SETUP.md`           | テンプレートから始めた直後に一度だけ要る手順。済んだら消す                                                                                                                                                    |
| `AGENTS.md`                   | エージェントへの指示。`CLAUDE.md` は symlink                                                                                                                                                                  |
| `docs/registry-baseline/`     | shadcn registry の生成時 baseline。改変と上流 drift の判別に使う (ADR-0020)                                                                                                                                   |
| `docs/registry-deviations.md` | baseline から動かした行の台帳 (コードの乖離、行単位の lint 抑制、`src/styles.css` の乖離、registry の値を複製したファイル)。baseline との差分と 1:1 で対応する (ADR-0020)                                     |
| `docs/superpowers/`           | 設計仕様と実装計画の置き場所                                                                                                                                                                                  |
