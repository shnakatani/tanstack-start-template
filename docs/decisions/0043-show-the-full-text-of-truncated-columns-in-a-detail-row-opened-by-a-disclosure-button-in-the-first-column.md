# ADR-0043: 一覧で切り詰めた中身の全文は、先頭の列のボタンで行を開き、全列をまたぐ詳細の行に出す

- Status: Accepted
- Date: 2026-10-13
- 関連: ADR-0017 (止めるのは対象の項目の操作だけ)、ADR-0018 (一覧テーブルは registry の Table に描く)、ADR-0022 (外見は部品・prop・variant で配る)、ADR-0026 (項目の状態は静的テキストで持ち、live region を足さない)、ADR-0042 (列幅と切り詰めの条件)

## Context

ADR-0042 は、cell の中身を 1 行に切り詰める (`truncate`) のを、[WCAG 2.2 Understanding 1.4.4][] が切り詰めを許す 2 つの条件を満たす列に限る。

> truncation is acceptable if the component's full content is available on focus or after user activation and an indication that this information can be accessed, is provided to the user in some way besides the fact that it is truncated.

切り詰めた cell は focus できず、cell を見ても全文を読む手段と、読めることを示すものが無い。切り詰める列を持つ一覧には、2 つの条件を一覧の上で満たす手段が要る。

形を決める制約は次のとおり。

| 制約                                                                             | 出典                                                                                                                                                                                                                                                                                        | 効き方                                                                                                                          |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| TanStack Table は開閉の state だけを持ち、開閉のボタンと詳細の中身は描画側が描く | 同梱 skill `@tanstack/table-core#table-features` の expanding の reference の冒頭: "the renderer owns disclosure controls and detail panels."                                                                                                                                               | ボタンの置き場、名前、詳細の行の markup はこちらで決める                                                                        |
| 開いた行は、`data` の参照が変わるたびに閉じる (`autoResetExpanded` の既定)       | [TanStack Table docs「Expanding」][] の Auto Reset Expanded State は grouping を使う場合として書くが、9.2.6 では core row model の再計算でも閉じた。`DataTable` から `autoResetExpanded: false` を外すと、同じ id の行を持つ data で描き直したテストで、開いた行が閉じて落ちた (2026-10-13) | 操作中の行の表示のために data を組み直す一覧では、ほかの行の操作が始まるたびに開いた行が閉じる                                  |
| 列見出しが空だと、axe の `empty-table-header` に当たる                           | axe-core 4.14.0 の rule 定義。story とブラウザテストの axe はどちらも best-practice の rule を外していない                                                                                                                                                                                  | upstream の example の `header: () => null` をそのまま使えない                                                                  |
| 開いた状態は row id をキーに持つ                                                 | `@tanstack/table-core` 9.2.6 の `ExpandedState` (`true \| Record<string, boolean>`)                                                                                                                                                                                                         | `getRowId` を渡さない表では位置が row id になる。開いた状態を data の描き直しで保つと、行が消えたときに開いた状態が隣の行へ移る |

## Decision

**切り詰める列を持つ一覧は、先頭に行を開くボタンの列を置き、押すと本体の行の直後に全列をまたぐ 1 つの cell の行を出して、そこに全文を折り返して描く。ボタンは `aria-expanded` を持つ native の button で、名前は開示する中身を指し、開閉で変えない。`DataTable` は行を開く 2 つの prop を対で受け、そのときは `getRowId` も必須にし、開いた状態を data の描き直しで戻さない。**

| 対象                | 形                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| features            | `dataTableFeatures` に `rowExpandingFeature` と `expandedRowModel: createExpandedRowModel()` を登録する。詳細の行だけなら行の並びは変わらないが、[TanStack Table docs「Expanding」][] と example の [`sub-components`][] はどちらも対で登録する                                                                                                                                                                                    |
| `DataTable` の prop | [`sub-components`][] と同じ名前の `getRowCanExpand` と `renderSubComponent({ row })` を受ける。2 つは union で対にし、対で渡すときは `getRowId` も型で必須にする。片方だけでは、開いても何も出ないか、開く手段が無い。`renderSubComponent` の戻り値は `ReactNode`                                                                                                                                                                  |
| 開いた状態の保ち方  | `DataTable` が `autoResetExpanded: false` を固定する。prop にしない                                                                                                                                                                                                                                                                                                                                                                |
| 詳細の行            | `<Fragment key={row.id}>` の中で、本体の行の後に registry の `TableRow` と `TableCell colSpan={row.getAllCells().length}` を描く ([`sub-components`][] と同じ形)。`row.getCanExpand() && row.getIsExpanded()` のときだけ描く。開いたあとに開けなくなった行 (中身が消えたなど) はボタンも消えるので、詳細だけ残ると閉じる手段が無い。本体の行と同じ `data-busy` を渡し、半透明をそろえる。`DataTable` は詳細の行に class を渡さない |
| 折り返し            | `renderSubComponent` が返す素の要素で `whitespace-normal` と `wrap-break-word` に戻す。registry の `TableCell` は `whitespace-nowrap` を持つ                                                                                                                                                                                                                                                                                       |
| ボタンの列          | 先頭に `display` の列を置く ([`sub-components`][] の `expander` 列、[Carbon の `TableExpandRow`][])。開閉は行の state なので、切り詰める列が増えても 1 つのボタンが行を開く。見出しは可視の文字にする。列の `size` はボタンが root の文字サイズ 200% でも 1 行に収まる幅にする (ADR-0042)                                                                                                                                          |
| ボタン              | native の `button` に `aria-expanded` を付け、Enter と Space は button が持つ ([APG「Disclosure (Show/Hide) Pattern」][])。名前は「<対象>の<開示する中身>を表示」の形で `aria-label` に置き、開閉で変えない。アイコンは向きで開閉を示し、`aria-hidden` にする。開閉を live region で知らせない (ADR-0026)                                                                                                                          |
| 開閉の状態の読み方  | ボタンの cell の部品の中で `Subscribe` (`source={row.table.atoms.expanded}`) して読む。cell の部品には開閉の前後で同じ `row` が渡るので、Compiler が前の描画を使い回すことがある ([TanStack Table docs「React Compiler」][] の Passing Table Objects to Nested Components)                                                                                                                                                         |
| 開ける行            | 出す中身が無い行と、確定すると row id が変わる行 (保存中の行など) には、`getRowCanExpand` で false を返す。row id が変わると開いた状態ごとボタンが消え、focus が body へ落ちる。更新中と削除中の行は開ける。ADR-0017 が止めるのはデータを変える操作で、開閉はデータを変えない                                                                                                                                                      |

### 全文の出し方

| 案                                               | 評価                                                                                                                                                                                                                                                                                                      | 採否     |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 先頭の列のボタンで行を開き、詳細の行に全文を出す | [`sub-components`][] と [Carbon の `TableExpandRow`][] の形。ボタンと見出しが、開ける中身があることを切れていること以外で示す。ネイティブの table のまま、ボタンは tab 順の 1 つの stop になる ([APG「Table Pattern」][]: "each widget contained in a table is a separate stop in the page tab sequence") | 採る     |
| [`sub-components`][] をそのまま使う              | 見出しが空 (`header: () => null`) で axe の `empty-table-header` に当たる。ボタンは絵文字だけで、名前と `aria-expanded` が無い。`getRowId` を渡さないので、行が消えると開いた状態が隣の行へ移る。外れる 3 点は上の表の「ボタンの列」「ボタン」「`DataTable` の prop」の行                                 | 採らない |
| 切り詰めた cell の中にボタンを置く               | 列を足さずに済むが、開閉は行の state で、切り詰める列が 2 つになると同じ行の状態を 2 つのボタンが持つ。upstream にも Carbon にも無い                                                                                                                                                                      | 採らない |
| `title` 属性か tooltip で全文を出す              | hover でしか出ず、キーボードと touch では全文を得られない                                                                                                                                                                                                                                                 | 採らない |
| 行の編集のダイアログを、全文を得る手段と見なす   | 入力欄に全文は出るが、そこで全文を読めることを示すものが行に無い。更新中と削除中の行では開けない                                                                                                                                                                                                          | 採らない |
| treegrid にする                                  | 行か cell に `aria-expanded` を置き、grid のキー操作 (矢印キーでの移動) を実装することになる ([APG「Treegrid Pattern」][])                                                                                                                                                                                | 採らない |

### ボタンの名前と結び付け

| 案                                                                                              | 評価                                                                                                                                                                                                    | 採否     |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 対象と開示する中身を名前にし、開閉で変えない                                                    | 状態は `aria-expanded` が持つ ([APG「Disclosure (Show/Hide) Pattern」][] の WAI-ARIA Roles, States, and Properties)。行の操作 (編集、削除) と同じく対象を名前に含め、行が増えても読み上げで対象が分かる | 採る     |
| 開閉で名前を変える ([Carbon の `DataTable`][] の `Expand current row` / `Collapse current row`) | 状態を名前と `aria-expanded` の両方で伝える。名前に対象を含まないので、どの行のボタンも同じ名前になる                                                                                                   | 採らない |
| `aria-controls` で詳細の行を指す                                                                | APG は "Optionally" とする。詳細の行の id を `DataTable` と cell の部品で合わせる配線が要り、同じページに表が 2 つあると id の決め方も要る                                                              | 採らない |

### 列見出し

| 案                        | 評価                                                                                          | 採否     |
| ------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| 可視の文字                | axe を通り、読み込み中の `TableSkeleton` も見出しを可視の文字で描くので、本体と見え方がそろう | 採る     |
| 空 (`header: () => null`) | axe の `empty-table-header` に当たる                                                          | 採らない |
| `sr-only` の文字          | `TableSkeleton` は見出しを可視で描くので、読み込み中と本体で見え方が割れる                    | 採らない |

### `getRowId` を求める形

| 案                                                     | 評価                                                                                                                 | 採否     |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------- |
| 行を開く 2 つの prop と `getRowId` を union で対にする | 渡し忘れを型が止める。`DataTable` の型テスト (`data-table.test-d.ts`) が、片方だけと `getRowId` 抜きを型エラーにする | 採る     |
| docstring で `getRowId` を求める                       | 渡し忘れても、行が消えたときに開いた状態が隣の行へ移るだけで、何も落ちない                                           | 採らない |

## Consequences

- 一覧の列が 1 つ増え、既定の文字サイズで表の幅がその列の `size` だけ広がる
- ボタンの列の `size` は、root の文字サイズを 32px にした 760px の一覧で、cell の `scrollWidth - clientWidth` がどの cell も 0 になることで決めた。56 でも 48 でも 0 だった。48 はボタン (`icon-sm` の 2rem) と cell の左右の余白 (1rem) の和にちょうど等しく、余りが無いので 56 にした (2026-10-13、vitest の browser project の Chromium)
- 開いた行には、registry の `TableRow` の `has-aria-expanded:bg-muted/50` で背景が付き、詳細の行には付かない。同じ行の中で `aria-expanded="true"` を持つ要素 (確認ダイアログを開いている間の削除のトリガーなど) があるときも同じ背景が付く (2026-10-13、dev server を Playwright の Chromium で開いて `backgroundColor` を読んだ)
- 列の合計より狭い viewport では、表は横に scroll し (ADR-0042)、詳細の行は表の幅で折り返す。全文は読めるが、1 行が viewport より長くなり、横に scroll して読む。760px で root の文字サイズを 32px にした一覧では、表の幅は約 2100px だった (同じ日、同じ環境)
- 確定すると row id が変わる行は開けない。開いた行が消えると、その id が開いた状態に残る。表示には出ず、閉じる操作は常に許される (`row.toggleExpanded` は閉じる側を止めない)
- `renderSubComponent` は `DataTable` が関数として呼ぶ。hook を呼ぶ関数を渡すと、開いた行の数で hook の数が変わる
- 中身が短く切れていない行にもボタンが出る。切れているかの計測は足さない
- 再評価の条件: 木構造の行 (subRows) を開く表を足すときは、`expandedRowModel` が子の行を挿入するので、詳細の行と同じ表で両立するかを比べ直す。sorting や pagination を足すときは、行の並びが変わっても開いた状態が row id で保たれることを確かめる

## 出典

[WCAG 2.2 Understanding 1.4.4]: https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html
[APG「Disclosure (Show/Hide) Pattern」]: https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
[APG「Table Pattern」]: https://www.w3.org/WAI/ARIA/apg/patterns/table/
[APG「Treegrid Pattern」]: https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/
[TanStack Table docs「Expanding」]: https://tanstack.com/table/latest/docs/framework/react/guide/expanding
[TanStack Table docs「React Compiler」]: https://tanstack.com/table/latest/docs/framework/react/guide/react-compiler
[`sub-components`]: https://github.com/TanStack/table/blob/95c4768496c07b45b1e65d8e33c3291ac66eae9b/examples/react/sub-components/src/main.tsx
[Carbon の `TableExpandRow`]: https://github.com/carbon-design-system/carbon/blob/d68ade069ec4017d835cb085c7ebb3ee0883f53e/packages/react/src/components/DataTable/TableExpandRow.tsx
[Carbon の `DataTable`]: https://github.com/carbon-design-system/carbon/blob/d68ade069ec4017d835cb085c7ebb3ee0883f53e/packages/react/src/components/DataTable/DataTable.tsx
