---
paths:
  - "vite.config.*"
  - "package.json"
  - "vitest*.config.*"
  - "tsconfig*.json"
---

# Vite+ ツールチェーン設定

## lint 設定 (`vite.config.ts` の `lint` ブロック)

プラグインの設定は ADR-0003、ルールの選定基準は ADR-0004。

| キー        | 規範                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugins`   | 既定集合を**置換**する。`OXLINT_DEFAULT_PLUGINS` を spread して追加分を続け、`lint-config.test.ts` の `EXPECTED_PLUGINS` にも足す (ADR-0003)                        |
| `rules`     | `"warn"` で書かない。exit code に出ないので `"error"` で書く (ADR-0004)                                                                                             |
| `overrides` | テストの型ルール緩和に使う。違反の抑制には使わず行単位で書く (ADR-0006)。規則の適用範囲を層に合わせるときだけ `excludeFiles` を使う (ADR-0020)                      |
| `jsPlugins` | 先に oxlint ネイティブで代替できないか確かめる。エントリは `{ name, specifier }` で書き、抑制 directive はその `name` で書く。他の名前だと無言で効かない (ADR-0004) |

- `overrides` は `categories` を持てない。`plugins` はトップレベルと違い、継承した既定集合への追加になる (置換ではない)
- 有効でないプラグインのルールを `rules` に書くと無言で無視される。設定してあることは、その検査が動いていることを意味しない (ADR-0003)
- lint 設定は `vite.config.ts` の `lint` に集約する。サブディレクトリの `.oxlintrc.json` は `vp lint` が読まず no-op になる (ADR-0003)
- CLI の `-D` は未知のルール名を exit 0 で無視する。0 件を結論にする前に `--print-config` でルール名の実在を確かめる (ADR-0003)
- `-D` は同名ルールを持つプラグインをすべて有効にする。件数は診断の `plugin(rule)` 別に数える (ADR-0004)
- 基準が off にするルールでも `correctness` に入っていればカテゴリ側が勝つ。`rules` で明示的に off にしないと有効なまま残る (ADR-0004)
- eslint コアを拡張したルールは `typescript/` 接頭辞でもコアへ解決される。解決先が `correctness` なら名指しは no-op なので `--print-config` で実効を比べる
- 行単位の抑制 (`oxlint-disable-next-line`) は違反が報告される行の直前に置く。`.map()` の行に置いても `key` の行には効かない
- `no-await-in-loop` は順序依存のループにも鳴る。逐次でないと壊れるループは `Promise.all` へ倒さず、抑制して順序が要る理由を書く (ADR-0004)
- `vp check` は warn を exit code に出さない。`lint.categories` の格上げを外さない (`lint-config.test.ts` が解決後の設定で固定する)
- import の並びは Oxfmt の `sortImports` が持つ。`eslint/sort-imports` (`style` カテゴリで未有効) を有効にしない。Oxfmt と領域が重なる

## staged 設定 (pre-commit hook)

- `--no-error-on-unmatched-pattern` を外さない。staged が `ignorePatterns` の生成ファイルだけのコミットで、対象ゼロが error になり commit が止まる
- `vp staged` は `.vite-hooks/pre-commit` から呼び、hook は `package.json` の `prepare` の `vp config` が入れる。自前の skip スクリプトを間に挟まない
- hook を入れたくない環境 (CI のビルドコンテナ等) は `VP_GIT_HOOKS=0` で止める

## script とタスク

- マージ前検証を `vp run` のタスクへまとめない。Vite Task は親の環境変数を素通しせず、結果をキャッシュして gate がリプレイされる (ADR-0002)
- built-in と同名の script を新設しない。`vp <name>` の built-in と `vp run <name>` の script が別物になり取り違える。ただし `build` は `start` と対の入口 (`pnpm run build` → `pnpm start`) として残す
- ビルド成果物を起動する検査は `vp build` の後に置く。CI も同じ順序で workflow に並べる

## React Compiler (`vite.config.ts` の `plugins`)

- `viteReact({ compiler: { logDiagnostics: true } })` の `logDiagnostics` と `compiler` を外さない。外しても全部通り、最適化だけが無言で落ちる (ADR-0009)
- bail out のログは `vp build` では `[plugin vite:react-compiler]` だけで `error` / `warn` を含まない。ビルドログは `react-compiler` で grep する
- babel を経路に置かない。壊れたときも版を下げて凌ぐ (ADR-0009)

## worktree の config 除外

tsconfig / vitest.config / vitest.browser.config / vite.config (lint・fmt) は `.claude/worktrees/**` を除外する。
設定点が経路ごとに別で、1 つ落とすと worktree のコードが走査へ静かに混入する。走査対象を持つ config を新設したら同じ除外をその場で書く。
