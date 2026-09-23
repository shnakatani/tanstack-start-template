# ADR-0035: placeholder には例示だけを置き、色を専用トークンへ切る

- Status: Accepted
- Date: 2026-09-21
- 関連: ADR-0033 (トークンの値の決め方と `--muted-foreground` を下げた判断) / ADR-0026 / ADR-0034 (乖離の記録先) / ADR-0033「リポジトリが持つ検算は実描画と axe で行い、比を計算する story を持たない」(`::placeholder` には届かない)

## Context

ADR-0033「値は palette の段に乗せる」に従って `--muted-foreground` の light を `mist-600` へ下げた。`--muted` の上で WCAG 2.2 SC 1.4.3 の 4.5:1 を満たすためである。
このトークンは `::placeholder` も塗っており、下げると例示テキストが入力済みの値と紛れる方向へ動く。

placeholder には向きの逆な要求が 2 つ掛かる。

| 要求               | 出所                                            | 色を動かす向き |
| ------------------ | ----------------------------------------------- | -------------- |
| 背景と 4.5:1       | SC 1.4.3                                        | 濃くする       |
| 入力値と区別が付く | 入力済みと誤認してフィールドを飛ばす経路 (NN/g) | 薄くする       |

後者に 3:1 を当てる。SC 1.4.1 は色が唯一の手段でないことを求め、明度差を追加の手がかりとして数える基準を 3:1 に置いている。
**この 3:1 は当てはめであって、placeholder と入力値の関係に SC 1.4.1 を適用すると書いた出典は無い。**

**1.4.3 が placeholder に掛かること自体は争われていない。** Understanding SC 1.4.3 の Intent が "including placeholder text" と名指しで含めている (勧告本体ではなく Understanding 側の記述)。

w3c/wcag#4343 が問うているのは「情報を足さない placeholder」を免除できるかで、2026-09-21 時点で open である。**免除の軸は例示かどうかではなく、ラベルが名指していない情報を足すかどうかである。** detlevhfischer は `<input placeholder="Mary">` を「コントラスト要件は掛からない」側に置く一方、同じ例示でも `placeholder="Mary Smith"` は姓名の構成を伝えるので「もはや適合しないと言える」とする。`placeholder="DD.MM.YYYY"` のように書式を伝える形が要件を満たす必要がある点には、異論が出ていない。

**免除の筋そのものへの反対もある。** mbgower は「冗長かどうかは関係がなく、SC 1.4.3 の incidental の例外は placeholder に及ばない」と述べている。philljenkins の「ラベルを 4.5:1 に保ったうえで placeholder は 3:1 + イタリック」案も含め、決着していない。

**この色を検査は測っていない。しかも「測っていない」より悪い。** `axe-core@4.13.0` の `color-contrast` は空の入力欄にもマッチし (`lib/rules/color-contrast-matches.js` の `// Match all form fields, regardless of if they have text`)、`::placeholder` ではなく要素自身の `color` で判定する (`lib/` に `::placeholder` の言及が 0 件。2026-09-21 実測)。Deque 自身が dequelabs/axe-core#4260 で「placeholder を評価したかのように見える違反が、実際には別の前景色で出る」と書いている。**緑であることは placeholder が測られたことを意味しない。**

## Decision

**placeholder には例示だけを置き、その色を `--placeholder` として `--muted-foreground` から切る。**

可視ラベルの代わりに placeholder を使わない。書式・構成・必須条件の説明も置かない。それらは可視ラベルと `FieldDescription` (`src/components/ui/field.tsx`) が持ち、`--foreground` / `--muted-foreground` で 4.5:1 を満たす。

**「何を置くか」と「その色が適合するか」は別の問いで、軸も違う。** 置くものは Carbon (#7515) の分類に従い、例示か指示かで分ける。色が免除されるかは w3c/wcag#4343 の軸で、ラベルが名指していない情報を足すかで分かれる。2 つは一致しない。例示でも書式を伝えるもの (`placeholder="Mary Smith"`) は、置いてよいが免除には入らない。その場合この色は不適合になる。どこが不適合かは Consequences が持つ。

トークンを切る形そのものは ADR-0033「1 つのトークンが用途を兼ねて両立しないときは、狭い側を別トークンへ切る」が持つ。

### 対象外 — `select` の空状態

`select` の `data-placeholder:` は `--muted-foreground` のまま残す (`src/components/ui/select.tsx`)。
擬似要素ではなく実テキストの span を着色するので axe が通常テキストとして評価し、SC 1.4.3 が掛かる。内容も「状態を選択」のような指示で情報を持つ。

### 段の選択

「背景と 4.5:1」と「入力値と 3:1」を両方課したときに成立する帯と、palette の段 (ADR-0033「値は palette の段に乗せる」) の比。2026-09-21 の実測である。`src/styles.css` がトークンとして宣言している段は `mise run contrast` で測り直せる (ADR-0039)。light の `mist-500` は `--placeholder`、`mist-600` は `--muted-foreground`。dark の `mist-500` は `--placeholder`、`mist-400` は `--muted-foreground` が持つ。light の `mist-400` と dark の `mist-600` はトークンになっていないので、この手段では測れない。
帯の下端は 4.5:1、上端は入力値との 3:1 が保てる限界で、どちらも背景との比で表している。

上端は `mise run contrast` では出せない。対を渡す形ではなく、入力値 (`--foreground`) と 3:1 になる輝度を解いてから背景との比へ直すためである。light は例示が入力値より明るいので輝度 `Lp = 3 * (L入力値 + 0.05) - 0.05`、dark は暗いので `Lp = (L入力値 + 0.05) / 3 - 0.05` を解き、`Lp` と背景の輝度で比を取る。輝度の式は `scripts/contrast/lib/contrast.ts` にある。

|                                            | 帯 (背景比) | `mist-400` | `mist-500` | `mist-600` |
| ------------------------------------------ | ----------- | ---------- | ---------- | ---------- |
| light (背景 `--background`)                | 4.50〜6.57  | 2.44       | **4.61**   | 7.37       |
| dark (背景 `--background` + `bg-input/30`) | 4.50〜5.82  | 7.43       | **3.93**   | 2.46       |

light は `mist-500` だけが帯に入り、下端から 0.11 しか離れていない。

dark の比は入力欄が置かれる面で変わる。上表の dark 行は入力欄をページ直下 (`--background` + `bg-input/30`) に置いた値で、`Dialog` / `Sheet` / `Popover` の中 (`--popover` + `bg-input/30`) では `mist-500` が 3.35 まで下がる。フォームは多くがダイアログの中に出るので、dark の実際の下限はこちらである。`bg-input/30` を載せない素の面ならそれぞれ 4.27 と 3.76 で、入力欄の面が比を押し下げている。light 行に `bg-input/30` が無いのは、`input.tsx` と `textarea.tsx` がこれを `dark:` 限定で付けるためである。入力値との差 (4.43) は面によらないため、下の決定は動かない。

面ごとに測ることは、規格の定義から導かれる。「面を列挙せよ」と書いた条文は無い (2026-09-21 に勧告本体 / Understanding / Techniques / ACT を検索して不在を確認)。導出元は勧告本体の glossary が `contrast ratio` に付ける note で、Understanding の Key Terms はそれを引き写している。Note 3 / 4 が背景を「そのテキストが通常の利用で実際に載る背景」と定義し、Note 6 が評価対象を "color pairs ... an author would expect to appear adjacent in typical presentation" と複数形で書く。テーマやダイアログの面は typical presentation の側に入るので、Note 6 が続けて免除する "unusual presentations" (UA による色の変更はその例示) には当たらない。
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
- light の `mist-500` は帯の下端から 0.11 しか離れていない。`--background` か `--foreground` が動くと外れる。ADR-0033「土台は空ファイルへの生成物とし、自作分を載せ直す」 で生成をやり直したら帯を測り直す
- dark は SC 1.4.3 の 4.5:1 を満たさない。入力欄の面 (`bg-input/30` 込み) で、ページ直下なら 3.93、ダイアログの中なら 3.35。placeholder へ書式や指示を書くと、そのまま不適合になる
- 消費者は `src/components/ui/input.tsx` と `src/components/ui/textarea.tsx` の `example-placeholder`。registry からの乖離として ADR-0026 の許容リストが行を持つ
- `--placeholder` は `@theme inline` へ通していない。通すと `text-placeholder` や `data-placeholder:text-placeholder` まで生成され、`select` の実テキストへ当てられる。utility を生やさない値は `@theme` でなく `:root` へ置くのが公式の基準で、当てる口は `@utility` が持つ
- **消費側からの上書きが決定的でない。** `cn` は生成済み utility の表で衝突を判定するため、`@utility` で作った `example-placeholder` を知らない。`<Input className="placeholder:text-foreground" />` は両方のクラスを載せたまま出荷され、詳細度が同じ (0,1,1) なのでどちらが勝つかは CSS のソース順で決まる。registry の `placeholder:text-muted-foreground` なら `cn` が確実に落とす。2026-09-21 時点で上書きしている消費側は無い。`grep -rn 'placeholder:text-' src/ --include='*.tsx'` が返すのは `select.tsx` の `data-placeholder:text-muted-foreground` 1 件だけで、これは `Input` / `Textarea` の口ではない
- placeholder を足すときは 2 つ確かめる。(1) 例示か (ラベルの代わりでも、書式や条件の説明でもないか)。(2) ラベルが名指していない情報を足していないか。(1) を満たし (2) を満たさないものは置いてよいが、この色では 1.4.3 に適合しない
- 2026-09-21 時点で (2) を満たさないのは `input-group.stories.tsx` の `placeholder="name@example.com"` (差出人ラベルが形式を名指していない) と `placeholder="0"` (数値のみという構成を伝える) の 2 件。どちらも story のカタログで、dark の比は表の dark 行と同じ 3.93 になる。残る 11 種はラベルの言い換えか値の例示で、情報を足さない
- 再評価の条件は、w3c/wcag#4343 が閉じるか、axe が `::placeholder` を読むようになったとき

## 出典

- Carbon の分け方 (例示は低コントラスト可 / 書式と指示は 4.5:1): https://github.com/carbon-design-system/carbon/issues/7515
- その元になった 3 分類 (option text / 例示 / 書式と指示) を出したレビュー: https://github.com/carbon-design-system/carbon/pull/4799#pullrequestreview-333428266
- 入力済みと誤認してフィールドを飛ばす: https://www.nngroup.com/articles/form-design-placeholders/
- 例示にも placeholder を使わないとする立場 (1.4.3 を理由に挙げる): https://design-system.service.gov.uk/components/text-input/
- placeholder ごと deprecate した例 (比を上げると入力済みに見えるため): https://github.com/adobe/react-spectrum/issues/2935
- 面ごとに対を列挙して CI で落とす例: https://github.com/primer/primitives/blob/main/scripts/colorContrast.config.ts
- 冗長な placeholder に 1.4.3 が掛かるかの議論 (2026-09-21 時点で open): https://github.com/w3c/wcag/issues/4343
- WCAG 2.2 1.4.1 Use of Color: https://www.w3.org/TR/WCAG22/#use-of-color
- WCAG 2.2 1.4.3 Contrast (Minimum): https://www.w3.org/TR/WCAG22/#contrast-minimum
- Understanding SC 1.4.3 (Intent が placeholder を名指しで含める。丸めるなの note もここ): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- WCAG 2.2 勧告本体 `contrast ratio` の Note 3 / 4 / 6 (測る背景の定義と color pairs): https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
- axe が placeholder を誤った前景色で評価する件 (open): https://github.com/dequelabs/axe-core/issues/4260
