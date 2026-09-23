# スタイルとトークン

色・トークン・余白を扱うときの手順と、コントラスト比の測り方を持つ。

| 決定                                                                                                    | ADR      |
| ------------------------------------------------------------------------------------------------------- | -------- |
| 消費側の className は静的に読める形に保ち、共有する外見は部品で配る                                     | ADR-0031 |
| 色は `@theme` と `@shadcn/lint` の 2 層で semantic token に閉じ込める                                   | ADR-0032 |
| セマンティックトークンの値は上流生成物を土台とし、乖離は WCAG の実測と palette の段で決める             | ADR-0033 |
| placeholder には例示だけを置き、色を専用トークンへ切る                                                  | ADR-0034 |
| コントラスト比は測り方を実在させ、動く数値を文書へ書き写さない                                          | ADR-0037 |
| Tailwind の scan は `src` に絞り、`theme(static)` は Storybook の CSS にだけ掛けて本番の CSS に載せない | ADR-0052 |

## how-to

### 色を当てる

- semantic token を使う。淡いハイライトは `bg-primary/10` のような opacity variant、SVG の `fill` / `stroke` は `currentColor` か token で書く
- 新しい意味のある色は、`src/styles.css` の `:root` / `.dark` に CSS 変数を定義してから使う。定義より前に utility を書くと、`no-unknown-classes` が止める
- 露出の口 (`@theme inline` で utility にするか、`:root` と `@utility` だけにするか) は、誤った当て方を誘う既存の書き方があるかで選ぶ (ADR-0033 の決定 4)
- `@theme inline` へ通した面のトークンを文字として書く余地は残る。面のトークンを文字に使うなら、載る下地ごとに比を測る。2026-09-22 時点で `text-destructive-surface` は light の `--background` / `--card` で 4.76、`--muted` / `--accent` / `--secondary` で 4.28〜4.33 になり、後者は SC 1.4.3 を割る
- `-foreground` を「面の上の文字」以外の意味で使わない。上流はこの接尾辞を solid な面の上の文字に割り当てており、別の意味を載せると次の生成で衝突する
- `src/styles.css` の `@theme` (`--color-*: initial`) は import より後ろ、`@theme inline` より前に置く。後ろへ動かすと semantic token まで消える
- `cn` は npm の `cn` パッケージから import する。registry が `@/lib/utils` ではなくそこから取るので、`src/lib/utils.ts` は置かない (ADR-0027)

### `color-mix()` を書く

`no-arbitrary-values` は、`color-mix()` の材料が semantic token だけでも color category と判定する (ADR-0032)。`var(--...)` だけを材料にした `color-mix()` は、行単位で `no-arbitrary-values` を抑制して書き、registry の中なら台帳 `docs/registry-deviations.md` の「行単位の lint 抑制」にも記録する。

抑制は class 文字列の行全体に効く。抑制した行へ後から色の任意値を足すと、診断なしで通る。抑制した行を触るときは、足す class が token だけかを目で確かめる。

### 外見を層の外へ配る

design system の層 (`ui/` / `action/` / `parts/`) から外へ class 文字列を配らない (ADR-0031)。外見を共有したいときは、次のどれかにする。

| 配り方                                                                     | 使う場面                       |
| -------------------------------------------------------------------------- | ------------------------------ |
| 部品として配る                                                             | 外見と構造がひとまとまりのとき |
| prop として受ける                                                          | 消費側が値を選ぶとき           |
| `cva` の variant として配り、`settings.shadcn.variantFunctions` へ宣言する | 同じ部品の見た目を分けるとき   |

- 層の内側での共有は対象外で、class 定数の export 自体は禁じない。消費側が import すれば規則が落とす
- 部品として配るとき、その部品をどの層が持つかは、層の役割 (ADR-0016) と、汎用の層が負う責務の範囲 (ADR-0022) で決める
- variant 関数を消費側から呼ぶ形を採るたびに、`vite.config.ts` の `settings.shadcn.variantFunctions` へ足す。忘れると呼び出しが lint で落ちるので、気付けない失敗にはならない

### トークンを作り直す

上流の preset が変わったときや、base color を変えたときは、生成物からやり直す (ADR-0033 の決定 1)。

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

比は `mise run contrast` で測る (ADR-0037)。

```bash
mise run contrast -- --theme dark --bg '--popover' --bg '--input/30' --fg '--placeholder'
```

- `--bg` は下から順に重ねる。`--fg` と `--bg` は `--input/30` の形で不透明度を付ける。出力は解決後の色、比、SC 1.4.3 と SC 1.4.11 の充足である
- 比を書いた箇所を触るときは測り直す。Understanding SC 1.4.3 / 1.4.11 は計算値を丸めるなと書いており、`3.70:1` と書いた時点で 3.7049 か 3.6951 かは復元できない
- 表示は切り捨てなので、2 桁の値が実際の比を上回ることはない。`4.59` と出た値が 4.6 を満たすことはない
- `--primary` の hue を変えるときは、候補の段を `src/styles.css` の `--primary` と `--primary-foreground` へ置き、`mise run contrast -- --theme light --bg '--background' --bg '--primary/80' --fg '--primary-foreground'` で測る。4.6 を下回る hue は light を `<hue>-900` にする (ADR-0033 の決定 2)
- placeholder の帯の上端 (入力値との 3:1) は `mise run contrast` では出せない。入力値 (`--foreground`) と 3:1 になる輝度を解いてから、背景との比へ直す。light は例示が入力値より明るいので `Lp = 3 * (L入力値 + 0.05) - 0.05`、dark は暗いので `Lp = (L入力値 + 0.05) / 3 - 0.05` を解き、`Lp` と背景の輝度で比を取る。輝度の式は `scripts/contrast/lib/contrast.ts` にある
- `--placeholder` の色を見る検査は無い。動かすときは light と dark の両方で、placeholder を入力欄の背景と、値を入れた同じ欄の文字の 2 つに人が見比べる。light の `mist-500` は帯の下端に近いので、`--background` か `--foreground` を動かしたら帯を測り直す

### 実在の対を story で描く

既定の story が描かない組み合わせ (hover の tint など) は、実テキストとして描く story を `src/components/contrast.stories.tsx` に足し、axe の対象に入れる (ADR-0033 の決定 5)。比を計算する story は書かない。

### axe の比と突き合わせる

`mise run contrast` の比は、同じ色を渡せば axe の `getContrast` と一致する (ADR-0037)。axe か colorjs.io の版が動いたら、`measurePair` の結果を `toHex` で渡して次と比べ、ADR-0037 の記述を合わせる。継続して検査はしない。

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

`src/styles.css` の `source()` を外した場合と比べるときは、`source()` を外して `vp build` を 2 回回し、CSS の出力を比べる (ADR-0052)。

## explanation

### 兄弟の間隔を親の gap に置く理由

兄弟の間隔は、子の margin ではなく親の `gap-*` に置く。間隔の持ち主を親にすると、子は自分が並ぶ文脈を知らなくて済む。子が margin で間隔を持つと、同じ部品を別の並びに置いたときに間隔が付いて回る。

次は兄弟の間隔ではない。この規則の対象外なので、そのまま書いてよく、例外の一覧にも挙げない。

- 負マージンによる親の padding の打ち消し (`-mx-(--card-spacing)` など)
- `*-auto` による整列 (`ml-auto` など)

### spacing の表の値

ページ本体の padding やリストの行間のような表の値は、このアプリで決めた値で、上流から来た値ではない。変えるときは画面で実測し、表を書き換える。registry の部品の内部の間隔は registry の既定が基準で、表に写さない。
