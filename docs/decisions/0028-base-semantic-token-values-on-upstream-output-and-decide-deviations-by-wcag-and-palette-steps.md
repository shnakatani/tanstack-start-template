# ADR-0028: セマンティックトークンの値は上流生成物を土台とし、乖離は WCAG の実測と palette の段で決める

- Status: Accepted
- Date: 2026-09-21
- 関連: ADR-0024 (乖離の記録先と baseline の運用) / ADR-0040 (story の axe を `error` で回す) / ADR-0029 (「1 つのトークンが用途を兼ねて両立しないときは、狭い側を別トークンへ切る」を placeholder へ適用した事例)

## Context

`src/styles.css` の色は shadcn CLI が生成する。`shadcn init --preset <code>` と `shadcn apply <code> --only theme` はどちらも、知っているキーの値だけを書き換える。生成物を読まずに値を足すと、次の生成でその値が消えたか残ったかが差分に現れない。

ADR-0024 の生成時 baseline は `src/components/ui/` を対象にしており、`src/styles.css` は対象外だった。そのため 3 種類の乖離 (上流にない追加 / 値の変更 / 意図した削除) を区別する手段がなく、判別のたびに上流の registry JSON を引いて突き合わせるところから始まっていた。

**base color を slate から mist へ動かしたのは、CLI が slate を生成先に持たなくなったためである。** 2026-09-21 に `shadcn@4.21.0` で観測した。

```
$ shadcn migrate base-color --from neutral --to slate
Unknown base color: slate. Available base colors: neutral, zinc, stone, mauve, olive, mist, taupe.
```

拒否されるのは生成先としてだけで、slate そのものは残っている。

| slate の扱い            | 観測                                                                |
| ----------------------- | ------------------------------------------------------------------- |
| 生成先 (`--to slate`)   | 上のエラーで拒否される                                              |
| 移行元 (`--from slate`) | 受け付けてトークンごとの結果を返す                                  |
| palette の配信          | `/r/colors/slate.json` が 200、色の index にも slate の ramp がある |

slate の値を持ち続けても壊れてはいなかった。動かしたのは、CLI が生成しない palette を抱え続けるのをやめるためである。

**上流の既定値は複数の対で WCAG 1.4.3 を割る。** 2026-09-21 に `shadcn@4.21.0` の生成物を実測した結果を示す。測ったのは上流が生成した値そのもので、「有彩色のアクセントは light と dark で役割を反転させる」以降で決める本リポジトリの段ではない。

計測は生成した `styles.css` を oklch から sRGB へ変換し、alpha を持つ値は下地へ合成してから比を取ったものである。変換器は `scripts/contrast/lib/contrast.ts` (ADR-0031)。

この表は 2026-09-21 の観測として凍結する。8 色 17 テーマぶんの生成物が残っておらず、`mise run contrast` は `src/styles.css` のトークンしか読まないので測り直せない。

| 対                                                           | 範囲                   | 比                                                                                                          |
| ------------------------------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `--muted-foreground` on `--muted` (light)                    | base color 8 色中 7 色 | 3.86〜4.41 (mauve のみ 4.54 で充足)                                                                         |
| `text-destructive` on `bg-destructive/20` (light)            | 既定の `--destructive` | 3.31                                                                                                        |
| `text-primary` on `--background`                             | 有彩色 17 テーマすべて | dark で 15 テーマが 1.95〜2.78。lime と yellow は dark が 10.08・10.30 で通り、代わりに light が 1.54・1.57 |
| `--sidebar-primary-foreground` on `--sidebar-primary` (dark) | blue                   | 3.45                                                                                                        |
| `--border` / `--input` on `--background`                     | base color 8 色すべて  | 1.24〜1.48 (WCAG 1.4.11 の 3:1)                                                                             |

`text-primary` が割る理由は、`--primary` が dark で「明るい文字を載せる面」と「暗い背景に載る文字」の両方を求められることにある。blue の ramp を全段調べても、両方を満たす段は存在しない。上流の既定である無彩色テーマだけが免れるのは、dark の `--primary` がほぼ白に反転して面と文字の役割が分かれるからである。

検算の形は、実テキストを描いて axe に判定させる (「リポジトリが持つ検算は実描画と axe で行い、比を計算する story を持たない」)。本 ADR は値の決定と検算の形の両方を持つ。

## Decision

**生成物を土台に置き、そこから動かした値だけを WCAG の実測で正当化する。**

### 1. 土台は空ファイルへの生成物とし、自作分を載せ直す

`src/styles.css` を `@import "tailwindcss";` だけに戻してから生成し、生成物へ自作分を載せる。既存ファイルへ上書きする形は採らない。上流が生成しないキーが残り続け、消したつもりの値が消えない。

生成は `shadcn init --preset b1Z7Mag76 --base base --force --no-reinstall` で行う。preset code は `shadcn preset decode` で `vega / mist / blue / chart blue / lucide / geist / radius default / menuAccent subtle / menuColor default` に展開される。`init` が併せて作る `src/lib/utils.ts` は削除する (ADR-0024)。

preset code をプロジェクトから復元する `shadcn preset resolve` は、黙って別のコードを返すことがある。復元元と、選択肢に無い値だったときの振る舞いは次のとおり。

| 項目         | 復元元                                    | 選択肢に無い値のとき |
| ------------ | ----------------------------------------- | -------------------- |
| `baseColor`  | `components.json` の `tailwind.baseColor` | `neutral` へ落ちる   |
| `chartColor` | `--chart-1`〜`--chart-5` の値             | `neutral` へ落ちる   |

落ちた項目には `*` が付き、脚注 `* Uses preset defaults for values not available as options on shadcn/create.` が出る (`shadcn info --json` では `preset.fallbacks`)。戻ったコードを decode すると `baseColor` と `chartColor` が `neutral` になっており、生成に使えば灰色と chart がそちらへ塗り替わる。エラーは出ない。

2026-09-21 に `shadcn@4.21.0` で得た戻り値は、base color が slate だった頃が `bIm515k`、`--chart-*` を palette の外へ動かした場合が `bKX4z2W`、この節の手順を通した後が `b1Z7Mag76` である。復元が効くのは値が選択肢に収まっている間だけなので、生成に使うコードは文書側が持つ。

生成物そのものを `docs/registry-baseline/styles.css` として持つ。乖離の記録先は ADR-0024 の許容リストで、本 ADR は値の決め方だけを持つ。

### 2. 有彩色のアクセントは light と dark で役割を反転させる

`--primary` を light は暗い面、dark は明るい面にし、`-foreground` をその逆へ置く。

|       | `--primary` | `--primary-foreground` |
| ----- | ----------- | ---------------------- |
| light | `<hue>-800` | `<hue>-50`             |
| dark  | `<hue>-300` | `<hue>-950`            |

`--sidebar-primary` の対も同じ段に揃える。上流は sidebar 側を primary より 1 段明るく置くが、dark でその対が 3.45 になる。

`bg-primary/80` の上の `--primary-foreground` が 4.6 を下回る hue は light を `<hue>-900` にする。この規則は `text-primary` (文字)、solid の面、`bg-primary/80` (hover) の 3 役をすべて 4.5:1 以上にする。

hue を変えるときは、候補の段を `src/styles.css` の `--primary` と `--primary-foreground` へ置いて `mise run contrast -- --theme light --bg '--background' --bg '--primary/80' --fg '--primary-foreground'` で測る。下の表は 2026-09-21 の `tailwindcss@4.3.3` の palette を同じ形で測ったもので、9 色が該当した。

表示は切り捨てなので、2 桁の値が実際の比を上回ることはない。`4.59` と出た値が 4.6 を満たすことはない。

| hue                     | `<hue>-800` のまま | `<hue>-900` へ下げた後 |
| ----------------------- | ------------------ | ---------------------- |
| orange / emerald / teal | 4.59 / 4.49 / 4.51 | 5.34 / 5.35 / 5.25     |
| amber / yellow / lime   | 4.43 / 4.21 / 4.25 | 5.23 / 5.00 / 4.91     |
| green / cyan / sky      | 4.31 / 4.39 / 4.43 | 5.11 / 5.10 / 5.23     |

残る 8 色 (red / blue / indigo / violet / purple / fuchsia / pink / rose) は `<hue>-800` のまま 4.98〜5.53 で足りる。

### 3. 値は palette の段に乗せる

変更後の値は Tailwind の palette (`node_modules/tailwindcss/theme.css`) の段と一致させる。閾値を跨ぐ最小の値を探さない。通ること以外に根拠がなく、以降のトークン調整で静かに割り直す。

### 4. 1 つのトークンが用途を兼ねて両立しないときは、狭い側を別トークンへ切る

同じトークンが複数の用途で使われ、用途ごとの閾値を同時に満たす段が palette に無いときは、**用途の狭い側**を新しいトークンへ切る。既存の名前は広い側が保つ。名前を動かすと、閾値と関わりのない利用箇所まで書き換えることになる。

兼ねる用途は面と文字の対に限らない。1 つの文字色に別々の閾値が掛かる形もこの規則で切る。

| 兼ねていた用途           | 広い側 (名前を保つ)        | 狭い側 (切り出す)                  | 決定     |
| ------------------------ | -------------------------- | ---------------------------------- | -------- |
| tint の面とその上の文字  | `--destructive` (`text-X`) | `--destructive-surface` (`bg-X/N`) | 本 ADR   |
| 通常の文字と例示テキスト | `--muted-foreground`       | `--placeholder` (`::placeholder`)  | ADR-0029 |

切り出した側が緩い閾値を持つとは限らない。`--placeholder` は SC 1.4.3 を割る側を意図して選んでおり、その判断は ADR-0029 が持つ。

露出の口は、そのトークンを当ててはいけない場所があるかで分ける。

| トークン                | 露出                      | 分けた理由                                                                                |
| ----------------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| `--destructive-surface` | `@theme inline`           | 面として当てる口が `bg-X/10` `/20` `/30` と複数あり、誤った当て方を誘う既存の書き方が無い |
| `--placeholder`         | `:root` + `@utility` のみ | `select` に `data-placeholder:text-muted-foreground` があり、置き換えの候補に必ず挙がる   |

`@theme inline` へ通した面のトークンを文字として書く余地は残る。2026-09-22 時点で `text-destructive-surface` は light の `--background` / `--card` で 4.76、`--muted` / `--accent` / `--secondary` で 4.28〜4.33 になり、後者は SC 1.4.3 を割る。面のトークンを文字に使うなら下地ごとに測る。

`-foreground` を「面の上の文字」以外の意味で使わない。上流はこの接尾辞を solid な面の上の文字に割り当てており、別の意味を載せると次の生成で衝突する。

### 5. リポジトリが持つ検算は実描画と axe で行い、比を計算する story を持たない

判定は `parameters.a11y.test` の axe に任せる (ADR-0040)。既定の story が描かない組み合わせ (hover の tint など) は、実テキストとして描く story を足して axe の対象に入れる。

対象はリポジトリが検査として持つものに限る。値を選ぶための計算は別で、本 ADR の Context と ADR-0029 の帯は oklch から計算した比を根拠に載せている。

禁じているのは、その計算を story として抱えて検査の顔をさせることである。描画されない値を測るので、実際の画面が割っていても緑になる。

2026-09-20 に比を計算する story を 2 つの形で試し、どちらも目的を果たさなかった。

| 試した形                                     | なぜ外したか                                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 全トークンを `--background` と比べる         | 画面上で重ならない組み合わせの比が並ぶ。閾値を割ったかどうかの判断に使えない                       |
| 命名から対を導く (`--X-foreground` と `--X`) | 命名は「画面で重なること」の代理にならない。使われていない対で不合格を出し、実在の対を出さなかった |

JS で比を計算する形そのものにも無理がある。ブラウザは sRGB 外の `oklch()` を clip し、alpha を持つ背景は下地と合成する。描画されていない値を計算しても実際の見え方と一致しない。

実際に重なる組み合わせを実テキストとして描けば、`parameters.a11y.test` の axe がそのまま判定する。新しい依存は要らず、gamut も alpha も正確になる。2026-09-20 に `--destructive: oklch(0.53 0.245 27.325)` でこの形を試すと、`bg-destructive/20` と `text-destructive` が 3.74:1 で不合格になった。破壊ボタンの hover の実在の組み合わせである。

実在の対を描く story は `src/components/contrast.stories.tsx` に置く。

**この検算は addon の合否だけでは足りない。** `@storybook/addon-a11y@10.6.0` は `violations` の件数だけで合否を決める (同 addon の `hasViolations`)。`color-contrast` は背景を解決できないと `violations` ではなく `incomplete` へ落ちるので、story を包む要素が変わって解決できなくなると、addon だけでは検査が緑のまま何も見なくなる。判定できなかった項目を合否へ入れる仕組みと、どの層で入れるかは ADR-0032 が持つ。

hover の状態を作って測る形は、ポインタを当てる形も擬似クラスを強制する形も採らない。ポインタを当てると `transition-colors` の途中の合成色を axe が測る。擬似クラスを強制しても同じで、Storybook の test 実行は animation を止めない方針のため (ADR-0039) 途中の色が残り、さらに addon が描画後に axe を回すので状態を保つ decorator か別の走査が要る。手で組み合わせを並べる方が、持ち物が一覧だけで済む。

### 検討した選択肢

| 案                                     | 自作分と上流由来の判別          | 上流の欠陥への対処                                                                                                                     | 採否 |
| -------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **空ファイルへ生成し自作分を載せ直す** | つく (baseline との差分)        | 乖離として明示で持つ                                                                                                                   | 採用 |
| 既存ファイルへ `apply --only theme`    | つかない (上流にないキーが残る) | 同上                                                                                                                                   | 却下 |
| 生成物をそのまま使い乖離を持たない     | つく                            | 上表の対が割ったまま                                                                                                                   | 却下 |
| 無彩色テーマを選んで問題を回避する     | つく                            | `--primary` が `--foreground` と 1.14:1 になり、アクセント色を持たない                                                                 | 却下 |
| JS でコントラストを計算する story      | —                               | 描画されない値を測る。対応する色空間を実装ごと抱え、`oklch()` を読めない実装になり、変換のためにブラウザの色パーサを借りる連鎖が起きる | 却下 |

無彩色テーマの却下理由を補う。失敗の件数だけを見ると最少になるが、それは `--primary` が前景色そのものになるためで、有彩色を扱う難しさを回避しているにすぎない。テンプレートとして配る以上、アクセント色を持つ形で解いた例を示す側に価値がある。

## Consequences

- 生成物と `src/styles.css` の差分が、そのまま意図的乖離の一覧になる。突き合わせは `git diff --no-index docs/registry-baseline/styles.css src/styles.css`
- 上流が preset の値を変えたら baseline を再生成し、差分を許容リストと突き合わせる。手順は ADR-0024 に従う
- **残した比率は人が書き写したもので、トークンを動かしても自動では追随しない。** 2026-09-21 のトークン刷新でも `segmented-radio-group.tsx` と `data-table.tsx` の 3 箇所が古いまま残り、レビューで見つかった
- 測り直す手段は `mise run contrast` が持つ (ADR-0031)。Understanding SC 1.4.3 / 1.4.11 は計算値を丸めるなと書いており (勧告本体には無い)、`3.70:1` と書いた時点で 3.7049 か 3.6951 かは復元できないため、比率を書いた箇所を触るときは測り直す
- 「有彩色のアクセントは light と dark で役割を反転させる」の反転規則は上流の生成物と必ず食い違う。hue を変えても同じ 4 つのトークンを上書きし続ける
- 非テキストの 3:1 (WCAG 1.4.11) のうち、`--border` / `--input` と focus 指標の `/50` はこの決定で解かない。この対は light dark とも 3:1 を大きく下回る。base color とテーマの選択では動かせず、registry のクラスの判断になる。axe に対応ルールがないため検出もされない
- focus 指標の不足は `--ring` を `--primary` と同値にしても残る。`--background` の上で、`ring-ring/50` は light が 3:1 を割り dark は満たす。不透明で使う `border-ring` / `outline-ring` は light dark とも満たす
- chart の 5 トークンは light と dark で同値で、1 本の blue ramp が両モードを兼ねる。明るい端が light の下地に、暗い端が dark の下地に紛れる。WCAG 1.4.11 の 3:1 を割るのは light の `--chart-1`、dark の `--chart-4`、dark の `--chart-5` である

  消費している部品は無く (`grep -rl "chart" src/` が定義元の `src/styles.css` だけを返す)、chart 部品も入れていない。ただしテンプレートとして配る既定値なので、chart を足した利用者がこの ramp をそのまま受け取る。値をどう変えるかはここでは決めない

- base color を変えるときは `shadcn migrate base-color --from <旧> --to <新>` を使う。値が一致するトークンだけを置換し、一致しないものを名前で報告するため、報告された一覧が意図的乖離と一致することを確認できる

## 出典

- 破壊色の既定が閾値上にある報告: https://github.com/shadcn-ui/ui/issues/10431
- `--destructive-foreground` に赤が入る件と白への修正案: https://github.com/shadcn-ui/ui/pull/8773
- 非テキストコントラストのルール要望 (2023-02-09 から open): https://github.com/dequelabs/axe-core/issues/3907
- 入力欄の境界を対象にしたルール案 (PARKED): https://github.com/dequelabs/axe-core/issues/854
- WCAG 2.2 1.4.3 Contrast (Minimum): https://www.w3.org/TR/WCAG22/#contrast-minimum
- WCAG 2.2 1.4.11 Non-text Contrast: https://www.w3.org/TR/WCAG22/#non-text-contrast
