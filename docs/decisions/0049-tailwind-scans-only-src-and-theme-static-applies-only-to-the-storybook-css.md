# ADR-0049: Tailwind の scan は `src` に絞り、`theme(static)` は Storybook の CSS にだけ掛けて本番の CSS に載せない

- Status: Accepted
- Date: 2026-09-20
- 関連: ADR-0046 (story を状態のカタログにする) / ADR-0030 (コントラストの検算)

## Context

デザイントークンは `src/styles.css` の `@theme` と `:root` が SSOT で、Storybook のトークンの story は値を書き写さず、CSSOM から読んで一覧する。公式の `ColorPalette` は色値を MDX へ書き写し、専用 addon は `styles.css` へ注釈コメントを要するので、どちらも SSOT と二重管理になる。

Tailwind は既定で、utility から参照されている変数だけを出力する。`inline` は utility へ値を直接埋め込むため、`rounded-*` の utility を書いても対応する変数を読む rule が生まれない。実際に使っているトークンでも、CSSOM から読む一覧からは消える。

どの変数が出力に残るかは Tailwind の source scan の結果で決まる。**scan は既定でリポジトリ全体を読み、Markdown も対象にする**ため、ADR や rules に書いた名前が「使用中」と判定されて出力に残っていた。

## Decision

**`src/styles.css` の `@import "tailwindcss" source("../src")` で scan の対象をアプリのソースへ絞る。全トークンを出力させる `theme(static)` は `.storybook/preview.css` にだけ掛け、本番の CSS には載せない。**

- scan の効果は `source()` を外して `vp build` を 2 回回せば測れる
- `@source not` で除外を並べる形は採らない。symlink (`.claude/skills` は `.agents` を指す) と、後から増える置き場を取りこぼす。絞る側を書けば、対象に入れ忘れた場所は utility が生成されないことで気付ける
- `.storybook/preview.css` は `src/styles.css` を `@import "../src/styles.css" theme(static);` で読み直す。`theme()` は import 単位で効くため、本番の CSS は `static` の分を持たない
- 代償は、Tailwind 既定 theme の未定義トークンがカタログに混ざることである。2026-09-20 の実測では Radius に 2 件、Typography に 6 件で、Colors は `--color-*: initial` が効いていて増えない

### 検討した選択肢

| 案                                                                     | 評価                                                                                                                                                                  | 採否     |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| scan を既定のまま (リポジトリ全体) にする                              | Markdown に書いた名前まで「使用中」と判定され、本番 CSS に残る                                                                                                        | 却下     |
| `@source not` で除外を並べる                                           | symlink と後から増える置き場を取りこぼす                                                                                                                              | 却下     |
| `styles.css` に `static` を付ける                                      | 未参照の宣言が本番 CSS へ乗り、この template から作られる全プロジェクトが払う。差の測り方は `@theme inline` と `@theme static inline` を入れ替えて `vp build` を 2 回 | 却下     |
| トークン名を `styles.css` のソースから読み、`static` を使わない        | `static` が無いと未出力の変数は `getComputedStyle` で解決できず、名前だけが並ぶ                                                                                       | 却下     |
| `__unstable__loadDesignSystem` でビルド時に列挙し、`static` を使わない | `@tailwindcss/node` が export するが、名前のとおり安定 API ではないと明示されている                                                                                   | 却下     |
| scan を `src` に絞り、`static` を Storybook の CSS だけに掛ける        | 本番 CSS は Markdown 由来の変数と `static` の分を持たず、Storybook のカタログには全トークンが出る                                                                     | **採用** |

## Consequences

- トークンの一覧が `styles.css` から自動で出る
- `src` の外に置いたファイルに書いた utility は生成されない。気付くのは、その utility が効かないときである

## 出典

- Tailwind CSS: Theme variables (Generating all CSS variables) — https://tailwindcss.com/docs/theme
- Tailwind CSS: Detecting classes in source files — https://tailwindcss.com/docs/detecting-classes-in-source-files
