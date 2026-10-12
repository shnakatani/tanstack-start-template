# ADR-0042: 操作中の表示は置き換える中身の場所を取り、一覧の列幅は中身に任せる

- Status: Accepted
- Date: 2026-10-13
- 関連: ADR-0016 (Action 層の pending と名前の契約)、ADR-0018 (一覧テーブルは registry の Table に描く)、ADR-0020 (registry コードの改変は許容リストに限る)、ADR-0022 (外見は部品・prop・variant で配る)、ADR-0026 (項目の状態は静的テキストで持ち、Spinner は `aria-hidden`)、ADR-0031 (瞬間の値)、ADR-0040 (遷移のクロスフェード)、ADR-0041 (編集ダイアログの読み込み中の表示)

## Context

一覧テーブルは `table-layout: auto` で描く (ADR-0018 の registry の `Table` は `w-full` で、`colgroup`、列の `size`、`columnSizingFeature` のどれも持たない)。列幅は cell の中身の幅で決まる。操作中の表示が中身の幅を変えると、その間だけ列が動き、遷移のクロスフェード (ADR-0040) が旧 snapshot と新 snapshot の列幅の差を 2 重の像として見せる。

2026-10-12 に Playwright 1.63.0 の Chromium 153 で、dev server を page で開き、viewport 1280px と 760px で測った列の移動は次のとおり。

| 場面                                          | 中身の変化                                                                                       | 列の移動                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 行のリンクを押してからダイアログが開くまで    | リンクの label の横に `Spinner` (16px) と `gap-1` (4px) が足され、ボタンが 50px から 70px になる | 操作の列が +34px、ほかの列が合わせて -34px。760px では +20px。開いた時点で戻る              |
| 保存してから再取得が終わるまで                | 更新日時の cell が日時 (100〜124px) から「更新中」(42px) に替わる                                | その行の日時が列でいちばん幅の広い中身のとき (1 行の一覧など) に限り、その列が -114〜-122px |
| 保存や再取得で時刻が変わったとき              | Geist は比例数字で、字ごとに幅が違う (14px で "1111" は 19.83px、"0000" は 37.56px)              | 1〜10px                                                                                     |
| ダイアログの footer のボタンが pending のとき | Spinner と gap の分だけボタンが広がる (default は +22px、sm は +20px)                            | footer は `sm:justify-end` なので、隣のボタンが左へずれる                                   |

原因はどれも「操作中の表示が、置き換える前の中身と違う寸法を持つ」ことで、table の機構ではない。

### 守る決定

- `ui/` の改変は ADR-0020 の許容リストに限る。`ui/` に新しいファイルを足すと `registry-baseline.test.ts` が落ちる
- `ui/` の外へ class 文字列を配らない (ADR-0022)。素の要素に書く class は `no-restyle` の対象外
- 行の状態は読み順に入る静的テキストで持ち、`Spinner` は `aria-hidden` で視覚専用にする。項目に `role="status"` と `aria-busy` を付けない (ADR-0026)。幅の確保と、文言を見せたまま場所を保つことは禁じていない
- Action 層のボタンは、名前を `aria-labelledby` で children に固定する (ADR-0016、`docs/guides/react/updates.md`「Action 層の部品が守る契約」)

### 名前の計算

label を見えなくして Spinner を重ねると、名前の計算に影響する。隠し方で違いが出る ([accname 1.2][] の「Hidden Not Referenced」は `visibility: hidden` と `aria-hidden` を hidden とし、`opacity: 0` を hidden に入れない)。

| 隠し方                                          | accname 1.2 の扱い                                                        | Chromium 153 の accessibility tree (CDP、2026-10-13) |
| ----------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| `opacity: 0`、`color: transparent`              | hidden に入らない。name from content に残る                               | 「保存」                                             |
| `visibility: hidden`                            | 「Hidden Not Referenced」で、参照されない hidden のノードは名前から外れる | 空                                                   |
| `visibility: hidden` + `aria-labelledby` で指す | `aria-labelledby` で直接参照された hidden のノードは名前に含める          | 「保存」                                             |
| `visibility: hidden` + button の `aria-label`   | `aria-label` が名前になる                                                 | `aria-label` の値                                    |

`inline-grid` の同じマスに label と Spinner を重ねた構造でも、`visibility: hidden` の label は `aria-labelledby` で指したときだけ名前に残った (CDP の `Accessibility.getFullAXTree`、2026-10-13)。テストが使う名前の計算は別の実装で、`toHaveAccessibleName` (dom-accessibility-api) と `getByRole(..., { name })` (vitest の locator) も、`aria-labelledby` が有れば「保存」、無ければ空を返した (`src/components/parts/hold-size.test.tsx`、2026-10-13)。

### 先行例

pending / loading を prop で持つ Button 部品 (React Aria、Primer、Radix Themes、MUI、Mantine、Atlassian) は、どれも label を DOM に残したまま見えなくし、Spinner を上に重ねて幅を保つ (2026-10-13 に確認)。違いは label の消し方と、名前の保ち方にある。TanStack Router の kitchen-sink は label を隠さずに Spinner の場所を常に取り、shadcn と Base UI は幅を保たない。

| ライブラリ                                     | 保ち方                                                                                                                                 | 名前                                                                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [React Aria Components の Button][]「Pending」 | "To reserve space for the button's label while pending, either set it to `visibility: hidden` ... or set it to `opacity: 0`"           | `visibility: hidden` なら ProgressBar の `aria-label`、`opacity: 0` なら label がそのまま残る                 |
| [Primer の `ButtonBase`][]                     | Spinner を label と同じ `grid-area` に置き、label を `visibility: hidden`                                                              | `aria-labelledby` で label を指す ("the accessible name becomes unset when the button is in a loading state") |
| [Radix Themes の Button][] (`loading`)         | `loading` で children を `visibility: hidden` で包み、Spinner を absolute で重ねる (ソースの `base-button.tsx`、2026-10-13 に読んだ版) | `VisuallyHidden` に複製した label                                                                             |
| [MUI の Button][] (`loading`)                  | root を `color: transparent`、indicator を absolute                                                                                    | label がそのまま残る                                                                                          |
| [Mantine の Button][] (`loading`)              | 中身を `opacity: 0`、Loader を absolute                                                                                                | label がそのまま残る                                                                                          |
| [Atlassian の Button][] (`isLoading`)          | 中身を `opacity: 0`、overlay を absolute                                                                                               | label がそのまま残り、`VisuallyHidden` の ", Loading" を足す                                                  |
| [TanStack Router の kitchen-sink][]            | 行のリンクの Spinner を常に描き、`opacity-0` / `opacity-100` を切り替える (場所を常に取る)                                             | 変わらない                                                                                                    |
| [shadcn docs「Spinner」][] の Button の例      | 保たない。`<Spinner data-icon="inline-start" />` を label の前に並べる                                                                 | Spinner の `role="status"`                                                                                    |
| [Base UI docs「Button」][]「Loading states」   | 保たない。文言を差し替える                                                                                                             | "use `aria-labelledby` to make the changing text the button's explicit accessible name"                       |

shadcn は Button に loading を入れていない ([shadcn-ui/ui#10307][] のメンテナの返答 "This can be a project-based component instead of being in the registry.")。

テーブルの列幅は、[TanStack Table docs「Column Sizing」][] が `columnSizingFeature` と `style={{ width: header.getSize() }}` の形を示し、[TanStack/table#5115][] は "many people assume that TanStack Table will hook up the width CSS for you. It doesn't!" と書く。[MDN「table-layout」][] の `fixed` は "The horizontal layout doesn't depend on the contents of the cells" で、table に明示の `width` が要る。[Primer の DataTable の column][] は `'auto'` の幅を "Not intended for use with columns who's content length varies a lot because a layout shift will occur when the content changes" と警告する。

数字の幅は [MDN「font-variant-numeric」][] の `tabular-nums` ("numbers are all of the same size, allowing them to be easily aligned like in tables") でそろう。[GOV.UK Frontend の table][] は数値の cell に `tabular-nums` を当てる。Geist 5.3.0 の 14px で "1111" と "8888" は比例数字で 19.83px と 33.83px、`tabular-nums` でどちらも 33.61px だった (2026-10-13)。

## Decision

**操作中の表示は、置き換える前の中身を下敷きにして同じ場所に重ね、下敷きの寸法を保つ。一覧の列幅は中身に任せたまま (`table-layout: auto`) にし、列ごとの幅を持たない。**

| 対象              | 形                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 重ねる器          | `inline-grid` の同じマスに下敷きと重ねるものを置く。重ねるものがあるとき下敷きは `visibility: hidden` で寸法だけを残し、accessibility tree から外れる。器は素の `<span>` だけで組み、ui 部品に className を渡さない。実装は `src/components/parts/hold-size.tsx`                                                                                                                   |
| ボタンの pending  | label を下敷きに、`aria-hidden` の `Spinner` を中央に重ねる。Spinner に `data-icon` を付けない (`buttonVariants` の `has-data-[icon=inline-start]:pl-*` が padding を詰めて幅が変わる)。実装は `src/components/parts/pending-label.tsx`。Action 層 (`src/components/action/button.tsx`) と、`isPending` を渡したボタンの形のリンク (`src/components/parts/button-link.tsx`) が使う |
| pending 中の名前  | 下敷きの label は名前の計算から外れるので、ボタンは `aria-labelledby` で label を指すか `aria-label` を持つ。Action 層は `aria-labelledby` で label を指す。リンクは `isPending` を渡した呼び出しで、`aria-label` が無ければ部品が `aria-labelledby` を張る。`aria-labelledby` は両部品とも prop から外す                                                                          |
| リンクを包む条件  | `isPending` の prop を渡した呼び出しだけ children を包む。真偽ではなく有無で決めるので、pending の出入りで子の木が差し替わらず、渡さない呼び出しの DOM は変わらない                                                                                                                                                                                                                |
| 文言に替わる cell | 置き換える前の値を下敷きに、文言を重ねる。文言は見え、読み順に入る (ADR-0026)。下敷きの旧い値は見えず、読み上げにも入らない                                                                                                                                                                                                                                                        |
| 日時              | `formatDateTime` で整形し、`tabular-nums` を当てた `<time dateTime>` で描く。数字が替わっても幅が変わらない。実装は `src/components/parts/date-time-text.tsx`                                                                                                                                                                                                                      |
| 一覧テーブル      | `DataTable`、registry の `Table`、features、列定義は変えない。列ごとの `size` と `table-fixed` を持たない                                                                                                                                                                                                                                                                          |

### 置き場所

| 置き場所                 | 評価                                                                                                                                                                                                                 | 採否     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `src/components/parts/`  | ui 部品を組み合わせて配る部品の置き場 (ADR-0011)。`action/` から `parts/` への import は初めての向きだが、ADR-0011 も ADR-0016 も lint も向きを縛っていない。pending の見た目を変えるときに触るファイルが 1 つになる | **採用** |
| `src/components/ui/`     | ADR-0020 の追加の基準 (機能上の必要か、デザインが明示的に求める variant) への当たりが弱く、重ねる構造は DOM の追加が要るので `cva` の variant (class の切り替え) では書けない。台帳に行が増える                      | 却下     |
| `src/components/action/` | ファイル名を包む先と同名にする命名 (ADR-0016) に外れる。cell が使う器の置き場が無い                                                                                                                                  | 却下     |
| `src/components/` 直下   | 配る部品を直下へ置くと `componentImports` に入らず、素の要素に当てる見た目の上書きが検査から漏れる (ADR-0011)                                                                                                        | 却下     |

### 下敷きの隠し方

| 隠し方               | 評価                                                                                                                                                                                                                                            | 採否     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `visibility: hidden` | cell の旧い日時を読み上げに混ぜられないので、cell にはこれが要る。ボタンも同じにすると隠し方が 1 つになる。`aria-labelledby` が外れると pending 中の名前が空になり、`toHaveAccessibleName` が落ちる (`opacity: 0` では外しても通る盲点が閉じる) | **採用** |
| `opacity: 0`         | name from content が残るので名前の退行に強い。cell に使うと旧い日時が読み上げに混ざる。ボタンだけ `opacity: 0` にすると隠し方が 2 つになる                                                                                                      | 却下     |

### 比較した案

| 案                                                                                                                       | 評価                                                                                                                                                                                                                                                                                                                                                                                                        | 採否                          |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 置き換える前の中身を下敷きにして重ねる (Primer の形)                                                                     | ボタンにも cell にも同じ器で効く。label 自身が幅を決めるので、文言、size、icon だけのボタンのどれでも pending で幅が変わらない                                                                                                                                                                                                                                                                              | **採用**                      |
| shadcn 公式の `<Spinner data-icon="inline-start" />` を label の前に並べる ([shadcn docs「Spinner」][])                  | 公式の形だが幅を保たない。`has-data-[icon=inline-start]:pl-*` が padding を詰めるので、増分が default +20px、sm +16px に減るだけで列は動く                                                                                                                                                                                                                                                                  | 却下                          |
| `ui/button.tsx` に `loading` の prop か variant を足す                                                                   | ADR-0020 の乖離が増える。重ねる構造は DOM の追加が要り、`cva` の variant では書けない。shadcn 自身が Button に loading を入れない ([shadcn-ui/ui#10307][])                                                                                                                                                                                                                                                  | 却下                          |
| Spinner を常に描いて `opacity-0` / `opacity-100` を切り替える ([TanStack Router の kitchen-sink][])                      | 幅は保つが、通常時も Spinner の分だけ全ボタンが広く、label の右に空きが残る。`aria-hidden` の Spinner が常に DOM にあり、`data-slot="spinner"` で pending を判定しているテストが意味を失う                                                                                                                                                                                                                  | 却下                          |
| `table-fixed` + `columnSizingFeature` + `style={{ width: header.getSize() }}` ([TanStack Table docs「Column Sizing」][]) | 中身による列の移動を構造で止める。費用は、列ごとの `size` が列定義と `TableSkeleton` の 2 か所の手書きの数値になる、幅を超えた中身を切る `overflow-hidden` と `truncate` を `Table*` へ当てると `no-restyle` が止める、狭い viewport の切れ方を境界で実測する、ダイアログの footer のボタン (table の外) は守れない。sorting や列幅の変更をユーザーに開くときに入るので、そのとき列の `size` と一緒に決める | 採らない (再評価の条件を下に) |
| 「更新中」を日時と同じ幅の箱 (`min-w-[N]`) に入れる                                                                      | 幅の数値を書き写すことになり、書式やフォントが変わると黙って古くなる                                                                                                                                                                                                                                                                                                                                        | 却下                          |
| 「更新中」を `sr-only` へ移し、可視は行の半透明だけにする (削除中と同じ形)                                               | 列は動かないが、見える状態表示が消え、更新中の行の日時が古いまま見える                                                                                                                                                                                                                                                                                                                                      | 却下                          |
| Action 層の部品にリンクを `render` で渡し、Action 層でリンクも包む                                                       | Base UI の Button は button 以外を描くと `role="button"` を付け、リンクの role と `disabled` の扱い (ADR-0041 の `tabIndex={0}`) が壊れる                                                                                                                                                                                                                                                                   | 却下                          |
| table に `view-transition-name` を付けてクロスフェードから外す                                                           | 2 重の像だけが消え、列の移動は残る                                                                                                                                                                                                                                                                                                                                                                          | 却下                          |

### 育ったアプリへの効き方

利用者がテンプレートを元にしたアプリを育てたときに、何を足すと何が要るかで、採った形と `table-fixed` + column sizing を比べる。

| 足すもの                                | 採った形 (場所を取る + auto layout)            | `table-fixed` + column sizing                                                                                                           |
| --------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 列                                      | 何も要らない。中身が列幅を決める               | 列ごとに `size` を決める。決めない列は残りの幅を均等に割られる。`TableSkeleton` も同じ幅を持つ必要がある                                |
| 長い中身の列                            | 中身が広がる                                   | 幅で切れる。切るための class は `Table*` に当てられず、cell の素の要素か `ui/table.tsx` の乖離になる                                    |
| 日時の列                                | `DateTimeText` を使えば揺れない                | 揺れない                                                                                                                                |
| 日時以外の値を操作中の文言に替える cell | 置き換える前の値を下敷きにする。忘れると揺れる | 何も要らない                                                                                                                            |
| 操作の列のボタン                        | Action 層か `isPending` を使えば揺れない       | 同じ部品が要る。固定幅の中で Spinner が並ぶと溢れて切れる                                                                               |
| 狭い viewport                           | auto layout が配分する                         | 列幅の合計より狭いと、table の `min-w` と境界の viewport での実測が要る (`docs/guides/styling-and-tokens.md`「列幅の決まる部品を測る」) |

column sizing が強いのは「日時以外の値を操作中の文言に替える cell」の行だけで、ほかの行では列を足すたびに数値を 2 か所へ手で同期させる。

## Consequences

- 行のリンクを押してからダイアログが開くまでと、1 行の一覧で保存してから再取得が終わるまで、列見出しの幅は 0.5px 未満しか動かない。列見出しの幅を `requestAnimationFrame` ごとに記録する helper (`src/test/assert/column-widths.ts`) で見る。書き方は `docs/guides/testing/waiting-and-assertions.md`「レイアウトを実測で確かめる」
- pending 中のボタンは label が見えず、Spinner だけが見える。label に Spinner を重ねて幅を保つ先行例は、どれも pending で label を隠すので、幅を保つことと引き換えに受け入れる
- Action 層の `aria-labelledby` が外れると、pending 中の名前が空になり `toHaveAccessibleName` が落ちる。pending 中の名前を確かめるテストが、名前の固定の退行を捕まえる
- `isPending` を渡した呼び出しのリンクは、children が 1 つの `<span>` に入る。icon と文字を children に並べると `buttonVariants` の `gap-*` が効かない。渡さない呼び出しは変わらない
- `size="icon*"` のボタンの pending は、Spinner が icon の場所に重なり正方形から溢れない (`src/components/action/button-shell.stories.tsx`)
- `variant="link"` の下線は、`inline-grid` の器が flex item として blockify されるので、下敷きの label に伝わる (2026-10-13 に実測)
- 残る穴: Action 層でも `isPending` のリンクでもない素の `Button` に `PendingLabel` を直接置き、`aria-labelledby` も `aria-label` も張らない経路は、pending 中の名前が空になる。story の axe (`button-name`) がその story でだけ捕まえる
- 残る穴: 日時以外の値を操作中の文言に替える cell は、置き換える前の値を下敷きにしないと列が動く。lint では見つからないので、cell を書くときにレビューで見る (`docs/guides/lists-and-search.md`「一覧テーブルを組む」)
- 対象外: 中身そのものが変わる列の移動 (title を長く編集した、新しい行の title が長い) は止めない。表示する値の変化で、操作中の表示ではない。読み込み直後の列の移動と、`TableSkeleton` から本体への置き換えの列の移動も対象外
- 保存中の行の「保存中」は日時の幅を持たない。列幅は他の行の日時が決め、0 件からの追加は `Empty` と table の切り替えになる
- 未調査: Firefox と WebKit での `visibility: hidden` + `aria-labelledby` の名前の計算 (browser project は Chromium だけ)。accname 1.2 は残すと書き、Primer が同じ形で出荷している
- 再評価の条件: sorting か列幅の変更をユーザーに開くときに、`columnSizingFeature` と列の `size` を一緒に決める。Base UI か shadcn が Button の loading を出荷したら、`PendingLabel` をそちらへ寄せられるかを見る

## 出典

本文の出典の名前はリンクで、名前と URL の対応は下のリンクの定義にある。先行例の表は、2026-10-13 に各ライブラリの docs とソースを読んだ結果による。

[React Aria Components の Button]: https://react-aria.adobe.com/Button
[Primer の `ButtonBase`]: https://github.com/primer/react/blob/main/packages/react/src/Button/ButtonBase.tsx
[Radix Themes の Button]: https://www.radix-ui.com/themes/docs/components/button
[MUI の Button]: https://mui.com/material-ui/react-button/
[Mantine の Button]: https://mantine.dev/core/button/
[Atlassian の Button]: https://atlassian.design/components/button/examples
[TanStack Router の kitchen-sink]: https://github.com/TanStack/router/blob/main/examples/react/kitchen-sink/src/main.tsx
[shadcn docs「Spinner」]: https://ui.shadcn.com/docs/components/spinner
[Base UI docs「Button」]: https://base-ui.com/react/components/button
[shadcn-ui/ui#10307]: https://github.com/shadcn-ui/ui/pull/10307
[TanStack Table docs「Column Sizing」]: https://tanstack.com/table/latest/docs/framework/react/guide/column-sizing
[TanStack/table#5115]: https://github.com/TanStack/table/issues/5115
[MDN「table-layout」]: https://developer.mozilla.org/en-US/docs/Web/CSS/table-layout
[Primer の DataTable の column]: https://github.com/primer/react/blob/main/packages/react/src/DataTable/column.ts
[MDN「font-variant-numeric」]: https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric
[GOV.UK Frontend の table]: https://github.com/alphagov/govuk-frontend/blob/main/packages/govuk-frontend/src/govuk/components/table/_index.scss
[accname 1.2]: https://www.w3.org/TR/accname-1.2/
