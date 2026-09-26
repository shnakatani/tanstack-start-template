# テンプレートから始めたときの手順

テンプレートから始めた直後に一度だけ要る手順をまとめた。
済んだらこの文書を消す。

## プロジェクトを作る

```bash
vp dlx gitpick shnakatani/tanstack-start-template my-app && cd my-app && git init
```

<details>
<summary>ほかのコマンドで作ったとき (2026-09-27 に確認)</summary>

| コマンド                                                              | 起きること                                                                                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `vp create github:shnakatani/tanstack-start-template`                 | `CLAUDE.md` と `.claude/skills/` の symlink が、degit のキャッシュを指す絶対パスに書き換わって壊れる (degit 3.10.0) |
| `vp create github:shnakatani/tanstack-start-template -- --mode=git`   | symlink は壊れない。`--mode=git` は degit の docs が非推奨としている                                                |
| `vp dlx giget gh:shnakatani/tanstack-start-template my-app`           | gitpick と同じ結果                                                                                                  |
| `gh repo create my-app --template shnakatani/tanstack-start-template` | GitHub にリポジトリが作られる                                                                                       |
| `git clone` / `gh repo clone`                                         | テンプレートの履歴と `origin` が残る                                                                                |

</details>

## 名前を置換する

```bash
grep -rn "tanstack-start-template" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.output .
```

grep に出ない `src/lib/app-name.ts` の `APP_NAME` も替える。

## 置き換える箇所

| 対象     | 場所                                                                       |
| -------- | -------------------------------------------------------------------------- |
| DB       | `src/server/db/`、`drizzle.config.ts`                                      |
| 認証     | `src/start.ts` の `createStart`、保護する route の `beforeLoad` (ADR-0012) |
| デプロイ | `vite.config.ts` の `nitro()` の `preset`                                  |

サンプル機能 (`/notes`) は `src/features/notes/` と `src/routes/notes/` にある。

## 後始末

- `README.md` の冒頭の説明と技術スタックを、自分のプロジェクトに合わせる
- この文書と、これを指す 3 か所 (`README.md` の冒頭の 1 文と「ドキュメント」の表の行、`.claude/rules/docs.md` の `paths`) を消す
