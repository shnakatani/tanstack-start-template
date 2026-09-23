---
paths:
  - "vite.config.*"
  - "scripts/lint/**"
---

# Oxlint 設定

lint は Oxlint が担い、設定は Vite+ を通して `vite.config.ts` の `lint` に書く。

## lint 設定 (`vite.config.ts` の `lint` ブロック)

プラグインの設定は ADR-0003、ルールの選定基準は ADR-0004。

| キー        | 規範                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugins`   | 既定集合を**置換**する。`OXLINT_DEFAULT_PLUGINS` を spread して追加分を続け、`lint-config.test.ts` の `EXPECTED_PLUGINS` にも足す (ADR-0003)                        |
| `rules`     | `"warn"` で書かない。exit code に出ないので `"error"` で書く (ADR-0004)                                                                                             |
| `overrides` | テストの型ルール緩和に使う。違反の抑制には使わず行単位で書く (ADR-0006)。規則の適用範囲を層に合わせるときだけ `excludeFiles` を使う (ADR-0020)                      |
| `jsPlugins` | 先に oxlint ネイティブで代替できないか確かめる。エントリは `{ name, specifier }` で書き、抑制 directive はその `name` で書く。他の名前だと無言で効かない (ADR-0004) |

- `overrides` は `categories` を持てない。`plugins` はトップレベルと違い、継承した既定集合への追加になる (置換ではない) (ADR-0003)
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
