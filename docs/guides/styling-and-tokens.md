# スタイルとトークン

色・トークン・余白を扱うときの手順と、コントラスト比の測り方を持つ。

| 決定                                                                                        | ADR      |
| ------------------------------------------------------------------------------------------- | -------- |
| design system の層から外へ class 文字列を配らず、共有する外見は部品・prop・variant で配る   | ADR-0022 |
| 色は `@theme` と `@shadcn/lint` の 2 層で semantic token に閉じ込める                       | ADR-0023 |
| セマンティックトークンの値は上流生成物を土台とし、乖離は WCAG の実測と palette の段で決める | ADR-0024 |
| placeholder には例示だけを置き、色を専用トークンへ切る                                      | ADR-0025 |

## how-to

### 色を当てる

- semantic token を使う。淡いハイライトは `bg-primary/10` のような opacity variant、SVG の `fill` / `stroke` は `currentColor` か token で書く
- 新しい意味のある色は、`src/styles.css` の `:root` / `.dark` に CSS 変数を定義してから使う。定義より前に utility を書くと、`no-unknown-classes` が止める
- 露出の口 (`@theme inline` で utility にするか、`:root` と `@utility` だけにするか) は、誤った当て方を誘う既存の書き方があるかで選ぶ (ADR-0024 の決定 4)
- `@theme inline` へ通した面のトークンを文字として書く余地は残る。面のトークンを文字に使うなら、載る下地ごとに比を測る。2026-09-22 時点で `text-destructive-surface` は light の `--background` / `--card` で 4.76、`--muted` / `--accent` / `--secondary` で 4.28〜4.33 になり、後者は SC 1.4.3 を割る
- `-foreground` を「面の上の文字」以外の意味で使わない。上流はこの接尾辞を solid な面の上の文字に割り当てており、別の意味を載せると次の生成で衝突する
- `src/styles.css` の `@theme` (`--color-*: initial`) は import より後ろ、`@theme inline` より前に置く。後ろへ動かすと semantic token まで消える
- `cn` は npm の `cn` パッケージから import する。registry が `@/lib/utils` ではなくそこから取るので、`src/lib/utils.ts` は置かない (ADR-0020)

### `color-mix()` を書く

`no-arbitrary-values` は、`color-mix()` の材料が semantic token だけでも color category と判定する (ADR-0023)。`var(--...)` だけを材料にした `color-mix()` は、行単位で `no-arbitrary-values` を抑制して書き、registry の中なら台帳 `docs/registry-deviations.md` の「行単位の lint 抑制」にも記録する。

抑制は class 文字列の行全体に効く。抑制した行へ後から色の任意値を足すと、診断なしで通る。抑制した行を触るときは、足す class が token だけかを目で確かめる。

### 外見を層の外へ配る

design system の層 (`ui/` / `action/` / `parts/`) から外へ class 文字列を配らない (ADR-0022)。外見を共有したいときは、次のどれかにする。

| 配り方                                                                     | 使う場面                       |
| -------------------------------------------------------------------------- | ------------------------------ |
| 部品として配る                                                             | 外見と構造がひとまとまりのとき |
| prop として受ける                                                          | 消費側が値を選ぶとき           |
| `cva` の variant として配り、`settings.shadcn.variantFunctions` へ宣言する | 同じ部品の見た目を分けるとき   |

- 層の内側での共有は対象外で、class 定数の export 自体は禁じない。消費側が import すれば規則が落とす
- 部品として配るとき、その部品をどの層が持つかは、層の役割 (ADR-0011) と、汎用の層が負う責務の範囲 (ADR-0016) で決める
- variant 関数を消費側から呼ぶ形を採るたびに、`vite.config.ts` の `settings.shadcn.variantFunctions` へ足す。忘れると呼び出しが lint で落ちるので、気付けない失敗にはならない

### トークンを作り直す

上流の preset が変わったときや、base color を変えたときは、生成物からやり直す (ADR-0024 の決定 1)。

1. `src/styles.css` を `@import "tailwindcss";` だけに戻す
2. `shadcn init --preset b1Z7Mag76 --base base --force --no-reinstall` で生成する。preset code は `shadcn preset decode` で `vega / mist / blue / chart blue / lucide / geist / radius default / menuAccent subtle / menuColor default` に展開される
3. `init` が一緒に作る `src/lib/utils.ts` を消す
4. 生成物を `docs/registry-baseline/styles.css` に写し、その上に自作分を載せ直す。差分と許容リストの突き合わせは `docs/guides/registry.md`「baseline を取り直して取り込む」
5. 帯を持つトークン (`--placeholder`) を測り直す (「比を測る」)

- 生成に使う preset code は、プロジェクトから `shadcn preset resolve` で復元しない。値が選択肢に無い項目は黙って `neutral` へ落ちる (下の表)。落ちた項目には `*` が付き、脚注 `* Uses preset defaults for values not available as options on shadcn/create.` が出る (`shadcn info --json` では `preset.fallbacks`)。そのコードで生成すると、灰色と chart が `neutral` へ塗り替わる。エラーは出ない

| 項目         | 復元元                                    | 選択肢に無い値のとき |
| ------------ | ----------------------------------------- | -------------------- |
| `baseColor`  | `components.json` の `tailwind.baseColor` | `neutral` へ落ちる   |
| `chartColor` | `--chart-1`〜`--chart-5` の値             | `neutral` へ落ちる   |

- 2026-09-21 に `shadcn@4.21.0` で得た戻り値は、base color が slate だった頃が `bIm515k`、`--chart-*` を palette の外へ動かした場合が `bKX4z2W`、この手順を通した後が `b1Z7Mag76` である。復元が効くのは値が選択肢に収まっている間だけなので、生成に使うコードは文書が持つ
- base color だけを変えるときは `shadcn migrate base-color --from <旧> --to <新>` を使う。値が一致するトークンだけを置換し、一致しないものを名前で報告するので、報告された一覧が意図的な乖離と一致するかを確かめられる

### 比を測る

比は `mise run contrast` で測る。測り方を置き、数値を書き写さない理由は「比の測り方を置いた理由」にある。

```bash
mise run contrast -- --theme dark --bg '--popover' --bg '--input/30' --fg '--placeholder'
```

- `--bg` は下から順に重ねる。`--fg` と `--bg` は `--input/30` の形で不透明度を付ける。出力は解決後の色、比、SC 1.4.3 と SC 1.4.11 の充足である
- 比を書いた箇所を触るときは測り直す。Understanding SC 1.4.3 / 1.4.11 は計算値を丸めるなと書いており、`3.70:1` と書いた時点で 3.7049 か 3.6951 かは復元できない
- 表示は切り捨てなので、2 桁の値が実際の比を上回ることはない。`4.59` と出た値が 4.6 を満たすことはない
- `--primary` の hue を変えるときは、候補の段を `src/styles.css` の `--primary` と `--primary-foreground` へ置き、`mise run contrast -- --theme light --bg '--background' --bg '--primary/80' --fg '--primary-foreground'` で測る。4.6 を下回る hue は light を `<hue>-900` にする (ADR-0024 の決定 2)
- placeholder の帯の上端 (入力値との 3:1) は `mise run contrast` では出せない。入力値 (`--foreground`) と 3:1 になる輝度を解いてから、背景との比へ直す。light は例示が入力値より明るいので `Lp = 3 * (L入力値 + 0.05) - 0.05`、dark は暗いので `Lp = (L入力値 + 0.05) / 3 - 0.05` を解き、`Lp` と背景の輝度で比を取る。輝度の式は `scripts/contrast/lib/contrast.ts` にある
- 比を計算できない入力は黙って通さず throw する。silent に通すと、画面に存在しない比が文書へ写る。throw する入力は次のとおり

| 入力                                                                                                                   | 扱い  |
| ---------------------------------------------------------------------------------------------------------------------- | ----- |
| `:root` / `.dark` の本体に `{` がある (入れ子、閉じ括弧が行頭に無い、値に `{` を含む宣言)                              | throw |
| セレクタが行頭に無い (`@media` が外から `:root` を包む形)                                                              | throw |
| sRGB のまま `none` が残る色 (`rgb(none 0 0)` と alpha の `/ none`。oklch や lab の `none` は変換で 0 に解決されて通る) | throw |
| 不透明度が十進数でない綴り (`--input/.5` / `--input/1e2`)                                                              | throw |
| `:root` / `.dark` に宣言として読めない行がある (カスタムプロパティでないものを含む)                                    | throw |
| いちばん下の下地が不透明でない                                                                                         | throw |

- 値に `{` を含む宣言 (`--shadow-preset: { x: 1px };`) を `:root` / `.dark` へ書くと、そのテーマの表ごと throw してどの対も測れなくなる。入れ子のブロックと区別していないためで、正しい宣言も弾く
- 測る対は呼ぶときに渡す。対の一覧は持たない。一覧を持つと、列挙漏れと、一覧が実際の描画と食い違う乖離の 2 つを抱え、どちらも検出する手段が無い
- `--placeholder` の色を見る検査は無い。動かすときは light と dark の両方で、placeholder を入力欄の背景と、値を入れた同じ欄の文字の 2 つに人が見比べる。light の `mist-500` は帯の下端に近いので、`--background` か `--foreground` を動かしたら帯を測り直す

### 実在の対を story で描く

既定の story が描かない組み合わせ (hover の tint など) は、実テキストとして描く story を `src/components/contrast.stories.tsx` に足し、axe の対象に入れる (ADR-0024 の決定 5)。比を計算する story は書かない。

### axe の比と突き合わせる

`mise run contrast` の比は、同じ色を渡せば axe の `getContrast` と一致する (「測り方の限界」)。axe か colorjs.io の版が動いたら、`measurePair` の結果を `toHex` で渡して次と比べ、「測り方の限界」の記述を合わせる。継続して検査はしない。

```js
const { Color, getContrast } = (await import("axe-core")).default.commons.color;
const parse = (s) => {
  const c = new Color();
  c.parseString(s);
  return c;
};
getContrast(parse(toHex(measured.backdrop)), parse(toHex(measured.foreground)));
```

### placeholder の色を当てる

- `--placeholder` は `@theme inline` へ通さず、`:root` に置いて `@utility example-placeholder` で当てる。通すと `text-placeholder` や `data-placeholder:text-placeholder` まで生成され、`select` の実テキストへ当てられる。utility を生やさない値は `@theme` でなく `:root` へ置くのが公式の基準である
- 消費側からの上書きは決定的でない。`cn` は生成済み utility の表で衝突を判定するので、`@utility` で作った `example-placeholder` を知らない。`<Input className="placeholder:text-foreground" />` は両方の class を載せたまま出荷され、詳細度が同じ (0,1,1) なので、どちらが勝つかは CSS のソース順で決まる

### 列幅の決まる部品を測る

`table-fixed` と `min-w-[N]` を持つ部品は、列幅の配分を計算で予測してから、境界の viewport (N の直下) でも実測する。広い幅だけで測ると、狭い幅で列幅が最小化しても気付けない。

### scan の効果を測る

`src/styles.css` の `source()` を外した場合と比べるときは、`source()` を外して `vp build` を 2 回回し、CSS の出力を比べる。scan を絞る理由は「scan と `theme(static)` の範囲」にある。

## explanation

### 兄弟の間隔を親の gap に置く理由

兄弟の間隔は、子の margin ではなく親の `gap-*` に置く。間隔の持ち主を親にすると、子は自分が並ぶ文脈を知らなくて済む。子が margin で間隔を持つと、同じ部品を別の並びに置いたときに間隔が付いて回る。

次は兄弟の間隔ではない。この規則の対象外なので、そのまま書いてよく、例外の一覧にも挙げない。

- 負マージンによる親の padding の打ち消し (`-mx-(--card-spacing)` など)
- `*-auto` による整列 (`ml-auto` など)

### spacing の表の値

ページ本体の padding やリストの行間のような表の値は、このアプリで決めた値で、上流から来た値ではない。変えるときは画面で実測し、表を書き換える。registry の部品の内部の間隔は registry の既定が基準で、表に写さない。

### 比の測り方を置いた理由

ADR-0024 の Context は、上流生成物の値を oklch から sRGB へ変換し、alpha を持つ値は下地へ合成してから比を取ったと書く。その変換器はリポジトリに無かった。測り方が無いと、文書の数値を誰も追試できず、トークンを動かしたあとの再測もできない。

書き写した比はトークンに追随しない。2026-09-21 のトークン刷新では `segmented-radio-group.tsx` と `data-table.tsx` の 3 箇所が古いまま残り、レビューで見つかった。4 件目は ADR-0017 に残っていた。`opacity-50` の比を ADR-0017 と `data-table.tsx` が別の値で書いており、同じ主張を 2 箇所へ写したことが原因である。

そこで測り方をリポジトリへ置き、動く数値は文書から落とし、検査は作らない。

| 物                                             | 置き場所                                    |
| ---------------------------------------------- | ------------------------------------------- |
| トークン表のパース / 色の解決 / 合成 / WCAG 比 | `scripts/contrast/lib/contrast.ts`          |
| 同上の単体テスト                               | `scripts/contrast/lib/contrast.test.ts`     |
| 引数の解釈と出力行の組み立て                   | `scripts/contrast/lib/contrast-cli.ts`      |
| 同上の単体テスト                               | `scripts/contrast/lib/contrast-cli.test.ts` |
| トークンの SSOT のパス                         | `scripts/contrast/lib/styles-css.ts`        |
| 例外の連鎖を 1 行にする                        | `scripts/contrast/lib/describe-error.ts`    |
| ファイル読みと終了コード                       | `scripts/contrast/report.ts`                |
| 呼び出し口                                     | `.mise.toml` の `[tasks.contrast]`          |

- テストは `scripts-tools` project が拾う。include は `scripts/**/*.test.ts` から `scripts/checks/**` を除く拒否リストにする。ディレクトリを並べる許可リストにすると、ツールを足すたびに 1 行足す必要があり、足し忘れたツールのテストは無言で走らない
- 検査は作らない。トークンを動かしても何も落ちない。a11y の合否は `src/components/contrast.stories.tsx` の axe が持つ (ADR-0024「リポジトリが持つ検算は実描画と axe で行い、比を計算する story を持たない」)。この変換器は story ではなく合否も持たないので、その決定と両立する。単体テストが落ちるのは変換器が壊れたときで、配色の可否を判定しているのではない。測るのは文書へ書く値を人が選ぶためである

先行例 (2026-09-22 調査)。デザインシステム 20 件 (うち 2 件は対象リポジトリを特定できず未確認) と、ブラウザで色を解決する手法、文書の数値をテストで固定する手法を調べた。

| 観点                                 | 結果                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| トークンの対を CI で検算する         | `primer/primitives` のみ。手書きの配列を workflow が回す                             |
| 対の列挙漏れを機械で検出する         | ゼロ。Primer を含め全てレビューに依存する                                            |
| ブラウザで実描画して測る             | ゼロ。`carbon` と `baseweb` は axe の `color-contrast` を切っている (理由の記述なし) |
| 文書の数値をトークンと同期させる     | Primer のみ。Storybook が表示時に計算関数を呼び、数値を文書へ書き写さない            |
| 文書の地の文の数値をテストで固定する | 見つからない。doctest 系は文書内の実行例の出力を見るもので、地の文は対象外           |

比べた案は次のとおり。

| 案                                   | 内容                                                 | 採否     | 理由                                                                                                                          |
| ------------------------------------ | ---------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 測り方を置き、動く数値を落とす       |                                                      | 採用     | 維持する一覧を持たない。既存規範 (ADR-0001「数値の階層」) の適用で済む                                                        |
| 台帳型                               | 対と期待値と記載ファイルを持ち、再計算と突き合わせる | 却下     | 数値の写しが 3 箇所へ増える。台帳が描画のモデルになり、`text-foreground/60` を `/70` に変えても緑で通る                       |
| マーカー型                           | 数値の隣に対の定義を置き、文書を走査して突き合わせる | 却下     | 台帳より軽いがモデルの乖離は同じく残る。先行例も無い                                                                          |
| 重複削除のみ                         | 装置を足さず写しを 1 つにする                        | 部分採用 | 「同じ主張を 2 箇所へ書かない」として取り込む。単独では測り方の欠落が残る                                                     |
| ブラウザの canvas で測る             | 1x1 canvas へ塗って `getImageData` で読む            | 却下     | 先行例ゼロ。Brave と Firefox が読み取り結果へノイズを混ぜるため chromium 固定に依存する                                       |
| トークン定義に要求比を持たせ段を解く | Material 型                                          | 却下     | 生成の仕組みごと持つことになり、上流生成物を土台とする ADR-0024「土台は空ファイルへの生成物とし、自作分を載せ直す」と衝突する |
| 現状維持                             |                                                      | 却下     | 4 件目の陳腐化が実在した                                                                                                      |
| axe の算法へ寄せる                   | `axe.commons.color` を使うか、その算法を再現する     | 部分採用 | 8bit へ落とす点は定義どおりなので採る。層ごとの丸め・ブレンドモード・影・DOM のスタックは採らない                             |

### 色の解決に colorjs.io を使う理由

色の解決は `colorjs.io` を devDependency に宣言して使う。`axe-core` が同梱する同じライブラリを `axe.commons.color` 経由で呼ぶ形は、次の 3 点で採らない。

| 採らない理由                                                                                                                                           | 出典                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `axe.commons` は `axe.run` の外で呼ぶ前提の名前空間ではない。外で安全なものは `axe.utils` 側だとメンテナが定義している                                 | dequelabs/axe-core の issue 2731 |
| colorjs は `axe.js` へインライン展開されており、パッケージマネージャで差し替える手段が無い。axe 自身が版を上げたいが Prototype.js との衝突で戻している | 同 issue 5313 と PR 4429・4464   |
| その版差が `none` の扱いに出る。同梱の 0.4.3 は `rgb(0 0 0 / none)` を alpha 1 で通す (2026-09-22 実測)。CSS Color 4 は欠けた成分を 0 と定める         | 同 issue 5309 と 4269            |

- 3 点目はこのリポジトリに効く。issue 5309 は Tailwind が無彩色へ吐く `none` で color-contrast が無言で飛ぶ報告で、このリポジトリのトークンも oklch で書かれている
- 0.7.1 は同じ入力を解決する。`oklch(0.5 none 180)` は灰色になり、null が残るのは sRGB のまま渡された `rgb(none 0 0)` と alpha の `/ none` だけである (2026-09-22 実測)。axe が飛ばす綴りをこの変換器は測れる
- `@asamuzakjp/css-color` も候補に挙がった。不透明色では Chrome と完全に一致するが、`color-mix` を含む値では canvas の読み取りと一致しない。合成を自前で持つ点は `colorjs.io` と変わらず、`axe-core` が採用している側を選んだ

### 8bit へ丸める位置

- 比を出す前に、重ね終わった色を 8bit へ落とす。WCAG 2.2 の relative luminance は `RsRGB = R8bit/255` と定義しており、輝度の式へ入れるのは 8bit で表された色である。丸めずに測ると定義から外れる
- 丸めるのは重ね終わった後の 1 回だけにする。ブラウザは面を float で重ねてから 1 回ラスタライズするので、画面に出るのはその 1 回ぶんの色である。axe は `Color` が内部で 8bit を持つため層ごとに丸まるが、これは実装の都合で、定義が要求する形ではない
- Understanding SC 1.4.3 の「the computed values should not be rounded」は比の丸めを禁じる文で、色には掛からない。出た比は丸めない

### 残す数値と落とす数値

出てくる数値は 3 種類に分かれ、扱いが違う。判定軸は ADR-0001「数値の階層」の ADR の行である。

| 種別 | 中身                                                                   | `src/styles.css` から再計算できるか | 扱い           |
| ---- | ---------------------------------------------------------------------- | ----------------------------------- | -------------- |
| A    | 現在のトークンの対                                                     | できる                              | 書き写さない   |
| B    | 一時点の外部観測 (上流既定値、palette の hue 表、回帰として固定した値) | できない                            | 日付つきで残す |
| C    | 閾値定数 (4.5:1 / 3:1)                                                 | 動かない                            | 書いてよい     |

種別は「上流の話か」ではなく「ツールで再現できるか」で決める。上流が生成した色でも、同じ値のトークンがこのリポジトリに在れば再現でき、種別 A として扱う (生成物の `mist-500` は現行の `--placeholder`、`blue-700` は `--chart-4`、`blue-800` は dark の `--chart-5`)。

残している数値は次のとおり。

| 場所                                        | 残す理由                                                                                      |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| ADR-0024 の Context の上流既定値の表        | 種別 B。本リポジトリのトークンではないので再計算できない                                      |
| ADR-0024 の palette の hue 表               | どの hue を 1 段下げるかの論証そのもの。上流 palette の値なので本リポジトリの変更では動かない |
| ADR-0025 の帯の表                           | 数値が消えると、帯に入る段がどれかを追試できない                                              |
| `segmented-radio-group.test.tsx` の回帰の値 | 過去の観測として固定したもの                                                                  |
| `src/styles.css` の段を選んだ理由のコメント | 種別 B。上流が生成した段 (blue-700 / mist-500 / blue-800) の比で、本リポジトリの値ではない    |

- 比の主張を持つのは 1 箇所とし、他は文書番号か見出しで指す。同じ主張を 2 箇所に書くと、片方だけが直されて食い違う
- 数値を落とした箇所は、主張が正しいかを人が確かめる契機を失う。落とすのは主張が残る箇所に限る
- 文書とソースに残った比の洗い出し方は `docs/guides/writing-docs.md`「文書に書いた比を数え直す」にある

### 測り方の限界

- トークンを動かしたときに鳴るものは無い。残した数値の陳腐化は機械では検出しない。代わりに再測が 1 コマンドになる
- 測る対は人が渡す。「この対を測り忘れた」は検出できない。先行例も解いていない
- 同じ色を渡せば axe の `getContrast` と比が一致する。2026-09-22 に axe-core 4.13.0 と実トークン 5,000 対で突き合わせ、差はゼロだった。手順は「axe の比と突き合わせる」
- `colorjs.io` の版が上がると値が変わりうる。`toGamut` の `method: "clip"` は axe-core 4.13.0 の `Color.parseString` に合わせたものである
- 残る違いは丸める位置である。axe は層ごとに丸め、この変換器は重ね終わった後の 1 回だけ丸める。半透明を重ねた対では SC の判定が割れうる
- 画面の比と一致するとは限らない。axe はブラウザで `mix-blend-mode`・`text-shadow`・祖先の `opacity`・要素の重なりまで畳むが、この変換器は `--bg` で渡された面だけを重ねる
- 単体テストが固定するのは axe の `getContrast` との一致で、要素のスタックを畳んだ後の報告値は node では再現できない
- 計算が寄りかかっている前提は `scripts/contrast/lib/contrast.ts` の docstring が持つ

出典:

- WCAG 2.2 relative luminance の定義 (Note 2 が 0.03928 からの差し替えを説明): https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
- Understanding SC 1.4.3 (計算値を丸めるなと書いている地の文。WCAG 2.2 本体に記述は無い): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- CSS Color 4 の欠けた成分 (「a missing component behaves as a zero value」): https://www.w3.org/TR/css-color-4/#missing
- CSS Color 4 の色の解決 (oklch の computed value は oklch のまま): https://www.w3.org/TR/css-color-4/#resolving-color-values
- axe.commons と axe.utils の線引き: https://github.com/dequelabs/axe-core/issues/2731
- axe-core が同梱する colorjs の版を上げられずにいること: https://github.com/dequelabs/axe-core/issues/5313
- 同梱版で `none` を含む色の color-contrast が無言で飛ぶ報告: https://github.com/dequelabs/axe-core/issues/5309
- axe-core がガマット外の oklch をブラウザに合わせた PR: https://github.com/dequelabs/axe-core/pull/4908
- axe-core が colorjs.io を同梱すること: `node_modules/axe-core/LICENSE-3RD-PARTY.txt`
- トークンの対を CI で検算する先行例: https://github.com/primer/primitives/blob/main/scripts/colorContrast.config.ts
- canvas の読み取りへノイズを混ぜる実装: https://github.com/brave/brave-browser/issues/10000

### scan と `theme(static)` の範囲

`src/styles.css` の `@import "tailwindcss" source("../src")` で scan の対象をアプリのソースへ絞る。全トークンを出力させる `theme(static)` は `.storybook/preview.css` にだけ掛け、本番の CSS には載せない。

デザイントークンは `src/styles.css` の `@theme` と `:root` が SSOT で、Storybook のトークンの story (`src/components/tokens.stories.tsx`) は値を書き写さず、CSSOM から読んで一覧する。公式の `ColorPalette` は色値を MDX へ書き写し、専用 addon は `styles.css` へ注釈コメントを要するので、どちらも SSOT と二重管理になる。

- Tailwind は既定で、utility から参照されている変数だけを出力する。`inline` は utility へ値を直接埋め込むため、`rounded-*` の utility を書いても対応する変数を読む rule が生まれない。実際に使っているトークンでも、CSSOM から読む一覧からは消える
- どの変数が出力に残るかは Tailwind の source scan の結果で決まる。scan は既定でリポジトリ全体を読み、Markdown も対象にするため、ADR や rules に書いた名前が「使用中」と判定されて出力に残っていた
- `.storybook/preview.css` は `src/styles.css` を `@import "../src/styles.css" theme(static);` で読み直す。`theme()` は import 単位で効くため、本番の CSS は `static` の分を持たない
- 代償は、Tailwind 既定 theme の未定義トークンがカタログに混ざることである。2026-09-20 の実測では Radius に 2 件、Typography に 6 件で、Colors は `--color-*: initial` が効いていて増えない

| 案                                                                     | 評価                                                                                                                                                                  | 採否     |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| scan を既定のまま (リポジトリ全体) にする                              | Markdown に書いた名前まで「使用中」と判定され、本番 CSS に残る                                                                                                        | 却下     |
| `@source not` で除外を並べる                                           | symlink (`.claude/skills` は `.agents` を指す) と、後から増える置き場を取りこぼす。絞る側を書けば、対象に入れ忘れた場所は utility が生成されないことで気付ける        | 却下     |
| `styles.css` に `static` を付ける                                      | 未参照の宣言が本番 CSS へ乗り、この template から作られる全プロジェクトが払う。差の測り方は `@theme inline` と `@theme static inline` を入れ替えて `vp build` を 2 回 | 却下     |
| トークン名を `styles.css` のソースから読み、`static` を使わない        | `static` が無いと未出力の変数は `getComputedStyle` で解決できず、名前だけが並ぶ                                                                                       | 却下     |
| `__unstable__loadDesignSystem` でビルド時に列挙し、`static` を使わない | `@tailwindcss/node` が export するが、名前のとおり安定 API ではないと明示されている                                                                                   | 却下     |
| scan を `src` に絞り、`static` を Storybook の CSS だけに掛ける        | 本番 CSS は Markdown 由来の変数と `static` の分を持たず、Storybook のカタログには全トークンが出る                                                                     | **採用** |

出典:

- Tailwind CSS: Theme variables (Generating all CSS variables) — https://tailwindcss.com/docs/theme
- Tailwind CSS: Detecting classes in source files — https://tailwindcss.com/docs/detecting-classes-in-source-files
