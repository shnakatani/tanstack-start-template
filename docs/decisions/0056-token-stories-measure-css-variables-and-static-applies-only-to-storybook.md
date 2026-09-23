# ADR-0056: トークンの story は CSS 変数を実測して描き、`static` は Storybook だけに掛ける

- Status: Accepted
- Date: 2026-09-20
- 関連: ADR-0053 (story を状態のカタログにする) / ADR-0034 (コントラストの検算)

## Context

デザイントークンは `src/styles.css` の `@theme` と `:root` が SSOT だが、値を一覧する手段が無く light と dark を並べて比べられなかった。

## Decision

**トークンは CSS 変数を実測して描く。**

`styles.css` を SSOT に保つため、story 側に値を書き写さない。

- 値は `getComputedStyle` で解決後のものを読む
- light と dark は `@storybook/addon-themes` の class 切り替えで出し分ける
- テーマごとの読み取り結果を外部ストアにし、`useSyncExternalStore` で購読する。値は React の依存に現れないため、再 render だけでは React Compiler がメモ化した結果を返して止まる
- `key` による remount は採らない。テーマの class は `STORY_RENDERED` 後に当たるため、remount は play function より後に起き、play が作った状態を捨てる (2026-09-20 実測)

トークンの一覧を CSSOM から読む選択の帰結として、`static` が要る。`inline` は utility へ値を直接埋め込むため、`rounded-*` の utility を書いても対応する変数を読む rule が生まれない。Tailwind は既定で参照されている変数だけを出力するので、実際に使っているトークンでもカタログから消える。

どの変数が落ちるかは Tailwind の source scan の結果で決まる。**scan は既定でリポジトリ全体を読み、Markdown も対象にする**ため、ADR や rules に書いた名前が「使用中」と判定されて出力に残っていた。`styles.css` の `@import "tailwindcss" source("../src")` で対象をアプリのソースへ絞る。効果は `source()` を外して `vp build` を 2 回回せば測れる。

`@source not` で除外を並べる形は採らない。symlink (`.claude/skills` は `.agents` を指す) と、後から増える置き場を取りこぼす。絞る側を書けば、対象に入れ忘れた場所は utility が生成されないことで気付ける。

**`static` は Storybook だけに掛ける。** `.storybook/preview.css` が `src/styles.css` を `@import "../src/styles.css" theme(static);` で読み直す。`theme()` は import 単位で効くため、本番の CSS は `static` の分を持たない。

代償は、Tailwind 既定 theme の未定義トークンがカタログに混ざることである。2026-09-20 の実測では Radius に 2 件、Typography に 6 件で、Colors は `--color-*: initial` が効いていて増えない。

Tailwind は theme の出力を `@layer theme` に置くため、CSSOM の走査は `@layer` を含むグループ規則を再帰的に辿る必要がある。辿らないと `@layer` の中の `:root` を見落とす。

### 検討した選択肢

| 案                                                         | 評価                                                                                                                                                                  | 採否     |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| トークンを公式の `ColorPalette` で書く                     | 色値を MDX へ書き写すため `styles.css` と二重管理になる                                                                                                               | 却下     |
| トークンを専用 addon で一覧化する                          | `styles.css` へ注釈コメントを足す必要があり、Storybook 専用の記述が SSOT に混ざる                                                                                     | 却下     |
| `styles.css` に `static` を付ける                          | 未参照の宣言が本番 CSS へ乗り、この template から作られる全プロジェクトが払う。差の測り方は `@theme inline` と `@theme static inline` を入れ替えて `vp build` を 2 回 | 却下     |
| トークン名を `styles.css` のソースから読む                 | `static` が無いと未出力の変数は `getComputedStyle` で解決できず、名前だけが並ぶ                                                                                       | 却下     |
| `__unstable__loadDesignSystem` でビルド時に列挙する        | `@tailwindcss/node` が export するが、名前のとおり安定 API ではないと明示されている                                                                                   | 却下     |
| CSS 変数を実測して描き、`static` を Storybook だけに掛ける | `styles.css` を SSOT に保ち、本番 CSS は `static` の分を持たない                                                                                                      | **採用** |

## Consequences

- トークンの一覧が `styles.css` から自動で出る

## 出典

- Storybook: Themes addon — https://storybook.js.org/docs/essentials/themes
- Tailwind CSS: Theme variables (Generating all CSS variables) — https://tailwindcss.com/docs/theme
- Tailwind CSS: Detecting classes in source files — https://tailwindcss.com/docs/detecting-classes-in-source-files
