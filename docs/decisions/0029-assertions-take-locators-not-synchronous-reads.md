# ADR-0029: assert には locator を渡し、同期読みは代替 matcher の無い実測に限る

- Status: Proposed
- Date: 2026-09-22
- 関連: ADR-0013 (待機を retry API に委ねる。本 ADR はその規範を lint へ落とし、`element()` を許す範囲を狭める)、ADR-0004 (ルールの選定基準。自前ルールを `jsPlugins` で足す判断)

## Context

ADR-0013 は「操作後の属性・テキストは `expect.element` で検証する」と決めたが、強制はレビューに置いた。
同 ADR の Consequences は理由を「lint で表現できる形は無い」と書いている。この一文が誤っていた。

### 同期読みは retry を持たず、失敗したときに何も言わない

`@vitest/browser` 4.1.11 の `context.d.ts` で、`element()` / `elements()` / `query()` / `all()` は同期の戻り値を持ち、retry の記述を持たない。retry するのは `findElement()` だけで、その docstring が「wait and retry until a matching element appears in the DOM, using increasing intervals (0, 20, 50, 100, 100, 500ms)」と書く。

公式 docs は同期読みの 2 つに DANGER 表記を置く。

| 出典                                                                     | 記述                                                                                                             |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| <https://vitest.dev/guide/browser/locators> の `.query()` / `.element()` | "This is an escape hatch for external APIs that do not support locators. Prefer using locator methods instead."  |
| <https://vitest.dev/guide/browser/assertion-api>                         | "We recommend to always use `expect.element` when working with `page.getBy*` locators to reduce test flakiness." |

300ms 後に要素を描画するコンポーネントへ、描画前に assert を置いて測った (2026-09-22、browser project)。

| assert                                              | 結果                                            |
| --------------------------------------------------- | ----------------------------------------------- |
| `expect(locator.query()).not.toBeNull()`            | 1ms で赤。文言は `expected null not to be null` |
| `await expect.element(locator).toBeInTheDocument()` | 305ms で緑                                      |

失敗の文言も同じ条件で比べた。要素が最後まで現れない場合、同期読みは `expected null not to be null` を出し、`expect.element` は `Cannot find element with locator: page.getByText('ない')` を出す。前者はどの locator が解決しなかったかを持たない。

つまり同期読みを assert へ流すと、flake と診断の欠落が同時に入る。

### 現状の違反

working tree が `origin/main` と一致する状態で数えた (2026-09-22)。

```bash
grep -rnE 'expect\(\s*[A-Za-z_$][^;]*\.(element|query|all|elements)\(\)' --include='*.test.tsx' src/ | wc -l
```

45 件 / 13 ファイル。内訳と移行先は次のとおりで、45 件すべてがどれかの行に当たる。

| 形                                                 | 件数 | 移行先                                         |
| -------------------------------------------------- | ---- | ---------------------------------------------- |
| `expect(x.query()).not.toBeNull()`                 | 20   | `expect.element(x).toBeInTheDocument()`        |
| `expect(x.query()).toBeNull()`                     | 8    | 「最初から出ない」なら後述の `expectAbsent(x)` |
| `expect(x.element().getAttribute(a)).toBe(v)`      | 6    | `expect.element(x).toHaveAttribute(a, v)`      |
| `expect(document.activeElement).toBe(x.element())` | 5    | `expect.element(x).toHaveFocus()`              |
| `expect(x.all()).toHaveLength(n)`                  | 2    | `expect.element(x).toHaveLength(n)`            |
| `expect(x.element().textContent).toContain(t)`     | 2    | `expect.element(x).toHaveTextContent(t)`       |
| 要素を受け取るヘルパーへ渡す (`visibleIconNames`)  | 2    | 移さない。locator を受け取る matcher が無い    |

`src/components/action/button.test.tsx:31` の `expect(document.activeElement).toBe(button.element())` は `await button.click()` の直後にある。ADR-0013 が「操作後の同期読みは更新前の値を拾う」と書いた形そのものが残っている。

移行先のうち、locator 1 つが複数要素へ解決する `toHaveLength` と、要素の外の状態を見る `toHaveFocus` は、規範に書く前に動かして確かめた (2026-09-22)。250ms 後に項目が 1 件から 3 件へ増えるリストで `expect.element(locator).toHaveLength(3)` は 263ms 待って通る。`click()` の直後の `expect.element(locator).toHaveFocus()` も通る。

### lint で書けるかを確かめていなかった

ADR-0013 が「lint で表現できる形は無い」と書いたのは、`element()` を許すかどうかが「操作を挟んだか」という実行時の履歴で決まると考えたためである。
しかし禁止したい形は履歴ではなく式の構造で表せる。**同期読みの値が `expect()` の引数へ届くこと**を報告すればよい。`findElement()` と `element()` の使い分け (ADR-0013) は assert の外側の話なので、この判定とは独立する。

同じ趣旨のルールは他のエコシステムに先行例がある。`eslint-plugin-playwright` の [`prefer-web-first-assertions`](https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/prefer-web-first-assertions.md) が `expect(await locator.isVisible()).toBe(true)` を報告し、"web first assertions will automatically wait for the conditions to be fulfilled resulting in more resilient tests" を理由に挙げる。対象 API が違うため流用はできない。

上流の `@vitest/eslint-plugin` はこの形を持たない。ルールの一覧を `gh api repos/vitest-dev/eslint-plugin-vitest/contents/docs/rules` で取り、`locator` / `element` / `browser` / `poll` を含む名前を数えた (2026-09-22 時点で 82 本中 1 本)。該当した `require-awaited-expect-poll` は `await` の付け忘れを見るもので、ADR-0004 が `correctness` 経由で有効と記録している。

### 移行すると、退行したときのテストが 15 秒かかるようになる

`expect.element` へ寄せると「最初から出ないこと」の確認も `.not.toBeInTheDocument()` になる。この形は退行で赤になったとき、テストの残り予算を使い切る。

`matchers.d.ts` の docstring と公式 docs は、`expect.element` の timeout が `expect.poll.timeout` を既定にすると書く。実装はそうなっていない。`expect.poll.timeout` を 200ms に設定して測った (2026-09-22)。

| assert                                                 | 所要                                   | 判定                                                |
| ------------------------------------------------------ | -------------------------------------- | --------------------------------------------------- |
| `expect.poll(() => false).toBe(true)`                  | 206ms                                  | 設定値が効いている                                  |
| `expect.element(存在する要素).not.toBeInTheDocument()` | 2938ms (`testTimeout` 3000 のテスト内) | 設定値を無視し、残り予算から 100ms を引いた値を使う |

設定値を読んでいることは `expect.poll` 側で確かめた。片方だけが無視している。
既定の `testTimeout` (browser project は 15000) のまま同じ assert を測ると **14933ms** かかり、`{ timeout: 0 }` を渡すと **52ms** で落ちる。失敗の文言は変わらない。

この食い違いは上流でも報告されている。どちらの issue も OPEN である (2026-09-22 時点)。

| issue                                                     | 表題                                     | この ADR が使う記述                                                                                                                         |
| --------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [#8308](https://github.com/vitest-dev/vitest/issues/8308) | expect.poll.timeout not being respected  | 報告者以外にも再現報告があり、4.0.15 でも再現している                                                                                       |
| [#9751](https://github.com/vitest-dev/vitest/issues/9751) | Unify and simplify timeout configuration | 内部で `testTimeout - elapsedTime - 100ms` を計算していることを "Hidden dynamic adjustment" と呼び、"Users are unaware this happens" と書く |

#8308 のコメントは回避策として Playwright provider の `actionTimeout` を挙げる。この設定を入れると `expect.poll.timeout` が `expect.element` にも効くようになる。**採れない。** `actionTimeout: 5000` と `expect.poll.timeout: 200` を入れて測ると、否定 assert の赤は 208ms まで縮むが、同じ設定で 300ms 後に現れる要素を待つ assert が 208ms で `Cannot find element with locator` の赤になった (2026-09-22)。

待つべき assert と待ってはいけない assert を 1 つの既定値では両立できない。`expect.poll.timeout` を正当な待機に足りる値まで上げると、否定 assert はその値を使い切る側へ戻る。区別は呼び出しごとにしか置けない。

### 否定 assert には、待ち時間とは別に検出力の問題がある

要素が無い状態から始まる `.not.toBeInTheDocument()` は、条件が最初から満たされているため 1 回目の試行で通る。DOM が確定する前でも通るので、その assert だけでは操作が効いたことを何も検証していない。

これは `@vitest/browser` が否定の `toBeInTheDocument` だけを特例にしているためで、他の否定 matcher とは挙動が違う。存在しない要素へ `.not.toHaveTextContent()` を当てると、要素が引けない間 retry して 2927ms 後に `Cannot find element with locator` で落ちた (2026-09-22、`testTimeout` 3000)。否定 matcher を一律に扱うと、この違いを踏む。

## Decision

**assert には locator を渡す。同期読みを `expect()` の引数へ流すのは、locator に対応する matcher が無い実測に限る。**

| 規範                                                                                                                                                  | 守らないと何が壊れるか                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 同期読み (`element()` / `query()` / `all()` / `elements()`) の値を `expect()` の引数にしない。`expect.element` を通す。変数へ束縛してから渡すのも同じ | 同期読みは retry を持たない。DOM が確定する前に評価されると、実装が正しくてもテストが落ちる。失敗しても locator の名前が出力に残らない |
| 同期読みを `expect()` へ流してよいのは、locator に対応する matcher が無い実測のときだけ。許す形の列挙はルールが持つ                                   | 列挙をこの文書へも書くと、ルールと文書が別々に育つ                                                                                     |
| 「最初から出ないこと」は `expectAbsent(locator)` で確かめ、同じ操作の効果を表す肯定 assert を先に置く                                                 | この matcher は要素が無ければ 1 回目で通る。肯定 assert が無いと、検証しているつもりで何も検証していない                               |
| 要素が在る状態から消えるのを待つときは `expect.element(x).not.toBeInTheDocument()` をそのまま書く                                                     | 消えるのを待つ側には retry の予算が要る。`expectAbsent` に置き換えると、unmount を待たずに落ちる                                       |
| `.not.toBeInTheDocument()` 以外の否定 matcher には肯定 assert を添えなくてよい                                                                        | 要素が引けない間 retry するため、不在のまま通ることがない                                                                              |

`element()` と `findElement()` の使い分けは ADR-0013 のままである。本 ADR が狭めるのは、その値を assert へ渡す経路だけである。

## Consequences

### 機械強制は oxlint の JS plugin で書く

ルールは `scripts/lint/` に置き、`vite.config.ts` の `lint.jsPlugins` から読む。`vp lint` と `vp check` で走るので、検査のための実行経路を増やさない。`@shadcn/lint` と `eslint-plugin-testing-library` が既に同じ経路に載っている (ADR-0004)。

API は同梱の `node_modules/vite-plus/docs/guide/lint.md` 「Writing Your Own Rules」に従う。型は `vite-plus/lint/plugins` の `definePlugin` / `defineRule`、テストは `vite-plus/lint/plugins-dev` の `RuleTester` から取る。同 docs は `@oxlint/plugins` と `oxlint` を直接依存に足すことを禁じ、理由を 2 つ挙げる。別に pin した写しが linter 本体からずれること、pnpm の strict layout では plugin ファイルから解決できないことである。

この形が使えるのは vite-plus 0.3.2 の版に両方の entrypoint があるためで、2026-09-22 に実測して確かめた。`vite-plus/lint/plugins` から `defineRule` を import した TypeScript は型解決に成功する (`TS2307` は出ない)。`RuleTester` に `describe` / `it` を渡したルールのテストは scripts-tools project で `Tests 2 passed (2)` になる。

実装前に、ルールが効かなくなる壊し方を 2 つ決めておく。どちらでも赤にならないなら、そのルールは検査として成立していない。

| 壊し方 | 操作                                                            | 期待する結果                                                                                                  |
| ------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 直接   | `vite.config.ts` の `lint.rules` からルール名を外す             | 違反を 1 件だけ残したファイルへ `vp lint` を当てて赤が消える                                                  |
| 間接   | ルールの変数束縛の追跡 (`context.sourceCode.getScope`) を止める | `expect(locator.query())` は報告されたまま、`const el = locator.element(); expect(el).toBe(...)` が無言で通る |

間接の側を置くのは、束縛を挟む形が実際に多いためである。次のコマンドで数えると 64 行 / 17 ファイルある (2026-09-22)。

```bash
grep -rE 'const \w+ = [^;]*\.(element|query|all|elements)\(\)' --include='*.test.tsx' src/
```

追跡が外れても直接の形だけは報告され続けるので、設定は有効に見える。ルールのテストはこの 2 つの形を `RuleTester` の invalid に置く。

### 移行は 1 つの PR で終える

対象は 13 ファイルである。段階移行のために `lint.overrides` で未移行ファイルを列挙する形は採らない。列挙が対象より大きくなり、一覧を消すための作業が別に要る。

severity を `warn` にして移行を待つ形も採らない。`vp check` は warn で exit 1 にならないため、新規コードへの強制力を失う (ADR-0004 が `testing-library/no-debugging-utils` で同じ判断をしている)。

移行で赤になったテストは、`expect.element` が待つようになったぶん実装の欠陥を新しく捕まえている可能性がある。赤は書き換えの失敗と区別して調べる。

### 「最初から出ない」判定は `expectAbsent` が 1 箇所で持つ

`{ timeout: 0 }` を渡す薄いヘルパーを `src/test/` へ置く。呼び出し側の名前で「待たないつもりである」ことが読めるようにする。`expect.element(x).not.toBeInTheDocument()` をそのまま書けば消滅待ちで、`expectAbsent(x)` なら不在確認である。

移行時にこの 2 つを取り違えると、消滅待ちを `expectAbsent` にした側だけが flake を作る。誤りの向きが非対称なので、`.not.toBeInTheDocument()` から `expectAbsent` へ移す箇所は 1 件ずつ、直前の操作が要素を消すものかどうかで判定する。

### ADR-0013 を改訂する

Consequences の「lint で表現できる形は無い」を、本 ADR が決めた判定へ差し替える。誤った一文を生きた文書に残すと、次に同じ検討をする人がもう一度同じ結論で止まる。

`.claude/rules/testing.md` には「locator の扱い」の節を足し、上の Decision の表を規範の形で置く。既存の「状態のアサートは semantic matcher を先に探す」「ブラウザテストの CSS とレイアウト実測」と重なる項目は、新しい節へ吸収して重複を残さない。

### 再評価の条件

- #9751 が timeout の設定を 1 か所へ集約し、`expect.element` の既定を宣言できるようになったら、`expectAbsent` が `{ timeout: 0 }` を持つ必要があるかを測り直す
- `@vitest/eslint-plugin` が同種のルールを持ったら、そちらへ移して自前のルールを消す
- 上流が locator に対応する matcher を足したら、ルールの許可リストからその形を外す。1 要素ずつ外して `vp lint` を走らせ、違反が 0 件のままなら不要と判定する

### 本 ADR が扱わないもの

クリックの発火方法は ADR-0015 が持つ。合成イベントを送る helper は 2026-09-22 の改訂で廃止され、その引数が同期読みだった経路も一緒に消えた。

`getBoundingClientRect` と `getComputedStyle` による実測 (ADR-0013 と `testing.md`「ブラウザテストの CSS とレイアウト実測」) は、そのまま残す。ただし許すのは読み方ではなく assert である。単一プロパティの等値は `toHaveStyle` で書けるので、`expect()` へ流してよいのは matcher で表せない主張に限る。`src/components/ui/sidebar.test.tsx` の「開く前後で背景色が変わったこと」のように、2 回の観測を比べる形がこれに当たる。どこまでを許すかはルールの実装時に、1 件ずつ matcher で書けるかを試して決める。

## 検討した選択肢

| 案                                                                             | 評価                                                                                                                             | 採否     |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `expect()` の引数に届く同期読みを lint で報告し、代替 matcher の無い形だけ許す | 禁止したい形が式の構造で表せる。公式が DANGER 表記で同じ向きを案内しており、他エコシステムに先行例がある                         | **採用** |
| レビューで見る (ADR-0013 の現状)                                               | ADR-0013 の 3 日後の PR #16 (`91515ee`) が同じ形を新しく足している。判断を誤ってもほとんどの実行で通るため、レビューでは落ちない | 却下     |
| `element()` を全面禁止し `findElement()` に統一する                            | `getBoundingClientRect` などの実測が待つ理由のない箇所まで `await` になる。ADR-0013 が同じ理由で却下している                     | 却下     |
| `actionTimeout` を設定して `expect.poll.timeout` を効かせる                    | 否定 assert の赤は縮むが、同じ既定値が正当な待機にも掛かる。300ms 後に現れる要素を待つ assert が 208ms で落ちることを実測した    | 却下     |
| `testTimeout` を短くして赤のコストを抑える                                     | 待つべき assert の予算も一緒に縮む。遅い環境で緑のテストが落ちる                                                                 | 却下     |
| 否定 assert には触れず、同期読みの移行だけ行う                                 | 移行が 15 秒の赤を持ち込む。移行前の `expect(x.query()).toBeNull()` は同期の 1 回読みで、赤は即座だった                          | 却下     |
| `lint.overrides` で未移行ファイルを列挙して段階移行する                        | 対象は 13 ファイルで、列挙と、それを消す作業のほうが移行より大きい                                                               | 却下     |

## 出典

- vitest browser の locator: <https://vitest.dev/guide/browser/locators>
- vitest browser の assertion API: <https://vitest.dev/guide/browser/assertion-api>
- 同梱の `@vitest/browser` 4.1.11 の `context.d.ts` (同期読み 4 メソッドと `findElement` の docstring) と `matchers.d.ts` (`expect.element` が受ける型と timeout の docstring)
- 同梱の `node_modules/vite-plus/docs/guide/lint.md`「JS Plugins」
- oxlint の JS plugin 作成ガイド: <https://oxc.rs/docs/guide/usage/linter/writing-js-plugins.html>
- `eslint-plugin-playwright` の `prefer-web-first-assertions`: <https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/prefer-web-first-assertions.md>
- vitest-dev/vitest#8308 (OPEN): <https://github.com/vitest-dev/vitest/issues/8308>
- vitest-dev/vitest#9751 (OPEN): <https://github.com/vitest-dev/vitest/issues/9751>
