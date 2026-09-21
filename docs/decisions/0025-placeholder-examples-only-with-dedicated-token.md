# ADR-0025: placeholder には例示だけを置き、色を専用トークンへ切る

- Status: Accepted
- Date: 2026-09-21
- 関連: ADR-0024 (トークンの値の決め方と `--muted-foreground` を下げた判断) / ADR-0006 (乖離の記録先) / ADR-0022 (実描画と axe による検算。`::placeholder` には届かない)

## Context

ADR-0024 の節 3 に従って `--muted-foreground` の light を `mist-600` へ下げた。`--muted` の上で WCAG 2.2 SC 1.4.3 の 4.5:1 を満たすためである。
このトークンは `::placeholder` も塗っており、下げると例示テキストが入力済みの値と紛れる方向へ動く。

placeholder には向きの逆な要求が 2 つ掛かる。

| 要求               | 出所                                            | 色を動かす向き |
| ------------------ | ----------------------------------------------- | -------------- |
| 背景と 4.5:1       | SC 1.4.3                                        | 濃くする       |
| 入力値と区別が付く | 入力済みと誤認してフィールドを飛ばす経路 (NN/g) | 薄くする       |

後者に 3:1 を当てる。SC 1.4.1 は色が唯一の手段でないことを求め、明度差を追加の手がかりとして数える基準を 3:1 に置いている。
**この 3:1 は当てはめであって、placeholder と入力値の関係に SC 1.4.1 を適用すると書いた出典は無い。**

**1.4.3 が placeholder に掛かること自体は争われていない。** Understanding SC 1.4.3 の Intent が "including placeholder text" と名指しで含めている。w3c/wcag#4343 が問うているのはもっと狭く、「可視ラベルと同じ文言を繰り返すだけの placeholder」を免除できるかで、2026-09-21 時点で open である。**書式や指示を伝える placeholder に 4.5:1 が要る点は、同 issue の参加者の間でも異論が出ていない。**

**この色を検査は測っていない。しかも「測っていない」より悪い。** `axe-core@4.13.0` の `color-contrast` は空の入力欄にもマッチし (`lib/rules/color-contrast-matches.js` の `// Match all form fields, regardless of if they have text`)、`::placeholder` ではなく要素自身の `color` で判定する (`lib/` に `::placeholder` の言及が 0 件。2026-09-21 実測)。Deque 自身が dequelabs/axe-core#4260 で「placeholder を評価したかのように見える違反が、実際には別の前景色で出る」と書いている。**緑であることは placeholder が測られたことを意味しない。**

## Decision

**placeholder には例示だけを置き、その色を `--placeholder` として `--muted-foreground` から切る。**

ラベルと書式の指示は placeholder に置かない。ラベルは可視ラベルへ、指示は `FieldDescription` (`src/components/ui/field.tsx`) へ置く。
要求が例示と指示で変わる分け方は Carbon の 3 分類と w3c/wcag#4343 の議論が共通して採る。指示は 4.5:1 を満たす段が要る。

トークンを切る形そのものは ADR-0024 の節 4 が持つ。

### 対象外 — `select` の空状態

`select` の `data-placeholder:` は `--muted-foreground` のまま残す (`src/components/ui/select.tsx`)。
擬似要素ではなく実テキストの span を着色するので axe が通常テキストとして評価し、SC 1.4.3 が掛かる。内容も「状態を選択」のような指示で情報を持つ。

### 段の選択

「背景と 4.5:1」と「入力値と 3:1」を両方課したときに成立する帯と、palette の段 (ADR-0024 の節 3) の比。2026-09-21 の実測で、測り方は ADR-0024 の Context にある。
帯の下端は 4.5:1、上端は入力値との 3:1 が保てる限界で、どちらも背景との比で表している。

|                                            | 帯 (背景比) | `mist-400` | `mist-500` | `mist-600` |
| ------------------------------------------ | ----------- | ---------- | ---------- | ---------- |
| light (背景 `--background`)                | 4.50〜6.57  | 2.44       | **4.61**   | 7.39       |
| dark (背景 `--background` + `bg-input/30`) | 4.50〜5.83  | 7.43       | **3.93**   | 2.46       |

light は `mist-500` だけが帯に入り、下端から 0.11 しか離れていない。

dark の比は入力欄が置かれる面で変わる。上表は `--background` の上で測ったもので、`Dialog` / `Sheet` / `Popover` の中 (`--popover`) に置くと `mist-500` は 3.34 まで下がる。フォームは多くがダイアログの中に出るので、dark の実際の下限はこちらである。入力値との差 (4.45) は面によらないため、下の決定は動かない。

面ごとに測ることは、規格の定義から導かれる。「面を列挙せよ」と書いた条文は無い (2026-09-21 に Understanding / Techniques / ACT を検索して不在を確認)。導出元は 2 つで、Understanding SC 1.4.3 の Note 3 / 4 が背景を「そのテキストが通常の利用で実際に載る背景」と定義し、Note 6 が評価対象を "color pairs ... an author would expect to appear adjacent in typical presentation" と複数形で書く。免除されるのは UA 由来の表示だけで ("except where caused by authors' code")、テーマや面の切り替えは著者のコードなので含まれる。
W3C 自身の推奨値も面に依存する。WAI Forms Tutorial の `::placeholder { color: #767676 }` は "assuming the background of the element is white" と断りがあり、`#ffffff` 上 4.54 に対し `#f4f4f4` 上では 4.13 で割る。

dark は帯に入る段が無い。`mist-400` は入力値との 3:1 を割る側 (2.35) で外れ、`mist-500` は 4.5:1 を割る側で外れる。
**割る側を選んだ。** 入力値との区別が消えると、飛ばされるフィールドができるためである。**この選択は SC 1.4.3 への不適合を承知で採ったもので、正当化ではない。**

Carbon が `$text-placeholder` を 2.55 (light の `--background` 相当) のまま置き、carbon#19553 で「placeholder はコントラスト要件の対象ではない」と述べて閉じているのは承知しているが、**これは Understanding 1.4.3 の Intent と正面から食い違うので根拠に使わない。** 参照するのは 3 分類の枠組みだけである。
`--muted-foreground` と兼ねていた `mist-400` も dark では帯の外だったので、この決定は外れる側を入れ替えたものである。

light と dark で同じ `mist-500` になる。

### 検討した選択肢

| 案                                             | 入力値との 3:1   | 背景との 4.5:1  | 採否 |
| ---------------------------------------------- | ---------------- | --------------- | ---- |
| **例示専用に `--placeholder` を切る**          | light dark とも  | light のみ      | 採用 |
| `--muted-foreground` と兼ねたまま              | light で失う     | light dark とも | 却下 |
| dark だけ `mist-400` へ寄せて 4.5:1 を満たす   | dark で失う      | light dark とも | 却下 |
| placeholder をやめ `FieldDescription` へ寄せる | —                | —               | 却下 |
| 色に加えイタリックで区別する                   | 色以外の手がかり | 濃くできる      | 却下 |

- `--muted-foreground` と兼ねる案は、`--muted` の上の 4.5:1 と例示の区別を 1 つのトークンに同居させられない。上表のとおり light で両立する段が `mist-500` と `mist-600` に割れる
- dark を `mist-400` にすると placeholder が入力値とほぼ同じ明るさになり、入力済みと誤認する経路が開く。低コントラストより重い
- `FieldDescription` へ寄せる案は GOV.UK の立場と一致する。採らないのは、テンプレートとして配る既定から例示の手段を落とす判断を利用者側に残すためで、この ADR は placeholder を使う場合の色を決める
- イタリックは w3c/wcag#4343 で提案され、手がかりを 2 つ持つ根拠とテストの手間を理由に反論されて決着していない

## Consequences

- **この色を見る検査は無い。`vp test run` が緑でも `--placeholder` の値について何も言っていない。** 動かすときは light dark の両方で、placeholder を入力欄の背景と、値を入れた同じ欄の文字の 2 つに人が見比べる
- light の `mist-500` は帯の下端から 0.11 しか離れていない。`--background` か `--foreground` が動くと外れる。ADR-0024 の節 1 で生成をやり直したら帯を測り直す
- dark は SC 1.4.3 の 4.5:1 を満たさない。`--background` の上で 3.93、`--popover` の上で 3.34。placeholder へ書式や指示を書くと、そのまま不適合になる
- 消費者は `src/components/ui/input.tsx` と `src/components/ui/textarea.tsx` の `example-placeholder`。registry からの乖離として ADR-0006 の許容リストが行を持つ
- `--placeholder` は `@theme inline` へ通していない。通すと `text-placeholder` や `data-placeholder:text-placeholder` まで生成され、`select` の実テキストへ当てられる。utility を生やさない値は `@theme` でなく `:root` へ置くのが公式の基準で、当てる口は `@utility` が持つ
- placeholder を足すときは例示かどうかを確かめる。既存の利用は `grep -rn 'placeholder=' src/` で列挙できる
- 再評価の条件は、w3c/wcag#4343 が閉じるか、axe が `::placeholder` を読むようになったとき

## 出典

- Carbon の 3 分類 (option text / 例示の placeholder / 書式と指示): https://github.com/carbon-design-system/carbon/issues/7515
- 分類の根拠になったレビュー: https://github.com/carbon-design-system/carbon/pull/4799
- 入力済みと誤認してフィールドを飛ばす: https://www.nngroup.com/articles/form-design-placeholders/
- 例示にも placeholder を使わないとする立場 (1.4.3 を理由に挙げる): https://design-system.service.gov.uk/components/text-input/
- placeholder ごと deprecate した例 (比を上げると入力済みに見えるため): https://github.com/adobe/react-spectrum/issues/2935
- 面ごとに対を列挙して CI で落とす例: https://github.com/primer/primitives/blob/main/scripts/colorContrast.config.ts
- 冗長な placeholder に 1.4.3 が掛かるかの議論 (2026-09-21 時点で open): https://github.com/w3c/wcag/issues/4343
- WCAG 2.2 1.4.1 Use of Color: https://www.w3.org/TR/WCAG22/#use-of-color
- WCAG 2.2 1.4.3 Contrast (Minimum): https://www.w3.org/TR/WCAG22/#contrast-minimum
- Understanding SC 1.4.3 (Intent が placeholder を名指しで含める / 測る背景の定義): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- axe が placeholder を誤った前景色で評価する件 (open): https://github.com/dequelabs/axe-core/issues/4260
