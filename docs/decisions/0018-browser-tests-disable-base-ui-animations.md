# ADR-0018: ブラウザテストは Base UI の animation を無効にして走らせ、animate-out の窓を踏むテストだけ戻す

- Status: Proposed
- Date: 2026-09-14
- 関連: ADR-0013 (待機は vitest の retry API に委ねる)、ADR-0015 (二重発火の検証は実イベントで書く)、ADR-0017 (a11y 検査の対象)

## Context

`src/routes/notes/index.test.tsx` の「削除中は対象の行が busy になる」が CI (GitHub Actions、run 34792768529) でだけ落ちた。ローカルでは通る。axe の incomplete に Base UI の focus guard (`aria-hidden-focus`) と確認ダイアログの見出し (`heading-order`) が出ていた。確定でダイアログを閉じた直後に `document.body` を検査しており、閉じかけの popup が animate-out (`duration-100`) の間だけ mount されたまま残る窓に検査が落ちていた。

この窓は乱数ではない。Base UI は閉じた popup を `element.getAnimations()` の完了まで mount し続ける (Handbook「Animation」)。その間、focus guard は `aria-hidden="true"` + `tabindex="0"` のまま、行は `aria-hidden` 配下のまま、`onOpenChangeComplete` は未発火のままである。検査や locator がこの窓の内側に落ちるか外側に落ちるかは実行環境の速さで決まり、遅い CI ほど内側に落ちる。

| 出典                                                                 | 内容                                                                                                                                                                                                                 |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base UI issue #5519 (2026-08-17)                                     | Combobox の exit animation 中に focus guard が focusable のまま残り、axe が `aria-hidden-focus` を出す。「DOM の状態は animation の間は決定的で、scan が窓の内外どちらに落ちるかで断続的に見えるだけ」               |
| Base UI PR #5537 (2026-08-19 作成、2026-09-14 時点で未マージ)        | メンテナによる修正。閉じかけの popup に `inert` を付けて a11y tree と focus 順から外す。本文で「flaky ではなく animation の長さの間だけ決定的」と断言                                                                |
| axe-core issue #4832 (open)                                          | floating-ui 系の focus guard を `aria-hidden-focus` が誤検出する。heuristics の更新待ち                                                                                                                              |
| Base UI 配布物 `global.d.ts` / `internals/useAnimationsFinished.mjs` | `globalThis.BASE_UI_ANIMATIONS_DISABLED` が `true` の間、animation の完了を待たずに完了コールバックを即実行する。JSDoc「When `true`, disables animation-related code, even if supported by the runtime environment」 |
| Base UI リポジトリ `test/setupVitest.ts` / `ComboboxRoot.test.tsx`   | 自身のテスト基盤で同フラグを既定 `true` にし、animation を検証するテストだけ `false` へ戻して `onTestFinished` で復元する                                                                                            |
| vitest.dev「Playwright」                                             | `contextOptions` は `browser.newContext` へ素通しで、context はテストファイル単位。`reducedMotion: "reduce"` でメディア機能を偽装できる                                                                              |
| vitest.dev「retry」「TestCase」                                      | `retry` は全体 / test 単位 / `condition` で絞れる。retry 後に通ったテストは `TestDiagnostic.flaky` で拾え、default reporter は `(retry xN)`、GitHub Actions reporter は「Flaky Tests」節を出す                       |

## Decision

**ブラウザテストは Base UI の animation を無効にした状態を既定にし、閉じかけの popup が残る窓そのものを検証するテストだけが自分のテストの間だけ animation を戻す。popup を閉じた後の a11y 検査は unmount を待ってから行う。**

| 対象                         | 形                                                                                                                                                                                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 既定                         | `src/test/browser-setup.tsx` の `beforeEach` が `src/test/base-ui-animations.ts` の `disableBaseUiAnimations()` を毎テスト呼び、`globalThis.BASE_UI_ANIMATIONS_DISABLED = true` にする。閉じた popup は animate-out を待たずに unmount する                                                   |
| 窓を踏むテスト               | 本文の先頭で `enableBaseUiAnimations()` を呼ぶ。後続へ漏れないことは既定の `beforeEach` が毎テスト立て直すことで保証し、`onTestFinished` は自テスト内の後始末 (Base UI の `ComboboxRoot.test.tsx` と同じ形)。対象は「閉じかけの popup が残る間の挙動」を検証するもの (二重発火の dedupe など) |
| 影響を受けないもの           | tw-animate-css の enter animation は走る。rect や算出スタイルの実測は引き続き `waitForAnimations()` を先に置く (ADR-0013)。`data-starting-style` / `data-ending-style` の付与も変わらないが、既定では次の描画で unmount するため `data-ending-style` は観測できない                           |
| popup を閉じた後の a11y 検査 | `vi.waitFor` で popup の要素が `null` になるのを待ってから `expectNoA11yViolations()` を呼ぶ。既定では窓が無いが、規範として置き、animation を戻したテストでも同じ形で書く                                                                                                                    |
| `includeHidden`              | 既定では確定直後の行が `aria-hidden` 配下に残らないため、閉じた後の行取得に `includeHidden` を渡さない。モーダルが開いている間の取得には引き続き要る                                                                                                                                          |
| 上流                         | Base UI PR #5537 がマージされたら、本 ADR の既定を外せるかを再評価する。`inert` は focus guard の問題を消すが、閉じかけの popup の見出しが `heading-order` の incomplete に出る事象は残りうる                                                                                                 |

### 検討した選択肢

| 案                                                            | 評価                                                                                                                                                                                                                        | 採否     |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Base UI のフラグで animation を無効にし、必要なテストだけ戻す | 窓そのものが消える。Base UI 自身のテスト基盤と同じ形で、per-test で戻す前例もある。影響は Base UI の unmount 待ちに限られ、tw-animate-css の enter や rect 実測には及ばない                                                 | **採用** |
| Playwright の `contextOptions.reducedMotion: "reduce"`        | `src/styles.css` の `prefers-reduced-motion` ブロックが全 animation を 0.01ms にするため enter 側も止まる。context はファイル単位で、テスト単位で戻すには CDP `Emulation.setEmulatedMedia` が要る。範囲が広く、戻し方も重い | 却下     |
| 検査の順序だけを規範化する (unmount を待ってから axe)         | 根本の窓が残り、書き忘れると同じ形で再発する。採用案の補助として規範には残す                                                                                                                                                | 補助     |
| vitest の `retry` で吸収する                                  | 原因を消さず、失敗が隠れる。入れるなら flaky を可視化する reporter とセットで、別途判断する                                                                                                                                 | 却下     |
| 上流 (Base UI #5537、axe-core #4832) を待つ                   | 時期が未定。#5537 が入っても `heading-order` の incomplete は残りうる                                                                                                                                                       | 却下     |

## Consequences

- ブラウザテストは本番と違い Base UI の animation を待たない条件で走る。閉じかけの popup の挙動を守るテストは `enableBaseUiAnimations()` を明示し、animation ありの条件で走っていることが本文から読めるようにする
- 二重発火の dedupe テスト (ADR-0015) は animate-out の窓を踏む必要があるため、animation を戻して走らせる
- `.claude/rules/testing.md`「ブラウザテストの CSS とレイアウト実測」が、既定と戻し方、popup を閉じた後の a11y 検査の順序を持つ
- 再評価条件: Base UI が閉じかけの popup を a11y tree と focus 順から外す変更 (PR #5537) を出荷したとき、および axe-core が focus guard の heuristics を更新したとき

## 出典

- Base UI Handbook「Animation」: https://base-ui.com/react/handbook/animation
- Base UI issue #5519: https://github.com/mui/base-ui/issues/5519
- Base UI PR #5537: https://github.com/mui/base-ui/pull/5537
- Base UI `test/setupVitest.ts`: https://github.com/mui/base-ui/blob/master/test/setupVitest.ts
- axe-core issue #4832: https://github.com/dequelabs/axe-core/issues/4832
- vitest「Playwright」(contextOptions): https://vitest.dev/config/browser/playwright
- vitest「retry」: https://vitest.dev/config/retry
- vitest「TestCase」(diagnostic): https://vitest.dev/api/advanced/test-case
