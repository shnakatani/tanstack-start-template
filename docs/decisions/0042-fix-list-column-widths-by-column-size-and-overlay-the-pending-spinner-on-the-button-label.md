# ADR-0042: 一覧の列幅は列ごとの size と fixed layout で固定し、ボタンの pending の Spinner は label の場所に重ねる

- Status: Accepted
- Date: 2026-10-13
- 関連: ADR-0016 (Action 層の pending と名前)、ADR-0018 (一覧テーブルは registry の Table に描く)、ADR-0020 (registry コードの改変は許容リストに限る)、ADR-0022 (外見は部品・prop・variant で配る)、ADR-0026 (項目の状態は静的テキストで持ち、Spinner は `aria-hidden`)、ADR-0040 (遷移のクロスフェード)

## Context

registry の `Table` は `table-layout: auto` で、列幅は cell の中身の幅で決まる。auto layout の列幅の算出は UA に任されている ([CSS 2.1][] の 17.5.2.2: "UAs are not required to implement this algorithm")。Chromium は列見出しに `width` を当てても、table の幅が足りないと列をその幅より狭く詰めた (`size` が 200 と 120 の 2 列を 160px の器に入れると、`table-fixed` が無いとき 95.8px と 64.2px。2026-10-13、`DataTable` の部品のテスト)。操作中の表示が中身の幅を変えると、その間だけ列が動く。遷移のクロスフェード (ADR-0040) は、旧い像と新しい像の列の差を 2 重の像として見せる。

操作中の表示が中身の幅を変える場面と、列見出しの幅の移動は次のとおり。

| 場面                                       | 中身の変化                                                                 | dev server (2026-10-12) | ブラウザテスト (2026-10-13)                                            |
| ------------------------------------------ | -------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------- |
| 行のリンクを押してからダイアログが開くまで | label の横に `Spinner` と gap が足され、ボタンが 22px 広がる               | ボタンの列が +34px      | 1280px でボタンの列が +15.9px (ほかの列が合わせて縮む)、760px で +20px |
| 1 行の一覧で保存してから再取得が終わるまで | 日時の cell が「更新中」に替わる。1 行なので、その日時が列の幅を決めていた | 日時の列が -114〜-122px | 1280px で -99.5px、760px で -58.0px                                    |
| 読み込み中の `TableSkeleton` から本体へ    | skeleton の行と本体の行で中身が違う                                        | 未測定                  | 1280px で折り返す文字の列が -98.2px、切り詰める文字の列が +135.5px     |
| ダイアログの footer のボタンが pending     | Spinner と gap の分だけボタンが広がる                                      | default +22px、sm +20px | 未測定 (table の外)                                                    |

dev server の値は Playwright 1.63.0 の Chromium で dev server を開き、viewport 1280px と 760px で測った。ブラウザテストの値は、同じ Playwright の Chromium で動く vitest の browser project で、操作の前と pending の間に列見出しの `getBoundingClientRect().width` を読んで比べた。2 つの環境では table の幅と中身が違い、移動量もそろわない。

ボタンの幅は、どの列の幅の決め方を選んでも残る。固定の幅の cell の中で広がったボタンは cell からはみ出し、table の外のボタンは隣を押しのける。

列の幅を px で固定すると、文字だけを拡大しても列は広がらない。[WCAG 2.2 Understanding 1.4.4][] は、利用者が文字の大きさを変える手段に "text-only resizing" を挙げ、200% まで拡大できることを基準にする。失敗例の [F69][] は、拡大で文字が "clipped, truncated, or obscured" になる場合である。列見出しに `size` を px のまま当てると、1 行に保つ日時とボタンの cell の中身が cell の幅を超え、右隣の列へはみ出した。

| root の文字サイズ | 1280px の viewport | 760px の viewport   |
| ----------------- | ------------------ | ------------------- |
| 16px (既定)       | 0 / 0 / 0 / 0      | 0 / 0 / 0 / 0       |
| 20px              | 0 / 0 / 0 / 0      | 2 / 10 / 10 / 8     |
| 24px              | 0 / 0 / 0 / 0      | 24 / 43 / 43 / 36   |
| 32px (200%)       | 39 / 66 / 66 / 54  | 70 / 108 / 108 / 92 |

値は 1 行に保つ 4 列 (日付の列、日時の 2 列、ボタンの列の順) の cell の `scrollWidth - clientWidth` (px) で、2 行のうち大きい方である。vitest の browser project (Playwright 1.63.0 の Chromium) で root の `font-size` を変えて測った (2026-10-13)。1280px で 24px まで 0 なのは、既定の文字サイズでの列の size の合計より器が広く、余りの幅が列に配られて中身が収まったためである。`size` を rem に換算して当てると、どの組でも 0 になった (同じ日、同じ環境)。

## Decision

**一覧の列は、列ごとに数値の `size` を持ち、`DataTable` が `table-fixed` の `Table` の列見出しにその幅を当てる。中身の幅で列を変えない。`size` は既定の文字サイズのときの px で持ち、rem に換算して当てる (文字だけを拡大しても列が文字と一緒に広がる)。ボタンの pending は、label を `opacity-0` で隠して同じ場所に `Spinner` を重ね、label の幅を保つ。**

| 対象             | 形                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| features         | `dataTableFeatures` に `columnSizingFeature` を登録する。列幅は数値の state で、DOM への当て方は描画側が決める (同梱 skill `@tanstack/table-core#table-features` の column sizing の reference: "Sizing is numeric state; translating it to layout is a renderer decision.")                                                                                                                                                                                                                                                                                                                                  |
| 列の幅           | 列ごとに `size` (既定の文字サイズ 16px のときの px の数値) を持つ。見出しと幅を列の id ごとに 1 つの定数に置き、列定義は `columnBaseFrom`、読み込み中の `TableSkeleton` は同じ定数から受ける                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 描画             | `<Table className="table-fixed">` にし、`TableHead` に `style={{ width: columnWidthFrom(header.getSize()) }}` を当てる。列見出しの `style` に size を当てる形は [TanStack Table docs「Column Sizing」][] と example の [`column-sizing`][] と同じで、単位だけを rem にする。`columnWidthFrom` (`src/components/parts/data-table-columns.ts`) が `size` を rem に換算し、`TableSkeleton` も同じ関数で当てる (「文字だけを拡大したときの列の幅」)。registry の `Table` の `w-full` は残し、列の合計を超える幅は列に配られる ([CSS 2.1][] の 17.5.2.1: "the extra space should be distributed over the columns") |
| `td` の幅        | 当てない。fixed layout は列幅を `col` か最初の行の cell の `width` から決め ([CSS 2.1][] の 17.5.2.1)、最初の行は thead の列見出しになる                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 幅を超えた中身   | cell の部品の中の素の要素で扱う。長くなる文字の列は折り返す (`whitespace-normal` と区切りの無い文字列を折る `wrap-break-word`)。行の詳細や編集の画面で全文を読める列は、1 行に切り詰めてよい (`truncate`)。全文を読む手段が無い列 (日時、ボタン) は、中身が 1 行に収まる `size` を持たせる。列の合計より狭い viewport では、registry の table-container の `overflow-x-auto` で横に scroll する                                                                                                                                                                                                               |
| ボタンの pending | `PendingLabel` (`src/components/parts/pending-label.tsx`) が、素の span の `inline-grid` の同じ領域に label と `Spinner` (`aria-hidden`、`data-icon` なし) を重ね、pending の間だけ label を `opacity-0` にする。`ActionButtonShell` と、`isPending` を渡した `ButtonLink` が使う                                                                                                                                                                                                                                                                                                                             |
| pending 中の名前 | `opacity: 0` の label は名前に残る ([accname 1.2][] の「Hidden Not Referenced」は `opacity: 0` を hidden に数えない)。名前を補う配線は足さない。状態は `aria-disabled` と announce で伝える (ADR-0026)                                                                                                                                                                                                                                                                                                                                                                                                        |

### 列幅の決め方

| 案                                                                               | 評価                                                                                                                                                                                                                                                | 採否     |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 全列に `size` を持たせ、`table-fixed` の列見出しに当てる                         | 列幅が中身に依らず ([CSS 2.1][] の 17.5.2.1: "the horizontal layout of the table does not depend on the contents of the cells")、操作中の表示、読み込み中からの置き換え、検索で行が替わるときのどれでも列が動かない。列を足すときは `size` を決める | 採る     |
| TanStack の example のまま、table の幅を列の合計 (`table.getTotalSize()`) にする | example の形だが、広い画面では表が列の合計で止まり、右に余白が残る                                                                                                                                                                                  | 採らない |
| 1 列だけ幅を当てずに伸ばし、残りに `size` を当てる                               | 伸ばす列を指す概念が TanStack Table に無く、列定義に自前の印が要る                                                                                                                                                                                  | 採らない |
| auto layout のまま、操作中の cell ごとに旧い中身の幅を保つ                       | 操作中の表示を出す cell ごとに当てる必要があり、当て忘れた cell で揺れる。読み込み中からの置き換えや検索で行が替わるときの列の移動は止まらない                                                                                                      | 採らない |
| 列ごとの幅を `'auto'` (中身の幅) にする ([Primer の DataTable の column][])      | Primer 自身が "Not intended for use with columns who’s content length varies a lot because a layout shift will occur when the content changes" と警告する。今の auto layout と同じ揺れが残る                                                        | 採らない |

### 文字だけを拡大したときの列の幅

`columnWidthFrom` は `size` を 16 で割った rem を返す。1rem は root の文字サイズで ([CSS Values 4][] の `rem`)、ブラウザの既定は 16px ([MDN「font-size」][] の Ems) なので、既定の文字サイズでは `size` の px と同じ幅になる。TanStack Table は size の数値を "usually interpreted as pixel unit values, but you can hook up these column sizing values to your css styles however you see fit" とし ([TanStack Table docs「Column Sizing」][])、CSS への当て方を描画側に任せる。

| 案                                     | 評価                                                                                                                                                                                                                              | 採否     |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `size` を rem に換算して当てる         | 列が文字と同じ比で広がり、Context の実測のどの組でも中身が cell に収まった。列の合計が viewport を超えた分は横に scroll する。`size` は既定の文字サイズのときの px のまま書ける                                                   | 採る     |
| `size` を px のまま当てる              | TanStack Table の example の形だが、文字だけを拡大すると日時と操作の中身が右隣の列へはみ出す (Context の実測)                                                                                                                     | 採らない |
| 日時の cell を折り返す                 | 拡大したときに日時が 2 行に割れる。日時を持たない行 (保存中の行の日時は空) と行の高さがそろわない                                                                                                                                 | 採らない |
| 日時の cell を `truncate` で切り詰める | [WCAG 2.2 Understanding 1.4.4][] が切り詰めを許すのは、全文を focus か操作で得られ、得られることを切れていること以外の手段で示すとき ("truncation is acceptable if ...")。日時の cell は focus できず、切った残りを読む手段が無い | 採らない |

### ボタンの幅の保ち方

| 案                                                                                                  | 評価                                                                                                                                                                                                                                                                                                                                                                                                                       | 採否     |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| label を `opacity: 0` にして Spinner を重ねる ([React Aria Components の Button][]「Pending」)      | "To reserve space for the button's label while pending, either set it to `visibility: hidden` ... or set it to `opacity: 0`"。`opacity: 0` の label は名前に残るので、名前の配線が要らない。Spinner は `aria-hidden` なので名前は label だけになる。原文は label と ProgressBar の `aria-label` を合わせて名前にする前提だが、ここでは Spinner を `aria-hidden` にし、状態は `aria-disabled` と announce で持つ (ADR-0026) | 採る     |
| label を `visibility: hidden` にして `aria-labelledby` で指す ([Primer の `ButtonBase`][])          | hidden の label は名前から外れるので ("the accessible name becomes unset when the button is in a loading state")、`aria-labelledby` で直接指して名前を補う配線が部品ごとに要る                                                                                                                                                                                                                                             | 採らない |
| `<Spinner data-icon="inline-start" />` を label の前に並べる ([shadcn docs「Spinner」][])           | 公式の例だが、pending の間だけ幅が広がる                                                                                                                                                                                                                                                                                                                                                                                   | 採らない |
| Spinner を常に描き、`opacity-0` と `opacity-100` を切り替える ([TanStack Router の kitchen-sink][]) | 幅は保つが、pending でないときも全ボタンが Spinner の分だけ広く、label の横に空きが残る                                                                                                                                                                                                                                                                                                                                    | 採らない |

## Consequences

- 列見出しの幅は列の `size` と、器の余りの幅の配分で決まり、中身で変わらない。`DataTable` と `TableSkeleton` の部品のテストが、列の合計より狭い器の中で列見出しの幅が `size` と等しいことを見る。`table-fixed` を外すと auto layout が列を詰め、`style` の幅を外すと fixed layout が列を均等に割るので、どちらも落ちる (2026-10-13 に確かめた)
- 列の幅は root の文字サイズに比例する。文字を拡大すると列の合計も広がり、狭い viewport ほど早く横に scroll する
- 列を足すときは `size` を決める。見出しと幅の定数は `DataTableColumnBase` の型で幅を必須にしている。値は中身に合わせて決め、実測で 1 行に収まることを見る
- 列の合計より狭い viewport では表が横に scroll する。auto layout のように中身の最小幅まで列を詰めない
- `table-fixed` だけを外すと、1280px の 2 つの場面、760px の編集の場面、読み込み中からの置き換えでは列は動かなかった。760px では列が `size` より狭く詰められ (折り返す文字の列が 87.6px)、保存の場面で日時の列が -42.6px 動いた (2026-10-13、ブラウザテスト)。`size` だけでは、列の合計が table の幅を超えたときに列が動く
- pending 中のボタンは label が見えず、Spinner だけが見える。幅を保つことと引き換えに受け入れる
- `isPending` を渡した `ButtonLink` は、children が 1 つの span に入る。icon と文字を children に並べると、`buttonVariants` の `gap-*` が間に効かない。渡さない呼び出しの DOM は変わらない
- `ActionButtonShell` は名前を `aria-labelledby` で children に固定している (ADR-0016)。指す span は label の中にあるので、label を `visibility: hidden` に変えても名前は残る (直接指された hidden のノードは名前に入る)。label の隠し方の退行は、`aria-labelledby` を持たない `ButtonLink` のテストが名前の空で捕まえる
- 再評価の条件: 列幅の変更 (`columnResizingFeature`) をユーザーに開くときは、`size` を state の初期値に回し、`table.getTotalSize()` で table の幅を持つ形を比べ直す。列の固定 (`columnPinningFeature`) を足すときは、描かれる幅が `size` と一致しない (`w-full` の余りが列に配られる) ので、offset の計算と合うかを確かめる。Base UI か shadcn が Button の pending を出荷したら、`PendingLabel` をそちらへ寄せられるかを見る

## 出典

[CSS 2.1]: https://www.w3.org/TR/CSS21/tables.html#width-layout
[CSS Values 4]: https://www.w3.org/TR/css-values-4/#rem
[MDN「font-size」]: https://developer.mozilla.org/en-US/docs/Web/CSS/font-size
[WCAG 2.2 Understanding 1.4.4]: https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html
[F69]: https://www.w3.org/WAI/WCAG22/Techniques/failures/F69
[TanStack Table docs「Column Sizing」]: https://tanstack.com/table/latest/docs/framework/react/guide/column-sizing
[`column-sizing`]: https://github.com/TanStack/table/blob/95c4768496c07b45b1e65d8e33c3291ac66eae9b/examples/react/column-sizing/src/main.tsx
[Primer の DataTable の column]: https://github.com/primer/react/blob/7f5303d803986887187d86dcebaeda22a4dc6823/packages/react/src/DataTable/column.ts
[React Aria Components の Button]: https://react-aria.adobe.com/Button
[accname 1.2]: https://www.w3.org/TR/accname-1.2/
[Primer の `ButtonBase`]: https://github.com/primer/react/blob/7f5303d803986887187d86dcebaeda22a4dc6823/packages/react/src/Button/ButtonBase.tsx
[shadcn docs「Spinner」]: https://ui.shadcn.com/docs/components/spinner
[TanStack Router の kitchen-sink]: https://github.com/TanStack/router/blob/4ff63eb8a469d5f318dd31579c03c867c88f0384/examples/react/kitchen-sink-file-based/src/components/Spinner.tsx
