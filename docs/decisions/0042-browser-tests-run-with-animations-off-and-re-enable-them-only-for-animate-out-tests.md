# ADR-0042: ブラウザテストは animation を無効にして走らせ、animate-out の窓を踏むテストだけ戻す

- Status: Accepted
- Date: 2026-09-22
- 関連: ADR-0040 (待機は vitest の retry API に委ねる)、ADR-0041 (二重発火の検証は実イベントで書く)、ADR-0034 (a11y 検査の対象)

## Context

`src/routes/notes/index.test.tsx` の「削除中は対象の行が busy になる」が CI (GitHub Actions、run 34792768529) でだけ落ちた。ローカルでは通る。axe の incomplete に Base UI の focus guard (`aria-hidden-focus`) と確認ダイアログの見出し (`heading-order`) が出ていた。確定でダイアログを閉じた直後に `document.body` を検査しており、閉じかけの popup が animate-out (`duration-100`) の間だけ mount されたまま残る窓に検査が落ちていた。

この窓は乱数ではない。Base UI は閉じた popup を `element.getAnimations()` の完了まで mount し続ける (Handbook「Animation」)。その間、focus guard は `aria-hidden="true"` + `tabindex="0"` のまま、行は `aria-hidden` 配下のまま、`onOpenChangeComplete` は未発火のままである。検査や locator がこの窓の内側に落ちるか外側に落ちるかは実行環境の速さで決まり、遅い CI ほど内側に落ちる。

| 出典                                                                 | 内容                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base UI issue #5519 (2026-08-17)                                     | Combobox の exit animation 中に focus guard が focusable のまま残り、axe が `aria-hidden-focus` を出す。「DOM の状態は animation の間は決定的で、scan が窓の内外どちらに落ちるかで断続的に見えるだけ」                                                    |
| Base UI PR #5537 (2026-08-19 作成、2026-09-14 時点で未マージ)        | メンテナによる修正。閉じかけの popup に `inert` を付けて a11y tree と focus 順から外す。本文で「flaky ではなく animation の長さの間だけ決定的」と断言                                                                                                     |
| axe-core issue #4832 (open)                                          | floating-ui 系の focus guard を `aria-hidden-focus` が誤検出する。heuristics の更新待ち                                                                                                                                                                   |
| Base UI 配布物 `global.d.ts` / `internals/useAnimationsFinished.mjs` | `globalThis.BASE_UI_ANIMATIONS_DISABLED` が `true` の間、animation の完了を待たずに完了コールバックを即実行する。JSDoc「When `true`, disables animation-related code, even if supported by the runtime environment」                                      |
| Base UI リポジトリ `test/setupVitest.ts` / `ComboboxRoot.test.tsx`   | 自身のテスト基盤で同フラグを既定 `true` にし、animation を検証するテストだけ `false` へ戻して `onTestFinished` で復元する                                                                                                                                 |
| vitest.dev「Playwright」                                             | `contextOptions` は `browser.newContext` へ素通しで、context は session 単位 (`@vitest/browser-playwright` は sessionId ごとに context と page を持ち、1 つの session が複数ファイルを順に走らせる)。`reducedMotion: "reduce"` でメディア機能を偽装できる |
| vitest.dev「retry」「TestCase」                                      | `retry` は全体 / test 単位 / `condition` で絞れる。retry 後に通ったテストは `TestDiagnostic.flaky` で拾え、default reporter は `(retry xN)`、GitHub Actions reporter は「Flaky Tests」節を出す                                                            |

## Decision

**ブラウザテストは animation を無効にした状態 (Base UI のフラグ + `prefers-reduced-motion: reduce`) を既定にし、閉じかけの popup が残る窓そのものを検証するテストだけが自分のテストの間だけ animation を戻す。popup を閉じた後の a11y 検査は unmount を待ってから行う。**

| 対象 | 形                                                                                                                                                                                                                                                                                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 既定 | `src/test/browser-setup.tsx` の `beforeEach` が `src/test/animations.ts` の `disableAnimations()` を毎テスト呼ぶ。`globalThis.BASE_UI_ANIMATIONS_DISABLED = true` で閉じた popup は animate-out を待たずに unmount し、CDP `Emulation.setEmulatedMedia` の `prefers-reduced-motion: reduce` で `src/styles.css` の reduced-motion ブロックが CSS の animation / transition を 0.01ms にする |
| 上流 | Base UI PR #5537 がマージされたら、本 ADR の既定を外せるかを再評価する。`inert` は focus guard の問題を消すが、閉じかけの popup の見出しが `heading-order` の incomplete に出る事象は残りうる                                                                                                                                                                                               |

窓を踏むテストで animation を戻す書き方、止まった後に残るもの、閉じた後の a11y 検査の順序、`includeHidden` の扱いは `docs/guides/testing.md`「animation を戻すテストを書く」にある。

### 検討した選択肢

| 案                                                                                                                                 | 評価                                                                                                                                                                                                                                                                                                       | 採否     |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Base UI のフラグで animation を無効にし、必要なテストだけ戻す                                                                      | 窓そのものが消える。Base UI 自身のテスト基盤と同じ形で、per-test で戻す前例もある。影響は Base UI の unmount 待ちに限られ、tw-animate-css の enter や rect 実測には及ばない                                                                                                                                | **採用** |
| `prefers-reduced-motion: reduce` のエミュレーション (`src/styles.css` のブロックが CSS の animation / transition を 0.01ms にする) | Playwright の context 単位の設定ではテスト単位に戻せないので、CDP `Emulation.setEmulatedMedia` で `beforeEach` から per-test に立てる。次のテストの `beforeEach` が立て直すので、戻す経路を持たない (`parkMouse` と同じ形)。rect 実測は `expect.poll` の中で読むので、enter animation を走らせる理由が無い | **採用** |
| 検査の順序だけを規範化する (unmount を待ってから axe)                                                                              | 根本の窓が残り、書き忘れると同じ形で再発する。採用案の補助として規範には残す                                                                                                                                                                                                                               | 補助     |
| vitest の `retry` で吸収する                                                                                                       | 原因を消さず、失敗が隠れる。入れるなら flaky を可視化する reporter とセットで、別途判断する                                                                                                                                                                                                                | 却下     |
| 上流 (Base UI #5537、axe-core #4832) を待つ                                                                                        | 時期が未定。#5537 が入っても `heading-order` の incomplete は残りうる                                                                                                                                                                                                                                      | 却下     |

## Consequences

- ブラウザテストは本番と違い animation を待たず、CSS の transition / animation も 0.01ms の条件 (reduced motion を選んだユーザーと同じ) で走る。閉じかけの popup の挙動を守るテストは `await enableAnimations()` を明示し、animation ありの条件で走っていることが本文から読めるようにする
- transition の後に「変化しないこと」を見るテストは、retry では途中値の前に通ってしまう。reduced motion で settled 状態を即座に観測するので、`getAnimations()` の完了を待つ helper は置かない。待つ側の形は MDN `Animation.finished` の例そのものだが、観測の前に止める側 (Playwright の screenshot `animations: "disabled"`、Chromatic の最終フレーム停止) が主流で、待つ helper に直接の先行例は無い
- 二重発火の dedupe テスト (ADR-0041) は animate-out の窓を踏む必要があるため、animation を戻して走らせる (書き方は `docs/guides/testing.md`「animation を戻すテストを書く」)
- 再評価条件: Base UI が閉じかけの popup を a11y tree と focus 順から外す変更 (PR #5537) を出荷したとき、および axe-core が focus guard の heuristics を更新したとき

## 出典

- Base UI Handbook「Animation」: https://base-ui.com/react/handbook/animation
- Base UI issue #5519: https://github.com/mui/base-ui/issues/5519
- Base UI PR #5537: https://github.com/mui/base-ui/pull/5537
- Base UI `test/setupVitest.ts`: https://github.com/mui/base-ui/blob/master/test/setupVitest.ts
- axe-core issue #4832: https://github.com/dequelabs/axe-core/issues/4832
- vitest「Playwright」(contextOptions): https://vitest.dev/config/browser/playwright
- Playwright `BrowserContextOptions.reducedMotion` (`prefers-reduced-motion` のエミュレーション): <https://playwright.dev/docs/api/class-browser#browser-new-context>
- Chrome DevTools Protocol `Emulation.setEmulatedMedia`: <https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setEmulatedMedia>
- Playwright screenshot の `animations` オプション (観測の前に止める側の先行例): <https://playwright.dev/docs/api/class-page#page-screenshot>
- MDN `Animation.finished` (待つ側の形): <https://developer.mozilla.org/en-US/docs/Web/API/Animation/finished>
- vitest「retry」: https://vitest.dev/config/retry
- vitest「TestCase」(diagnostic): https://vitest.dev/api/advanced/test-case
