---
paths:
  - "src/**/*.test.*"
  - "scripts/**/*.test.*"
---

# テストルール

## 冒頭チェックリスト

- [ ] import は `vite-plus/test` (`vitest` 直接 import 禁止)
- [ ] worktree では中へ cd してから `vp test run` (要 `vp install`。`--root` は使わない)
- [ ] TDD: failing test → fail 確認 → 最小実装 → pass 確認
- [ ] 新規テスト前に同一対象の既存テストを grep

## import

```typescript
import { describe, it, expect, vi } from "vite-plus/test";
```

`vitest` から直接 import しない。`vite-plus/test` が re-export している。

## テストの種別と置き場所

壊れる原因が違うものを同じ project に混ぜない。混ざると、失敗したときに直す対象がアプリなのかスクリプトなのか設定なのか読み取れない。

| 種別                   | 壊れる原因                   | 置き場所                            | 実行                                       |
| ---------------------- | ---------------------------- | ----------------------------------- | ------------------------------------------ |
| アプリの単体テスト     | アプリのコード変更           | `src/**/*.test.ts`                  | `vp test run --project unit`               |
| アプリのブラウザテスト | アプリのコード変更           | `src/**/*.test.tsx`                 | `vp test run --project browser`            |
| スクリプトの単体テスト | スクリプト自身の変更         | `scripts/lib/` / `scripts/dev-env/` | `vp test run --project scripts-tools`      |
| 整合検査               | 設定・ドキュメントの更新漏れ | `scripts/checks/integrity/`         | `vp test run --project checks-integrity`   |
| 成果物の検査           | ビルド結果に現れる挙動の欠落 | `scripts/checks/runtime/`           | `vp node scripts/checks/runtime/<name>.ts` |

- `src/` 全体へ規範を当てるソース検査は、いま 1 つも無い。新設するときは `scripts/checks/source/` と `checks-source` project を対で作り、判定ロジックは `scripts/lib/` に置いて単体テストを別に持つ。判定と適用を同じファイルに書くと、判定の境界条件を試すために `src/` を壊す必要が出る
- ソース検査を新設する前に lint で表現できないかを先に見る。class 名や import の規約は lint プラグイン (必要なら `jsPlugins`、ADR-0004) が持つほうが、字面走査より対象の実体に近い
- 落ちたときに判断が要らない検査は作らない。判断が要るとは、設定を直すか期待値へ足すかを選ぶことを指す (`lint-config.test.ts` の緩和ルールの drift hint、`registry-baseline.test.ts` の 3-way 判別)。期待値の書き換えしか選択肢が無い検査は、上流更新のたびに鳴って判断を鈍らせる (React Compiler の bail out 一覧を固定していた検査を 2026-09-02 に撤去した経緯は ADR-0009)
- 整合検査は「片方を直して片方を忘れた」を捕まえるもので、アプリのコードが 1 行も変わらなくても落ちうる。現在は ADR 索引・lint 設定の解決結果・registry baseline の 3 つ
- ビルド成果物が要る検査は vitest の project にしない。project は build との順序を持てないので、`mise run verify` と CI の `vp build` のあとに独立した step として並べる。判定ロジックは `scripts/lib/` へ切り出して単体テストを別に持つ (実例: `security-headers.ts` と `response-headers.ts`)
- 固定 port を使う検査は、起動前にその origin が応答しないことを確かめる。前回の残骸が答えると古い成果物を検査した結果が緑になる
- project を足したら `vitest.config.ts` の `projects` に追加する。include に一致しないテストは収集されず、書いたのに 1 度も走らない状態が無言で成立する

## 実行

- `vp test run <path>` で 1 回実行 (`vp test` は watch モード)
- `vp test` を**複数並行で走らせない**。orphan 化した runner が残ると後続実行が collection エラーで巻き添えになる。kill 後は `ps` で実プロセスの残存を確認してから再実行する
- background 実行するときは grep 等の**パイプを付けない**。生出力で流し、途中経過は出力ファイルを Read する。パイプの buffering で完了まで出力が見えず、ハングと実行中を区別できなくなる
- 所要時間が普段の full run を大きく超えたら、完走を待たずに止めて切り分ける
- 進行の判定は経過時間と CPU 時間で行う (`ps -o pid,etime,time -p <pid>`)。CPU 時間が経過時間に対して伸びていなければ待っても終わらない
- `vp check` が同一コミットで乱数的に落ちることがある。`typescript/no-unnecessary-type-assertion` が非決定的に発火する上流バグで、`--threads=1` でも再現する (oxc-project/oxc#21752)。コードを変えずに 2 回続けて結果が割れたらこれを疑う

## worktree でのテスト実行

worktree (`.claude/worktrees/**`) では `vp install` 済みを前提に、worktree の中へ cd してから実行する:

```bash
cd <worktree絶対パス> && vp install             # 初回のみ
cd <worktree絶対パス> && vp test run <path>     # unit / browser とも可
```

- `vp test run --root <worktree>` は**使わない**。worktree に node_modules が存在すると runner (main 側) とテスト依存 (worktree 側) の二重解決になり、collection が `Cannot read properties of undefined (reading 'config')` で全滅する

## TDD サイクル

1. failing test を書く
2. `vp test run <path>` で fail 確認
3. 最小実装で pass させる
4. `vp test run <path>` で pass 確認
5. リファクタ (テスト不変)

## 着手前の確認

新規テスト追加前に、同じ関数・スキーマをテストする既存ファイルがないか grep:

```bash
grep -rn "<functionName>" src/ scripts/
```

## 境界値テストは数式コメント先行

```ts
// 900 + 200 = 1100 → slice(-1000) で先頭 100 件破棄
expect(result[0]).toBe(existing[100]);
```

cap 境界値は `cap-1 / cap / cap+1` の 3 点セット。

## assertion helper と型ナローイング

- assertion を実行するテストヘルパーは `expect*` で命名する。`vitest/expect-expect` が assertion と認めるのは `expect*` のパターンと、`vite.config.ts` に名指しした関数だけ。命名を外すとヘルパーだけを呼ぶテストが落ちる (ADR-0004)
- テスト内の型ナローイングは `vite-plus/test` の `assert` を使う。`if` 内の `expect` は `vitest/no-conditional-expect` が報告するため、条件分岐で assertion を囲まない (ADR-0004)

## mock の注意点

- `mock.calls` を受けるヘルパーの引数は `unknown[][]` で型注釈する (実例: `src/test/loader-helpers.ts`)
- `vi.stubEnv` 使用時は `afterEach(() => vi.unstubAllEnvs())`
- **`vi.mock()` の factory 内では chained なモックメソッドを使わない**。返り値は `vi.fn(() => Promise.resolve(x))` の形で書く (factory の外の `vi.mocked(fn).mockResolvedValue(x)` は正常)
- factory は巻き上げられるため、`vi.fn().mockResolvedValue(x)` は browser mode でだけ mocking エラーになる。非ブラウザテストでは通るので気付きにくい

## テスト環境制約に遭遇したら

1. 代替手段を検討する
2. 実行環境で条件分岐できるなら `skipIf` を使う
3. 恒久的に無効化するなら、理由付きの `oxlint-disable-next-line vitest/no-disabled-tests` を `it.skip` の直前に置く。`it.todo` も `vitest/warn-todo` の理由付き抑制が要る
4. 完全削除する場合はコミットメッセージに未テスト範囲を記載する

## クリックの発火方法

既定は `.click()`。Playwright に弾かれたら `dispatchNativeClick` (`src/test/native-click.ts`) へ切り替える。

`.click()` は visible / enabled / stable を待ってから、viewport 内の座標と hit-target を確かめる (`playwright-core` の `_performPointerAction`)。弾かれる典型は次のとおり。

| 条件               | 落ちる例                                                                |
| ------------------ | ----------------------------------------------------------------------- |
| enabled            | native `disabled`、`aria-disabled="true"`                               |
| stable             | 開閉アニメーションの途中。`waitForAnimations()` を先に通す              |
| visible / viewport | `sr-only` の 1px + clip。`getByRole(..., { name })` で本体を掴む        |
| hit-target         | base-ui のバックドロップ (`data-base-ui-inert`)、`pointer-events: none` |

```typescript
import { dispatchNativeClick } from "@/test/native-click";

dispatchNativeClick(screen.getByRole("button", { name: "削除" }).element());
```

- **どの条件で落ちたかは Playwright のエラー文言に出る。** 推測で切り替えず、文言を読んでから選ぶ
- **既存が `dispatchNativeClick` でも、同じ場所で `.click()` が通ることがある。** 倣う前に試す
- `click({ force: true })` は上の 5 条件をまとめて飛ばす。使う前に `waitForAnimations()` を通す (アニメーション途中だと "Element is outside of the viewport" で落ちる)
- Checkbox には `.click()` を使う。`dispatchNativeClick` を本体へ送ると hidden input への転送が label の activation behavior と重なり、変更ハンドラが 2 回発火する (`src/test/native-click.ts` の JSDoc)

## ブラウザテストの CSS とレイアウト実測

ブラウザテストでは Tailwind が実 CSS に解決される (`vitest.browser.config.ts` の `@tailwindcss/vite` と、`test.setupFiles` の `src/test/browser-setup.ts` による `src/styles.css` の import)。
`getBoundingClientRect` / `getComputedStyle` によるレイアウト検証が書けるので、**レイアウト回帰は className の `toContain` ではなく実挙動で守る**。

- viewport 定数と `expectWithinViewport` は `src/test/viewport.ts`。`page.viewport()` で変更したら `afterEach` で `DEFAULT_VIEWPORT` へ戻す
- 既定 viewport は `vitest.browser.config.ts` の `browser.viewport` に明示してあり、`DEFAULT_VIEWPORT` と一致させて管理する
- 実測と `click({ force: true })` の前に `src/test/wait-for-animations.ts` の `waitForAnimations()` を通す。tw-animate-css (`data-open:animate-in` 等) の実行中は transform で rect がずれる
- Dialog / Popover / Sheet の close 直後に `.query()).toBeNull()` を assert する場合は `vi.waitFor` で包む (base-ui は `animate-out` 完了まで unmount を遅らせる)
- `sr-only` のテキストノードは 1px + clip されるため Playwright の viewport 判定に落ちる。`getByRole(..., { name })` でボタン本体を掴む
- flex column の中に「溢れるコンテンツ」をテスト用に作るときは `height` ではなく `minHeight` を使う (flex item は既定で縮むため `height` では溢れない)
- hover 由来の配色との交絡は `src/test/park-mouse.ts` が `browser-setup.ts` の `beforeEach` で断つ。マウス位置を動かすテストは自分で戻す

## synthetic KeyboardEvent は `code` プロパティ必須

一部のライブラリは `event.code` (物理キー) で判定し、`key` だけ渡すと発火しない:

```typescript
// NG: code がない場合、code ベースの判定を行うライブラリでは発火しない
document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

// OK
document.dispatchEvent(
  new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }),
);
```

synthetic event を書く前に `grep -n "<eventName>" node_modules/<lib>/dist/*.js` で matching 条件を確認する。

## optimistic update テストは遅延 rejection で中間状態を観測

`mockRejectedValue` は microtask で即 reject するため、optimistic state が一瞬で消えて assertion が通らない。中間状態を観測するには rejection timing を制御する:

```typescript
// NG: 即 reject → optimistic state を観測不能
vi.mocked(updateFn).mockRejectedValue(new Error("fail"));

// OK: 遅延させて reject → その間 optimistic state を検証可能
vi.mocked(updateFn).mockImplementation(
  () => new Promise((_, reject) => setTimeout(() => reject(new Error("fail")), 200)),
);
```

テストの assertion 順序: optimistic state 確認 → reject 後のロールバック確認。

## ブラウザ操作ツールの使い分け

見た目の確認は claude-in-chrome、`mousedown` / `mousemove` / `mouseup` の間隔に依存する操作の検証は playwright-cli を使う。
claude-in-chrome は 1 操作を 1 ツール呼び出しで送るため、押下から移動までの間隔を制御できず、長押し判定やドラッグ開始のしきい値を狙って踏めない。
