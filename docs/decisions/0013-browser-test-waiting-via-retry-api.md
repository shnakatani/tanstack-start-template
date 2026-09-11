# ADR-0013: ブラウザテストの待機は vitest の retry API に委ね、自前の待機を積まない

- Status: Accepted
- Date: 2026-09-11
- 関連: ADR-0006 (registry コードのガードはブラウザテストが担う)

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

対になる `findElement()` が v4.1.0 で入っている。同じ `context.d.ts` が「this method will wait and retry until a matching element appears in the DOM, using increasing intervals (0, 20, 50, 100, 100, 500ms)」と書き、あわせて「This is an escape hatch for library authors and 3d-party APIs that do not support locators directly. If you are interacting with the element, use builtin methods instead.」と注意する。`getComputedStyle` / `getBoundingClientRect` による実測は locator のアサーションで表現できないため、生 DOM を取ること自体はこの注意書きが許す用途にあたり、待つ側を選べば済む。

同じ形は `src/components/ui/dialog.test.tsx` / `src/components/ui/alert-dialog.test.tsx` / `src/components/dialog-scroll-body.test.tsx` にもあった。落ちたのが combobox だけだったのは確率の差である。

調査中に別種の未待機も見つかった。操作の直後に `element().getAttribute(...)` を同期で読む形で、要素は操作前から存在するため `element()` は成功するが、読む値が更新前になりうる。

`render()` の側は保証がある。`vitest-browser-react` の `render` は `await act(async () => { root.render(...) })` で、初回レンダーと effect を flush してから返る。操作を挟まずに取る要素は同期 API で足りる。

## Decision

**要素の取得と状態の検証は vitest の retry API に委ね、待機を自前で組み立てない。**

| 場面                                  | 使うもの                                             |
| ------------------------------------- | ---------------------------------------------------- |
| 操作の結果として現れる要素の生 DOM    | `await locator.findElement()`                        |
| 操作後の属性・テキストの検証          | `await expect.element(locator).toHaveAttribute(...)` |
| `render()` 直後、操作前の要素の生 DOM | `locator.element()`                                  |
| close 後に要素が消えたことの確認      | `vi.waitFor` で `.query()` が null になるのを待つ    |

`waitForAnimations()` は「アニメーションの完了を待つ」責務だけを持つ。mount を待つ役は `findElement()` が担うので、開く操作のあとは `findElement()` → `waitForAnimations()` → 実測の順に置く。逆順では、未 mount のあいだ `waitForAnimations()` が空振りし、アニメーション途中の値を測る。

### 検討した選択肢

| 案                                            | 評価                                                                                                                             | 採否     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `findElement()` と `expect.element` に寄せる  | vitest が retry 間隔と失敗時の DOM 出力を持つ。待機の実装がテスト側に残らない                                                    | **採用** |
| `element()` のまま `vi.waitFor` で全体を囲む  | 同じ待機が書ける。ただし囲む範囲の判断がテストごとに要り、囲み忘れが `src/components/ui/input-group.test.tsx` と同じ形で再発する | 却下     |
| `waitForAnimations()` に mount 待ちを足す     | 「アニメーションを待つ」名前と責務がずれる。待つ対象を引数で渡す設計になり、呼び出し側の判断が増える                             | 却下     |
| `element()` を全廃して `findElement()` に統一 | `render()` 直後は `act` で flush 済みで、待つ理由がない。同期で読める箇所まで `await` を増やすことになる                         | 却下     |

## Consequences

- 生 DOM を取る箇所は「操作を挟んだか」で API が分かれる。判断を誤ってもテストは大半の実行で通るため、レビューで見る。lint で表現できる形は無い
- 変化しないことの検証 (disabled な行がトグルしない等) は retry では強くならない。`expect.element` は条件を満たした時点で返るので、更新前に成功しうる。待つ対象がある検証へ言い換えられないかを先に考える
- `expect.element` の matcher (`toHaveAttribute` / `toHaveTextContent`) を使う。`toHaveTextContent` は文字列で部分一致になるため、完全一致が要る箇所は正規表現を渡す
- `vi.waitFor` は close 後の unmount 待ちなど、locator の matcher で表せない条件に残す。両方が混在するが、retry する形であることは変わらない
- この決定はブラウザテストにだけ効く。unit project は DOM を持たず、`render` も locator も無い
