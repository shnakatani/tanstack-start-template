---
paths:
  - "src/**"
---

# 実装ワークフロー

型の規律 (型アサーション禁止 / children prop 宣言 / 転送 prop の ComponentProps 導出) は `typing.md` に分離した。

## 冒頭チェックリスト

- [ ] イベントハンドラを同期関数として宣言し、prop へ直接渡している (JSX に `void` とインライン `async` を書いていない)
- [ ] useEffect 内で setState していない
- [ ] コンポーネントを `function` 宣言で定義している

## useEffect 内で setState 禁止

lint 検出: effect 内の `setState` を `react/set-state-in-effect` が、そこから派生させた state を `react/no-deriving-state-in-effects` が捕まえる。外部ストアの購読 (代替 4) は lint で検出できないためレビューで見る。

代替:

1. render 中に計算可能 → 直接計算 (安定化は React Compiler が担う。「手動メモ化の増減」参照)
2. ユーザー操作への応答 → event handler
3. DOM 接続/切断に連動 → React 19 callback ref + cleanup return
4. 外部ストアへの購読 → `useSyncExternalStore`
5. データ取得 → TanStack Query (route loader の `queryClient.query({ ...options, staleTime: "static" })` prefetch + `useSuspenseQuery`。実例: `src/routes/notes/index.tsx`)

useEffect が正当なのは DOM 副作用 (focus / scroll / 外部 widget 初期化) と、router へ変化を伝える副作用 (`router.invalidate()` 等) のみ。

router へ伝える副作用は、追従が必要な期間で置き場所を決める。

- mount 中だけ成立すれば足りるなら effect でよい
- 画面遷移中や `errorComponent` 表示中も成立させたいなら router 層で購読する。effect は mount 状態に縛られ、その画面が出ていない間は追従が途切れる

## Effect が読む最新値は useEffectEvent へ切り出す

lint 検出なし。oxlint に `useEffectEvent` の制約を見るルールが無いため、下の 3 点はレビューで見る (2026-09-02 実測)。

- 購読を張り直したくないのに最新の props / state を読む必要がある箇所は `useEffectEvent` へ切り出し、依存から外す。実例は `src/components/ui/sidebar.tsx` の keydown 購読
- **依存配列を埋める逃げ道に使わない。** 再実行の契機そのものである値を隠すとバグが見えなくなる。`calendar.tsx` の `modifiers.focused` は契機なので切り出さない
- Effect Event は Effect か他の Effect Event の中からしか呼べない。ユーザーイベントハンドラ・レンダー中・他コンポーネントへの受け渡し・依存配列への記載はいずれも不可

## イベントハンドラは同期に保つ

lint 検出: `typescript/no-misused-promises` が、`void` を返す prop へ Promise を返す関数を渡すと落とす。

- `async` 関数をハンドラとして prop へ直接渡さない。ハンドラは同期関数として宣言し、非同期処理はその内側の関数へ閉じる
- JSX の prop に `void` やインラインの `async` を書かない。名前付きハンドラを定義して直接渡す
- 待たない判断は内側で 1 回だけ表明する。呼び先が失敗を自分で処理するなら `void`、呼び出し側で通知や後始末をするなら `.catch()`
- pending 表示は mutation の `isPending` を使う (実例: `src/routes/notes/index.tsx`)。`useTransition` は mutation を経由しない非同期処理を足すときだけ検討する
- 手動の `isSubmitting` 相当の state を持つハンドラは mutation の `isPending` へ寄せられる。移行で失敗経路の意味が変わるため、lint 対応とは分けて判断する
- **操作の失敗を Error Boundary へ届けない**。通知は toast (`src/components/ui/toast.tsx`) か画面内表示で行う。Error Boundary は画面ごと差し替わる。Transition 内の throw が Error Boundary へ届くのは性質であって、`startTransition` を選ぶ理由にしない

```tsx
function handleSignOut() {
  void performSignOut();
}
<DropdownMenuItem onClick={handleSignOut}>
```

判断の経緯は ADR-0004「`no-misused-promises` が要求する実装の形」。

## 手動メモ化の増減

React Compiler が値と関数の安定化を担う (ADR-0009)。
`useMemo` / `useCallback` は足すのも外すのも実測が要る。判定手順は ADR-0009 が持つ。
`src/components/ui/` は ADR-0006 の統制下なので触らない。

## コンポーネントは function 宣言で定義する

- トップレベル定義は `function Foo(props) {}` で書く。`const Foo = () => {}` にしない
- コンポーネント内の名前付きヘルパーも `function` 宣言。型注釈が要るときだけ arrow const
- インラインのコールバック (`onClick` の中身など) は arrow で書く
- 対象外: shadcn 生成コード (`src/components/ui/`) は生成された形のまま置く

Why: 巻き上げでページ本体を上、ヘルパーを下に置ける。`.tsx` で generics を `<T,>` ハックなしに書ける。

## Item は Group の中に置く

`SelectItem` / `DropdownMenuItem` を `SelectContent` / `DropdownMenuContent` の直下に置かない。正本は shadcn skill の `.claude/skills/shadcn/rules/composition.md`。

包み忘れに機械強制は無い。規範として守り、レビューで見る。
以前は JSX の字面を走査する自前の検査を当てていたが、変数へ組み立てて Content に差す Item と別コンポーネントへ切り出した Item は同一 JSX 木の字面に現れず、警告なしで見逃していた。守れる範囲がレビューの代わりにならないため撤去した。

## 検証フロー

実装中は 1 ファイル目を `vp check --fix` まで通してから横展開する。整形と自動修正が入るのはこの経路と commit 前の staged hook (`vp staged`、`.claude/rules/vite-plus.md`) だけで、`mise run verify` の `vp check` は書き換えない。

マージ前は `mise run verify` (`vp check` → `vp test run` → `vp build` → ヘッダ検査) を通す。verify の `vp check` は `--fix` を持たず書き換えずに落とすので、整形差分を残したまま回すとそこで止まる。

## formatter 差分は常にコミット

`vp check --fix` で出た差分は全てコミットする。`git restore` で無視しない。

## dead code を発見したら即決 3 択

1. **削除** (呼び出し元なし)
2. **同等修正** (呼ばれている)
3. **スコープ外** → 別 PR へ切り出す

削除の前に git blame で導入コミットを確認する。
line-level で「効かない」だけを根拠に削除すると、feature-level では生きた意図を別実装で置換すべきケースを見落とし silent regression になる。

## touch target

touch target は画面によらず一律に扱う。共有 UI 部品で実現するため、特定の画面だけ緩めることはしない。

touch target は WCAG 2.2 AA 2.5.8 (24x24 CSS px) を適合の床とし、視覚 = ヒット = registry 素寸法で運用する (ADR-0007)。
44px (HIG / WCAG AAA) は要件ではない。
registry 部品 (`src/components/ui/`) はアプリ独自の hit 拡大 (疑似要素) も寸法の入力デバイス分岐も持たない。

- size variant は情報密度で選ぶ。最小は icon-xs (床ちょうど)。これ未満の interactive size を新設しない (ADR-0007)
- `h-11` / `min-h-11` / `min-w-11` / `size-11` を variant なしで書かない (ADR-0007)。機械強制は無く、実寸の回帰だけを `src/components/ui/touch-target.test.tsx` が固定する
- 実機で誤タップが報告されたら、当該部品に `any-pointer-coarse:min-h-11` (icon 系は `min-w-11` も) を後付けする (ADR-0007 の誤タップレバー)。後付け後にタッチ環境の高さを変えるときは同じ variant で書く。素の `h-*` では `min-height` を打ち消せず、マウス環境だけ縮む
- 実機 UI 確認ではタップ精度 (特に床ちょうどの要素) を観点に含める
- `touch-action` を上書きしない。tap 遅延の除去は `src/routes/__root.tsx` の viewport meta (`width=device-width`) が担う (ADR-0007)

### input と checkbox 行

- input に疑似要素の hit 拡大を掛けない。ラッパーで包むと本体がポインタを受け取れなくなる (ADR-0007)
- checkbox 行を素の `<label>` で包む手組みや、手書きの `role="group"` を新規に書かない
- 複数選択は `ChoiceCard` / `ChoiceCardList` (`src/components/choice-card.tsx`) を使う。公式の Choice Card 構成 (`FieldLabel` で `Field` を包む) と行間・クリック領域・disabled 時の見え方はこの部品が持つので、手で組み直さない
- 単独は `Field orientation="horizontal"` (`Checkbox id` + `FieldLabel htmlFor className="cursor-pointer font-normal"`)。グループの外枠は `FieldSet` + `FieldLegend`

### 幅と閉じる手段

- `table-fixed` + `min-w-[N]` を持つコンポーネントは境界 viewport (N 直下) でも実測する。広い幅だけで測ると狭幅時に列幅が最小化し silent に違反する。列幅の配分を計算で予測してから測る
- ドロワーとモーダルには visible close (X ボタン) を置く。スワイプと backdrop タップだけでは不十分

## a11y 最低基準

lint は custom `<Button>` の中身を見ないため機械強制がない。実装時に自己チェックする。

強制は 2 層で持つ。テスト側は `src/test/a11y.ts` の `expectNoA11yViolations` が書いたケースだけを見る。書いていない画面は devtools の A11y パネル (`src/routes/__root.tsx` の `a11yDevtoolsPlugin`) で触りながら気付く。

### accessible name の与え方

迷ったら与える側に倒す。
与えない判断をしたら理由コメントを実装近傍に残す。

| 対象                                                  | 対応                                       |
| ----------------------------------------------------- | ------------------------------------------ |
| テキストを持たない操作要素 (ボタン / リンク / トグル) | 要素に `aria-label`                        |
| 状態や属性を伝える唯一の手段になっているアイコン      | `aria-hidden` + 隣接の `sr-only` テキスト  |
| 隣接テキストが同じ意味を持つアイコン                  | `aria-hidden`。名前を足さない              |
| 可視テキストが既に accessible name の要素             | 何も足さない (次項)                        |
| name from author のロールを持つ要素                   | 可視テキストがあっても `aria-label` (次項) |
| ローディング等の状態表示                              | `role="status"` + `aria-label`             |

- 「隣接テキストが同じ意味」と言えるのは、そのテキストが実際に読み上げられるときに限る
- `role="status"` は同一画面に複数あり得る。テストは accessible name で特定する
- メニュー内の全項目を包む単一の `DropdownMenuGroup` には名前を与えない。base-ui の `MenuRoot` が popup に `aria-labelledby` を付けるため、メニュー自体がトリガー由来の名前を持つ
- 項目を 2 グループ以上に分けるときは `DropdownMenuLabel` で各グループに名前を与える

### 可視テキストを持つ要素に aria-label を足さない

`span` / `div` の既定ロール `generic` は name prohibited で、`aria-label` による命名が MUST NOT (WAI-ARIA 1.2 §5.2.8.6)。
別要素の可視テキストを名前にしたいときは `aria-labelledby` を使う。
例外は name from author のロール。`role="combobox"` (Combobox / Select / Popover の trigger) は内容から名前を取らないため、可視テキストと同値でも `aria-label` が要る。外すと名前が消える (WAI-ARIA 1.2 §5.2.8 Name From)。

可視テキストを子要素へ分割すると、Chrome がテキスト境界に空白を入れて accessible name が分断される。略記と全文を出し分けるときは可視側を `aria-hidden` にして全文を 1 つの `sr-only` に置く。切り出す前に `getByRole({ name })` で名前が変わらないことを確かめる。

### 色とコントラスト

- コントラストは本文テキスト 4.5:1、アイコンと UI 部品 3:1 (WCAG 1.4.3 / 1.4.11)。dark mode は light と別に検算する (opacity variant は背景合成で比率が変わる)
- 色だけで情報を伝えない。アイコンやテキストを併用し、併用先が識別に寄与しないなら `sr-only` で補う
- ナビゲーションは landmark (`nav` 要素、または `role="navigation"` + `aria-label`) を持ち、現在地に `aria-current="page"` を付ける

## 技術選択は plan 提示 → 反応待ち

3 案以上の技術選択や DB スキーマ変更を伴う判断は plan 提示してユーザー反応を待つ。
