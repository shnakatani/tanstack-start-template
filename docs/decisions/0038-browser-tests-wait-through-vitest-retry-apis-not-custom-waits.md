# ADR-0038: ブラウザテストの待機は vitest の retry API に委ね、自前の待機を積まない

- Status: Accepted
- Date: 2026-09-22
- 関連: ADR-0024 (registry コードのガードはブラウザテストが担う)、ADR-0040 (animation を無効にして走らせる)、ADR-0041 (同期読みを assert へ流さない。本 ADR の規範を lint で強制する)、ADR-0042 (assert の予算。`findElement()` を呼ばない理由もここが持つ)、ADR-0043 (否定 assert が不在でも通ること)

## Context

`src/components/ui/input-group.test.tsx` の combobox popup のテストが、full run でのみ落ちることがあった。
単独実行と 2 回目以降の full run では通る。

失敗時の DOM には trigger しか無く、`aria-expanded="false"` だった。click は完了しているが、React の再レンダーと base-ui の Portal の mount が終わっていない瞬間に、popup 内の要素を取りに行っている。

このテストは次の形で書かれていた。

```tsx
await screen.getByRole("combobox", { name: "開く" }).click();
await waitForAnimations();

const input = screen.getByRole("combobox", { name: "検索" });
const inputGroup = findInputGroup(input.element());
```

2 つの前提が成り立っていない。

| 使っていた API        | 実際の挙動                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `waitForAnimations()` | 呼んだ時点の `getAnimations({ subtree: true })` だけを待つ。popup が未 mount なら空配列で即解決する                  |
| `Locator.element()`   | retry しない。`@vitest/browser` の `context.d.ts` が「If no elements match the selector, an error is thrown.」と書く |

対になる `findElement()` が v4.1.0 で入っている。同じ `context.d.ts` が「this method will wait and retry until a matching element appears in the DOM, using increasing intervals (0, 20, 50, 100, 100, 500ms)」と書き、あわせて「This is an escape hatch for library authors and 3d-party APIs that do not support locators directly. If you are interacting with the element, use builtin methods instead.」と注意する。`getComputedStyle` / `getBoundingClientRect` の実測に生 DOM が要る場面でも、実測を `expect.poll` の中で読めば `findElement()` は要らない (Decision)。

同じ形は `src/components/ui/dialog.test.tsx` / `src/components/ui/alert-dialog.test.tsx` / `src/components/parts/dialog-scroll-body.test.tsx` にもあった。落ちたのが combobox だけだったのは確率の差である。

調査中に別種の未待機も見つかった。操作の直後に `element().getAttribute(...)` を同期で読む形で、要素は操作前から存在するため `element()` は成功するが、読む値が更新前になりうる。

`render()` の側は保証がある。`vitest-browser-react` の `render` は `await act(async () => { root.render(...) })` で、初回レンダーと effect を flush してから返る。操作を挟まずに取る要素は同期 API で足りる。

## Decision

**要素の取得と状態の検証は vitest の retry API に委ね、待機を自前で組み立てない。**

| 場面                                       | 使うもの                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 操作の結果として現れる要素の mount         | `await expect.element(locator).toBeInTheDocument()`。`findElement()` は呼ばない (ADR-0042)                                                 |
| 操作後の要素の実測 (rect / computed style) | 先に `expect.element` で mount を待ってから `locator.element()` を読む。retry が要るなら `expect.poll` のコールバックの中で読む (ADR-0041) |
| 操作後の属性・テキストの検証               | `await expect.element(locator).toHaveAttribute(...)`                                                                                       |
| `render()` 直後、操作前の要素の生 DOM      | `locator.element()`                                                                                                                        |
| close 後に要素が消えたことの確認           | `expectRemoved(locator)` (`src/test/absent.ts`。ADR-0043)                                                                                  |

animation は ADR-0040 の既定で止まるので、開く操作のあとは `expect.element(locator).toBeInTheDocument()` で mount を待ち、実測は `expect.poll` の中で読む (ADR-0041)。`getAnimations()` の完了を待つ helper は置かない。

### 検討した選択肢

| 案                                            | 評価                                                                                                                                                                 | 採否     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `expect.element` に寄せる                     | vitest が retry 間隔と失敗時の DOM 出力を持つ。待機の実装がテスト側に残らない。生 DOM の mount 待ちも `expect.element` で足り、`findElement()` は呼ばない (ADR-0042) | **採用** |
| `element()` のまま `vi.waitFor` で全体を囲む  | 同じ待機が書ける。ただし囲む範囲の判断がテストごとに要り、囲み忘れが `src/components/ui/input-group.test.tsx` と同じ形で再発する                                     | 却下     |
| animation を待つ helper に mount 待ちを足す   | 「アニメーションを待つ」名前と責務がずれる。待つ対象を引数で渡す設計になり、呼び出し側の判断が増える                                                                 | 却下     |
| `element()` を全廃して `findElement()` に統一 | `render()` 直後は `act` で flush 済みで、待つ理由がない。同期で読める箇所まで `await` を増やすことになる                                                             | 却下     |

## Consequences

- 生 DOM を読む箇所は「操作を挟んだか」で待ち方が分かれる。判断を誤ってもテストは大半の実行で通るため、レビューで見る。禁じたい形のうち「同期読みの値を assert へ流すこと」は式の構造で表せるので lint が持つ (ADR-0041)。`element()` を操作前の要素と retry コールバックの中に限ることは実行時の履歴で決まるため、レビューで見る
- 変化しないことの検証 (disabled な行がトグルしない等) は retry では強くならない。`expect.element` は条件を満たした時点で返るので、更新前に成功しうる。待つ対象がある検証へ言い換えられないかを先に考える
- `expect.element` の matcher (`toHaveAttribute` / `toHaveTextContent`) を使う。`toHaveTextContent` は文字列で部分一致になるため、完全一致が要る箇所は正規表現を渡す
- `vi.waitFor` は locator の matcher で表せない条件 (mock の呼び出し回数、announcer が積んだ配列の中身など) に残す。要素が消えたことは `expect.element` の `.not.toBeInTheDocument()` が表せる (`.not.toBeInTheDocument()` のときだけ Locator を `.query()` で引くため、無くても throw しない。この特例が「最初から無くても通る」の出どころで、扱いは ADR-0043 が持つ)。vitest の wait-for レシピは assertion を待つなら `expect.poll` 系、処理そのものが throw しなくなるのを待つなら `vi.waitFor` と分ける
- この決定はブラウザテストにだけ効く。unit project は DOM を持たず、`render` も locator も無い
