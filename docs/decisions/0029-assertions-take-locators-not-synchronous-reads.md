# ADR-0029: assert には locator を渡し、同期読みは代替 matcher の無い実測に限る

- Status: Accepted
- Date: 2026-09-22
- 関連: ADR-0013 (待機を retry API に委ねる。本 ADR はその規範を lint へ落とし、`element()` を許す範囲を狭める)、ADR-0004 (ルールの選定基準。自前ルールを `jsPlugins` で足す判断)、ADR-0030 (本 ADR の移行で顕在化した assert の予算)、ADR-0031 (同じく顕在化した否定 assert の検出力)

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

`src/components/action/button.test.tsx` の `expect(document.activeElement).toBe(button.element())` は `await button.click()` の直後にあった。ADR-0013 が「操作後の同期読みは更新前の値を拾う」と書いた形そのものである。

**この grep は取りこぼす。** ルールを有効にすると、上の 45 件に加えて 9 件が出た。いずれも同期読みを変数へ束縛してから assert へ渡す形で、1 行の正規表現では束縛と使用が別の行にあるため見えない。`src/components/ui/sidebar.test.tsx` の `expect(trigger.getAttribute("aria-expanded")).toBe("true")` は `userEvent.keyboard("{Enter}")` の直後にあり、retry を持たないまま操作後の属性を読んでいた。件数を数える手段としては lint のほうが正確で、grep は着手前の規模感にしか使えない。

移行先のうち、locator 1 つが複数要素へ解決する `toHaveLength` と、要素の外の状態を見る `toHaveFocus` は、規範に書く前に動かして確かめた (2026-09-22)。250ms 後に項目が 1 件から 3 件へ増えるリストで `expect.element(locator).toHaveLength(3)` は 263ms 待って通る。`click()` の直後の `expect.element(locator).toHaveFocus()` も通る。

### lint で書けるかを確かめていなかった

ADR-0013 が「lint で表現できる形は無い」と書いたのは、`element()` を許すかどうかが「操作を挟んだか」という実行時の履歴で決まると考えたためである。
しかし禁止したい形は履歴ではなく式の構造で表せる。**同期読みの値が `expect()` の引数へ届くこと**を報告すればよい。`findElement()` と `element()` の使い分け (ADR-0013) は assert の外側の話なので、この判定とは独立する。

同じ趣旨のルールは他のエコシステムに先行例がある。`eslint-plugin-playwright` の [`prefer-web-first-assertions`](https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/prefer-web-first-assertions.md) が `expect(await locator.isVisible()).toBe(true)` を報告し、"web first assertions will automatically wait for the conditions to be fulfilled resulting in more resilient tests" を理由に挙げる。対象 API が違うため流用はできない。

上流の `@vitest/eslint-plugin` はこの形を持たない。ルールの一覧を `gh api repos/vitest-dev/eslint-plugin-vitest/contents/docs/rules` で取り、`locator` / `element` / `browser` / `poll` を含む名前を数えた (2026-09-22 時点で 82 本中 1 本)。該当した `require-awaited-expect-poll` は `await` の付け忘れを見るもので、ADR-0004 が `correctness` 経由で有効と記録している。

## Decision

**assert には locator を渡す。同期読みを `expect()` の引数へ流すのは、locator に対応する matcher が無い実測に限る。**

| 規範                                                                                                                                                  | 守らないと何が壊れるか                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 同期読み (`element()` / `query()` / `all()` / `elements()`) の値を `expect()` の引数にしない。`expect.element` を通す。変数へ束縛してから渡すのも同じ | 同期読みは retry を持たない。DOM が確定する前に評価されると、実装が正しくてもテストが落ちる。失敗しても locator の名前が出力に残らない |
| 同期読みを `expect()` へ流してよいのは、locator に対応する matcher が無い実測のときだけ。許す形の列挙はルールが持つ                                   | 列挙をこの文書へも書くと、ルールと文書が別々に育つ                                                                                     |

`element()` と `findElement()` の使い分けは ADR-0013 のままである。本 ADR が狭めるのは、その値を assert へ渡す経路だけである。

この移行で 2 つの問題が顕在化し、それぞれ別の ADR が決めている。assert の予算 (赤が 15 秒かかる) は ADR-0030、否定 assert の検出力 (不在や綴り違いで通る) は ADR-0031 である。

## Consequences

### 機械強制は oxlint の JS plugin で書く

ルールは `scripts/lint/` に置き、`vite.config.ts` の `lint.jsPlugins` から読む。`vp lint` と `vp check` で走るので、検査のための実行経路を増やさない。`@shadcn/lint` と `eslint-plugin-testing-library` が既に同じ経路に載っている (ADR-0004)。

API は同梱の `node_modules/vite-plus/docs/guide/lint.md` 「Writing Your Own Rules」に従う。型は `vite-plus/lint/plugins` の `definePlugin` / `defineRule` / `SourceCode`、テストは `vite-plus/lint/plugins-dev` の `RuleTester` から取る。同 docs は `@oxlint/plugins` と `oxlint` を直接依存に足すことを禁じ、理由を 2 つ挙げる。別に pin した写しが linter 本体からずれること、pnpm の strict layout では plugin ファイルから解決できないことである。

この形が使えるのは vite-plus 0.3.2 の版に両方の entrypoint があるためで、2026-09-22 に実測して確かめた。`vite-plus/lint/plugins` から `defineRule` を import した TypeScript は型解決に成功する (`TS2307` は出ない)。`RuleTester` に `describe` / `it` を渡したルールのテストは scripts-tools project で通る。

**木は親だけを辿る。** oxlint の node は `parent` を持つので、`Object.values` で部分木を降りる走査は木を登り直して無限再帰する (2026-09-22 に `RangeError: Maximum call stack size exceeded` で観測)。判定は値の使われ方を上へ辿る形で書く。

ルールが効かなくなる壊し方を 2 つ決め、どちらも赤になることを確かめた (2026-09-22)。直接と束縛の違反を 1 件ずつ持つファイルへ `vp lint` を当てると 2 件が報告される。

| 壊し方         | 操作                                                                | 報告件数                                     |
| -------------- | ------------------------------------------------------------------- | -------------------------------------------- |
| (壊していない) | —                                                                   | 2                                            |
| 直接           | `vite.config.ts` の `lint.rules` でルールを `off` にする            | 0                                            |
| 間接           | 変数束縛の追跡 (`context.sourceCode.getDeclaredVariables`) を止める | 1 (直接の形だけが残り、束縛の形が無言で通る) |

間接の側を置くのは、束縛を挟む形が実際に多いためである。次のコマンドで数えると 64 行 / 17 ファイルあった (2026-09-22)。

```bash
grep -rE 'const \w+ = [^;]*\.(element|query|all|elements)\(\)' --include='*.test.tsx' src/
```

追跡が外れても直接の形だけは報告され続けるので、設定は有効に見える。ルールのテストはこの 2 つの形を `RuleTester` の invalid に置いてある。

### 移行は 1 つの PR で終える

段階移行のために `lint.overrides` で未移行ファイルを列挙する形は採らない。列挙が対象より大きくなり、一覧を消すための作業が別に要る。

severity を `warn` にして移行を待つ形も採らない。`vp check` は warn で exit 1 にならないため、新規コードへの強制力を失う (ADR-0004 が `testing-library/no-debugging-utils` で同じ判断をしている)。

移行で赤になったテストは、`expect.element` が待つようになったぶん実装の欠陥を新しく捕まえている可能性がある。赤は書き換えの失敗と区別して調べる。

適用先はブラウザテスト本文と、そこへ locator を配る helper (`src/test/**` と `*.test-helpers.*`) にする。テスト本文だけに当てると、helper へ切り出した同期読みがルールから外れる。glob は `scripts/lib/companion-files.ts` から引き、字面を並べ直さない。

`*.test.ts` は含めない。unit project は locator を持たず、drizzle の `db.select().from(x).all()` が同じメソッド名で誤検出になる (2026-09-22 実測。`src/**` へ広げると `src/server/db/index.test.ts` の 2 件が出る)。

ルールが「locator かどうか」をメソッド名と引数ゼロだけで判定し、適用先の glob がその補いになっている。型で判定できれば glob は要らないが、oxlint の JS plugin は型情報を持たない。公式の JS plugin ガイドが「Not supported yet」に「Lint rules that rely on TypeScript type-awareness」を挙げている。

型の代わりに receiver の連鎖を辿る案は採らない。`confirmDeleteButton(screen).element()` のように helper が返す locator は連鎖に生成口を持たず、型なしでは追えない。この形は 2026-09-22 時点で 3 件あり、`.claude/rules/directory-structure.md`「テストとスクリプトの配置」が helper への切り出しを勧めているので増える側である。

先行例も receiver を見ない。`eslint-plugin-playwright` の `prefer-web-first-assertions` は `expect()` から辿って引数をスコープで解決し、メソッド名 (`isVisible` / `innerText` / `getAttribute` 等) だけで判定する。適用範囲の限定は利用者の設定に委ねている。本ルールが glob で範囲を限るのは同じ形で、`element` / `all` のように名前が一般的なぶん範囲の限定が要る、という違いだけである。

この override は `scripts/checks/integrity/lint-config.test.ts` が解決後の設定で固定するので、適用先か severity を動かすとそこが落ちる。

### ADR-0013 を改訂する

Consequences の「lint で表現できる形は無い」を、本 ADR が決めた判定へ差し替える。誤った一文を生きた文書に残すと、次に同じ検討をする人がもう一度同じ結論で止まる。

`.claude/rules/testing.md` には「locator の扱い」の節を足し、上の Decision の表を規範の形で置く。既存の「状態のアサートは semantic matcher を先に探す」「ブラウザテストの CSS とレイアウト実測」と重なる項目は、新しい節へ吸収して重複を残さない。

### ルールが追えない形

判定は 1 ファイルの構文だけで行う。次の 2 つは報告しない。`testing.md` が「件数はこのルールで数える」と書くので、数えた結果がこの範囲を出ないことを併記しておく。

| 形                    | 例                                                                  | なぜ追えないか                                                                                 |
| --------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 束縛を 2 段以上またぐ | `const el = x.element(); const t = el.textContent; expect(t)...`    | 参照を 1 段だけ辿る。任意段を追うのは taint 解析になる                                         |
| helper の戻り値       | `expect(titleTextbox(screen).query())` を別ファイルの helper が包む | 関数を跨いだ追跡が要る。先行例 (`eslint-plugin-playwright`) も 1 段の dereference に留めている |

### 再評価の条件

- `@vitest/eslint-plugin` が同種のルールを持ったら、そちらへ移して自前のルールを消す
- 上流が locator に対応する matcher を足したら、ルールの許可リストからその形を外す。1 要素ずつ外して `vp lint` を走らせ、違反が 0 件のままなら不要と判定する

### 本 ADR が扱わないもの

| 対象                                                  | 持ち主                                                                                                         |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| assert の予算 (`expect.poll.timeout` / `findElement`) | ADR-0030                                                                                                       |
| 否定 assert と `toHaveStyle` の書き方                 | ADR-0031                                                                                                       |
| クリックの発火方法                                    | ADR-0015。合成イベントを送る helper は 2026-09-22 の改訂で廃止され、その引数が同期読みだった経路も一緒に消えた |

`getBoundingClientRect` と `getComputedStyle` による実測 (ADR-0013 と `testing.md`「ブラウザテストの CSS とレイアウト実測」) は escape hatch に残す。ただし許すのは読み方ではなく assert である。単一プロパティを文字列リテラルと比べる形は `toHaveStyle` で書けるので、そちらへ移した。残した 3 つの形は ADR-0031 が持つ。

## 検討した選択肢

| 案                                                                             | 評価                                                                                                                             | 採否     |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `expect()` の引数に届く同期読みを lint で報告し、代替 matcher の無い形だけ許す | 禁止したい形が式の構造で表せる。公式が DANGER 表記で同じ向きを案内しており、他エコシステムに先行例がある                         | **採用** |
| レビューで見る (ADR-0013 の現状)                                               | ADR-0013 の 3 日後の PR #16 (`91515ee`) が同じ形を新しく足している。判断を誤ってもほとんどの実行で通るため、レビューでは落ちない | 却下     |
| `element()` を全面禁止し `findElement()` に統一する                            | `getBoundingClientRect` などの実測が待つ理由のない箇所まで `await` になる。ADR-0013 が同じ理由で却下している                     | 却下     |
| `lint.overrides` で未移行ファイルを列挙して段階移行する                        | 対象は 13 ファイルで、列挙と、それを消す作業のほうが移行より大きい                                                               | 却下     |

## 出典

- vitest browser の locator: <https://vitest.dev/guide/browser/locators>
- vitest browser の assertion API: <https://vitest.dev/guide/browser/assertion-api>
- 同梱の `@vitest/browser` 4.1.11 の `context.d.ts` (同期読み 4 メソッドと `findElement` の docstring) と `matchers.d.ts` (`expect.element` が受ける型の docstring)
- 同梱の `node_modules/vite-plus/docs/guide/lint.md`「JS Plugins」
- oxlint の JS plugin 作成ガイド: <https://oxc.rs/docs/guide/usage/linter/writing-js-plugins.html>
- `eslint-plugin-playwright` の `prefer-web-first-assertions`: <https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/prefer-web-first-assertions.md>
