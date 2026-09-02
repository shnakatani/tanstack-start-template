---
paths:
  - "src/**/*.tsx"
  - "src/**/*.css"
---

# スタイリング規約

色・タイポグラフィ・spacing・状態表示の基準。touch target の制約は `implementation.md` (ADR-0007) が優先する。

## 冒頭チェックリスト

- [ ] 色は semantic token のみ (palette 直書き・任意値への色の直書き禁止)
- [ ] 本文に `text-xs` を使わない / ページ見出しとセクション見出しを同サイズにしない
- [ ] `isLoading ? <Skeleton>` の即時分岐を新設しない (loader prefetch + `pendingComponent`)

## 色は semantic token のみ

- `primary` / `secondary` / `muted` / `accent` / `destructive` / `success` / `sidebar-*` 等の semantic token を使う
- palette 色の直書き (`bg-blue-500` / `text-gray-900` 等) と任意値への色の直書き (`bg-[#hex]` / `bg-[rgb(...)]`) は禁止。淡色ハイライトは `bg-primary/10` のような opacity variant で表現する
- 新しい「意味のある色」が必要になったら、`src/styles.css` の `:root` / `.dark` に CSS 変数を定義し `@theme inline` で token 化してから使う。token を定義する前に utility を書くと未知クラスとして落ちる
- `bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]` のように `var(--...)` を材料にして値を導く任意値は禁止しない。token 経由なので dark mode にも追従する
- 破壊操作は常時 destructive 色を使い、強度は主張度で分ける。テキストボタンは `destructive`、アイコンボタンは `destructive-ghost`。hover でのみ着色すると touch 環境で色が出ず、破壊操作だと伝わらない

Why: token 経由なら dark mode 対応とデザイン変更が `styles.css` の変更だけで完結する。

### 統制の 2 層 (ADR-0004)

| 層  | 場所                                                | 効き方                                                      |
| --- | --------------------------------------------------- | ----------------------------------------------------------- |
| 1   | `src/styles.css` の `@theme` (`--color-*: initial`) | 既定 palette の utility が CSS ごと生成されない             |
| 2   | `better-tailwindcss` の 2 ルール (`vite.config.ts`) | `vp check` で落とす。1 層目が外したクラスが未知クラスになる |

- 1 層目の `@theme` は import より後ろ、`@theme inline` より前に置く。後ろへ動かすと semantic token まで消える
- `black` と `white` だけは 1 層目で再登録してある。registry の overlay が scrim を `bg-black/10` で描いており、消すとモーダルの背景が素通しになる
- 2 層目はテストファイルにも効く。字面走査の頃と違って `.test.*` / `.gen.*` の除外は無い

## typography 階層

| レベル                       | クラス                    |
| ---------------------------- | ------------------------- |
| ページ見出し                 | `text-lg font-semibold`   |
| セクション見出し             | `text-base font-semibold` |
| 本文・フォームラベル         | `text-base` / `text-sm`   |
| 補足・タイムスタンプ・バッジ | `text-xs` 可              |

- ページ見出しの実装は `src/components/page-header.tsx` が持つ。ページ側で見出しの class を書き直さない
- 本文に `text-xs` を使わない (タブレット可読性)
- ページ見出しとセクション見出しを同サイズにしない (階層が消える)
- registry `CardTitle` の weight を上書きするときは、上書きの理由を実装近傍に書く。既定の weight を選んだのか意図的に変えたのかが差分から読めなくなる

## spacing 基準

**間隔の表現手法は shadcn skill (`.claude/skills/shadcn/rules/styling.md`) が正本**で、本節は値と、正本を狭める追加規定を持つ。

- `space-x-*` / `space-y-*` は使わず `flex` + `gap-*` で表現する (正本の規約)
- 兄弟の間隔を子の margin (`mb-*` / `mt-*` / `ml-*` / `mr-*`) で作らない。間隔の所有者を親に置き、子が並ぶ文脈を知らなくても済むようにする。正本は「className for layout only」で `mt-4` を可例に挙げるが、兄弟の間隔を作る用途に限り本ファイルが上書きして禁止する (例外は「親の gap で表現できない箇所」)
- どちらも機械強制はないため、レビューで見る

表の値は全て app 固有の判断値で、変更するときは実測して本表を更新する。

registry コンポーネント内部の間隔 (ダイアログや Card の padding、`Field` 系のフィールド間隔、`Badge` / `Item` のチップ密度) は registry の既定が基準値で、本表には写さない。消費側 className での間隔調整は、正本の「className for layout only」が layout 用として許容する。

ただし打ち消しクラスを積む前に、公式が用意したノブを探す。正本の「Customizing Components」は variant → className → 新規 variant → wrapper の順しか挙げず CSS 変数のノブに触れないため、確認できたものを本節に置く。

| やりたいこと                      | 使うもの                                          | 出典                      |
| --------------------------------- | ------------------------------------------------- | ------------------------- |
| Card の余白を詰める・広げる       | `--card-spacing` (`size` prop でも切り替わる)     | Card docs の Spacing      |
| Card 内の要素をカード端まで広げる | `-mx-(--card-spacing)` (フッター直上は `-mb-` も) | 同 Edge-to-Edge           |
| ヘッダー帯の右側にボタンを置く    | `CardAction` (`ml-auto` や flex 化は要らない)     | 同 CardAction             |
| 複数選択のリストを組む            | `ChoiceCard` / `ChoiceCardList`                   | Field docs の Choice Card |
| ScrollArea のフォーカス指標を保つ | `scroll-area-focus-outline` (`styles.css`)        | base-ui の inside-scroll  |

Card docs: https://ui.shadcn.com/docs/components/base/card 。

`--card-spacing` を 0 にして inset ごと消さない。`-mx-(--card-spacing)` が 0 に解決されて無言で効かなくなり、消費側が `px` を手書きする羽目になる。「見出し帯 + 全幅テーブル」は `Card` の用途ではないので器を自前にする。

`scroll-area-focus-outline` は Root が `overflow-hidden` を持つか Viewport に mask が乗るときに当てる。registry が Viewport に持たせた focus ring がどちらでも消え、キーボード操作の指標が失われる。

| 対象                         | 値                                        |
| ---------------------------- | ----------------------------------------- |
| ページ本体 padding           | `p-4`                                     |
| ページ本体の縦積み           | `gap-4`                                   |
| ページ見出し帯 (page-header) | `min-h-15 py-3` (`h-9` の actions と等高) |
| リスト行間                   | `gap-2`                                   |

### 表の読み方

- ページ本体の `p-4` はページ直下のコンテナに掛ける。全画面センタリングのページは対象外
- touch target の制約 (`implementation.md`、ADR-0007) と衝突する場合はそちらが優先
- 表にない値を使う前に「意味が違うのか、単なる揺れか」を自問する。意味が同じなら表の値に合わせる
- 別の体系 (1 画面へ収める縦予算で決まる密度など) を持つ画面を足すときは、その画面を本表の対象外と明記し、値の根拠を実装近傍に書く

### registry の既定から変えている箇所

まず公式の推奨へ合わせ、実機で見てから UI/UX 上のカスタマイズを判断する。変える値を増やすときは実装近傍に理由を書く。カスタマイズ自体は公式の想定 (「The top layer of your component code is open for modification」) で、`src/components/ui/` のソースまで変えた分は ADR-0006 が持つ。

- 複数選択リストの行間は `ChoiceCardList` が詰める。`FieldGroup` 素の gap はフォームのフィールド間の値で行の並びには過大なため正本も上書きを例示しており、そこからさらに 1 段詰めてある

### 親の gap で表現できない箇所

子の margin で兄弟の間隔を作ってよい例外。増やすときは実装近傍にも同じ理由を書く。

- `src/components/ui/` (registry 素) は対象外。`FieldLegend` の `mb-3` のように registry 自身が margin で間隔を取る箇所は消費側で上書きしない
- 負マージンによる親 padding の打ち消しと `*-auto` による整列は兄弟の間隔ではないため、ここには挙げない

### 内部スクロールを持つダイアログの組み方

`DialogScrollBody` + `dialogScrollLayout` (`src/components/dialog-scroll-body.tsx`) で組む。`form` / `div` を問わずヘッダーとフッターの間の中間コンテナに適用し、本体だけをスクロールさせる (見出しと X ボタンが流れない)。各 className の根拠は同ファイルの docstring。

恒常的に viewport 高を超えるダイアログは必ずこの方式で組む。`popupOverflowBackstop` 発火時に X 閉じるボタンが流れる挙動は、内部スクロールを組み忘れても内容が読める防御層として許容し、sticky は作らない。sticky を足すと 2 つの固定機構が重なり、どちらが効いているか実測しないと分からなくなる。

本文の余白は `DialogScrollBody` が持つ (`px-6` / `py-4`)。消費側で padding を足さない。
`ring` / `box-shadow` は border box の外側に描かれるため、スクロール領域に余白がないと端の要素で切れる。この余白は `src/components/dialog-scroll-body.test.tsx` が上下左右とも固定している。

`DialogFooter` / `AlertDialogFooter` の配置は「常時表示すべきか」で決める。

| ケース                                           | 配置                                                      |
| ------------------------------------------------ | --------------------------------------------------------- |
| 条件分岐なくフッターが常に描画される             | 中間コンテナの内側 (`DialogScrollBody` の後ろ)            |
| フッターの手前で描画が空になる条件分岐がある     | 中間コンテナの外 (分岐によらず常時表示を保つ)             |
| ヘッダーと本体の間に固定表示の兄弟要素を挟まない | 中間コンテナを省略し、`DialogScrollBody` を直接置いてよい |

実例は `src/routes/notes/-components/note-create-dialog.tsx` (form が中間コンテナ、`DialogFooter` はその内側)。

## 状態表示

- ページのローディング表示は route loader prefetch + `useSuspenseQuery` + route の `pendingComponent` に統一する。表示タイミングは `src/router.tsx` の `defaultPendingMs` / `defaultPendingMinMs` に任せる
- ページ内で `isLoading ? <Skeleton>` の即時分岐を新設しない。取得が速い環境で skeleton が一瞬点滅するちらつきの原因
- skeleton の見た目はレイアウト模倣 (共有: `src/components/table-skeleton.tsx`)。コンテナに `role="status"` + `aria-label="読み込み中"` + `aria-busy` を付与する (`pendingComponent` 内も同様)
- 列数など実テーブルと合わせる値は、実テーブル側の定義を SSOT にして両方から参照する。別々に持つとロード完了時にレイアウトシフトが出る
- ボタン内の送信中表示: `Spinner` (loading-buttons パターン。Skeleton にしない)
- データなし: `Empty` 系。メッセージ + 次のアクションへの導線をセットで示す
- 状態によるスタイル分岐が 2 箇所以上で同型に重複したら cva variant 化を検討する。単一箇所なら `cn()` + 三項で良い
