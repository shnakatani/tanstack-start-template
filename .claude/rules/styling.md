---
paths:
  - "src/**/*.tsx"
  - "src/**/*.css"
  - ".storybook/**"
---

# スタイリング規約

## 色は semantic token のみ

palette 色・任意値・SVG 属性への色の直書きは lint (`shadcn/no-raw-colors`、`shadcn/no-arbitrary-values`) が止める。直し方:

- semantic token を使う。淡色ハイライトは `bg-primary/10` のような opacity variant、SVG の `fill` / `stroke` は `currentColor` か token
- 新しい「意味のある色」は `src/styles.css` の `:root` / `.dark` に CSS 変数を定義してから使う。露出は下表で選び、値は ADR-0034 の段に乗せる
- `var(--...)` だけを材料にした `color-mix()` は、行単位で `no-arbitrary-values` を抑制して書く。registry 内なら ADR-0026 の許容リストにも記録する
- 破壊操作は常時 destructive 色にする。テキストボタンは `destructive`、アイコンボタンは `destructive-ghost`。hover だけの着色は touch 環境で出ない
- `src/styles.css` の `@theme` (`--color-*: initial`) は import より後ろ、`@theme inline` より前に置く。後ろへ動かすと semantic token まで消える
- 比を測るときは `mise run contrast` を使う。トークンで動く比は文書やコメントへ書き写さない (ADR-0039)
- コントラストは本文 4.5:1、アイコンと UI 部品 3:1 (WCAG 1.4.3 / 1.4.11)。dark は light と別に検算する。opacity variant は背景合成で比が変わる
- トークンの値を変えるときは palette の段 (`node_modules/tailwindcss/theme.css`) に乗せる。閾値を跨ぐ最小値は採らない (ADR-0034)
- 色だけで情報を伝えない。アイコンかテキストを併用し、併用先が識別に寄与しないなら `sr-only` で補う

Why: token 経由なら dark mode 対応とデザイン変更が `styles.css` の変更だけで完結する。

### 新しい色の露出のさせ方

判定は「誤った当て方を誘う既存の書き方があるか」。閾値を割る組み合わせが在ること自体は理由にならない (ADR-0036)。

| 誤用を誘う既存の形 | 露出                               | 例                         |
| ------------------ | ---------------------------------- | -------------------------- |
| 無い               | `@theme inline` で token 化        | `--destructive-surface`    |
| 在る               | `:root` だけ + `@utility` の当て口 | `--placeholder` (ADR-0036) |

## typography 階層

| レベル                       | クラス                    |
| ---------------------------- | ------------------------- |
| ページ見出し                 | `text-lg font-semibold`   |
| セクション見出し             | `text-base font-semibold` |
| 本文・フォームラベル         | `text-base` / `text-sm`   |
| 補足・タイムスタンプ・バッジ | `text-xs` 可              |

- ページ見出しは `src/components/parts/page-header.tsx` が持つ。カードの中は `CardPageTitle` (`page-title.tsx`) を通し、class を書き直さない
- 本文に `text-xs` を使わない (タブレット可読性)。ページ見出しとセクション見出しを同サイズにしない (階層が消える)

## spacing 基準

間隔の表現手法は shadcn skill (`.claude/skills/shadcn/rules/styling.md`) に従う。本節は値と、skill を狭める追加規定を持つ。

- 兄弟の間隔を子の margin (`mb-*` / `mt-*` 等) で作らない。親の `gap-*` に置く。skill は `mt-4` を可例に挙げるが、兄弟の間隔に限りここで禁止する
- 機械強制は無いのでレビューで見る。例外は「親の gap で表現できない箇所」に挙げたものだけ
- registry 内部の間隔 (Dialog や Card の padding、`Field` 系の間隔) は registry の既定を基準にし、下の表に写さない

| 対象                         | 値                                        |
| ---------------------------- | ----------------------------------------- |
| ページ本体 padding           | `p-4`                                     |
| ページ本体の縦積み           | `gap-4`                                   |
| ページ見出し帯 (page-header) | `min-h-15 py-3` (`h-9` の actions と等高) |
| リスト行間                   | `gap-2`                                   |

- ページ本体の `p-4` はページ直下のコンテナに掛ける。全画面センタリングのページは対象外
- 表にない値を使う前に「意味が違うのか、単なる揺れか」を問う。同じ意味なら表の値に合わせる
- 別の体系 (1 画面に収める縦予算など) を持つ画面を足すときは、表の対象外と明記し、値の根拠を実装近傍に書く
- registry の既定から値を変えるときは、まず公式の推奨へ合わせ、実機で見てから判断し、理由を実装近傍に書く (ADR-0026)

### 公式のノブ

打ち消しクラスを積む前に、公式が用意したノブを探す。

| やりたいこと                      | 使うもの                                          | 出典                      |
| --------------------------------- | ------------------------------------------------- | ------------------------- |
| Card の余白を詰める・広げる       | `--card-spacing` (`size` prop でも切り替わる)     | Card docs の Spacing      |
| Card 内の要素をカード端まで広げる | `-mx-(--card-spacing)` (フッター直上は `-mb-` も) | 同 Edge-to-Edge           |
| ヘッダー帯の右側にボタンを置く    | `CardAction` (`ml-auto` や flex 化は要らない)     | 同 CardAction             |
| 複数選択のリストを組む            | `ChoiceCard` / `ChoiceCardList`                   | Field docs の Choice Card |
| ScrollArea のフォーカス指標を保つ | `scroll-area-focus-outline` (`styles.css`)        | base-ui の inside-scroll  |

Card docs: https://ui.shadcn.com/docs/components/base/card 。

- `--card-spacing` を 0 にして inset ごと消さない。`-mx-(--card-spacing)` が 0 に解決されて無言で効かなくなる。「見出し帯 + 全幅テーブル」は器を自前にする
- `scroll-area-focus-outline` は Root が `overflow-hidden` を持つか Viewport に mask が乗るときに当てる。registry の focus ring が消える
- 背景を持つスクロール領域は器と中身の両方へ背景を置く。器だけだと axe が背景を解決できず、中身だけだとバーの余白が地のまま残る (`code-block.tsx`)
- 本文の末尾側 padding がバー幅を上回り外側と端をそろえたいときだけ `data-has-overflow-y:pr-0` を書く。既定はバーも余白も `ScrollArea` 側 (ADR-0026)
- `<ScrollBar orientation="horizontal" />` を消費側で合成しない。余白は出るのにバーが無い器を作れる (ADR-0026)

### 親の gap で表現できない箇所

子の margin で兄弟の間隔を作ってよい例外。増やすときは実装近傍にも同じ理由を書く。

- `src/components/ui/` (registry 素) は対象外。`FieldLegend` の `mb-3` のように registry 自身が margin で取る間隔は消費側で上書きしない

### 内部スクロールを持つダイアログの組み方

- 恒常的に viewport 高を超えるダイアログは `DialogScrollForm` + `DialogScrollBody` (`dialog-scroll-body.tsx`) で組み、本体だけをスクロールさせる。見出しとフッターが常に見える (Base UI Dialog の Inside scroll の形)
- 見出しと X ボタンを sticky にしない。内部スクロールと 2 つの固定機構が重なる
- 本文の余白は `DialogScrollBody` が持つ。消費側で padding を足さない。余白が無いと ring が端で切れる

`DialogFooter` / `AlertDialogFooter` の配置は「常時表示すべきか」で決める (実例: `note-create-dialog.tsx`)。

| ケース                                           | 配置                                                      |
| ------------------------------------------------ | --------------------------------------------------------- |
| 条件分岐なくフッターが常に描画される             | 中間コンテナの内側 (`DialogScrollBody` の後ろ)            |
| フッターの手前で描画が空になる条件分岐がある     | 中間コンテナの外 (分岐によらず常時表示を保つ)             |
| ヘッダーと本体の間に固定表示の兄弟要素を挟まない | 中間コンテナを省略し、`DialogScrollBody` を直接置いてよい |

## 状態表示

- ページのローディングは route loader の prefetch + `useSuspenseQuery` + route の `pendingComponent` に統一する。タイミングは `src/router.tsx` の既定に任せる
- ページ内で `isLoading ? <Skeleton>` の即時分岐を新設しない。取得が速い環境で skeleton が点滅する
- skeleton はレイアウトを模倣する (`table-skeleton.tsx`)。コンテナに `role="status"` + `aria-label="読み込み中"` + `aria-busy` を付ける
- 列数など実テーブルと合わせる値は、実テーブル側の定義を SSOT にして両方から参照する。別々に持つとロード完了時にレイアウトがずれる
- ボタン内の送信中表示は `Spinner` (Skeleton にしない)。使う側は必ず `aria-hidden` を渡し、状態は `aria-busy` で持つ (ADR-0037)
- データなしは `Empty` 系で、メッセージと次のアクションへの導線をセットで示す
- 状態によるスタイル分岐が 2 箇所以上で同型に重複したら cva variant 化を検討する。単一箇所なら `cn()` + 三項でよい

## 操作できる要素の組み方

- input の上に疑似要素や別の要素を重ねて hit 領域を広げない。重なった要素が pointer を受け、本体がクリックを受け取れなくなる (テストでは Playwright の hit-target 検査で click が落ちる。ADR-0045。registry の Input 単体は `src/components/ui/input-pointer.test.tsx` が見る)
- checkbox 行を素の `<label>` や手書きの `role="group"` で組まない。複数選択は `ChoiceCard` / `ChoiceCardList` (`choice-card.tsx`) を使う
- 単独の checkbox は `Field orientation="horizontal"` (`Checkbox id` + `FieldLabel htmlFor className="cursor-pointer font-normal"`)。グループの外枠は `FieldSet` + `FieldLegend`
- `table-fixed` + `min-w-[N]` を持つ部品は境界 viewport (N 直下) でも実測する。広い幅だけで測ると狭幅で列幅が無言で最小化する
- `DialogContent` / `SheetContent` の X ボタン (`showCloseButton`) を消すときは、キャンセルボタン (`DialogClose` など) を tab 順に置く。tab 順に閉じる button が無いと、キーボードで閉じる手段が Escape だけになる (WAI-ARIA APG Dialog (Modal) Pattern)

## a11y 最低基準

lint は custom `<Button>` の中身を見ない。テストは `expectNoA11yViolations` を書いたケースだけを見るので、他は devtools の A11y パネルで触りながら確かめる。

### accessible name の与え方

迷ったら与える側に倒す。与えない判断をしたら理由を実装近傍に残す。

| 対象                                                  | 対応                                                                                                             |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| テキストを持たない操作要素 (ボタン / リンク / トグル) | 要素に `aria-label`                                                                                              |
| 状態や属性を伝える唯一の手段になっているアイコン      | `aria-hidden` + 隣接の `sr-only` テキスト                                                                        |
| 隣接テキストが同じ意味を持つアイコン                  | `aria-hidden`。名前を足さない。そのテキストが実際に読み上げられるときに限る                                      |
| 可視テキストが既に accessible name の要素             | 何も足さない (次項)                                                                                              |
| name from author のロールを持つ要素                   | 可視テキストがあっても `aria-label` (次項)                                                                       |
| テーブルの列見出し (`th`)                             | `scope="col"`。暗黙の role は locator と一部の支援技術で columnheader に解決されない (ADR-0022)                  |
| ローディング等の状態表示                              | `announce()` (`src/lib/live-announcer.ts`) で通知する。項目に `<output>` / `role="status"` を足さない (ADR-0037) |

- 状態表示の例外はページ全体を置き換える pending 表示 (`TableSkeleton`) (ADR-0037)
- live region は初期マークアップに置いて消さない。条件付きで mount した region は読まれないか挙動が揺れる (ADR-0037)
- pending の検証は `aria-busy` と live region の文言で行う。`getByRole("status")` で項目を掴まない (ADR-0037)
- 取得結果の通知は、ページの effect が取得の決着で `announce()` し、直前と同じ条件なら出さない。取得中に出すと古い件数を読む (ADR-0038)
- メニュー全体を包む単一の `DropdownMenuGroup` には名前を与えない。メニュー自体がトリガー由来の名前を持つ
- 項目を 2 グループ以上に分けるときは `DropdownMenuLabel` で各グループに名前を与える
- ナビゲーションは landmark (`nav`、または `role="navigation"` + `aria-label`) を持ち、現在地に `aria-current="page"` を付ける

### 可視テキストを持つ要素に aria-label を足さない

- `span` / `div` (ロール `generic`) に `aria-label` を付けない。name prohibited (WAI-ARIA 1.2 §5.2.8.6)。別要素の可視テキストは `aria-labelledby` で指す
- 例外は name from author のロール。`role="combobox"` (Combobox / Select / Popover の trigger) は可視テキストと同値でも `aria-label` が要る (WAI-ARIA 1.2 §5.2.8)
- 可視テキストを子要素へ分割すると Chrome が境界に空白を入れて名前が分断される。略記と全文を出し分けるなら可視側を `aria-hidden`、全文を 1 つの `sr-only` に置く
- 名前に関わる要素を切り出す前後で `getByRole({ name })` の結果が変わらないことを確かめる
