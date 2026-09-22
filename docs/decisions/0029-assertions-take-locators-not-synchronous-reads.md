# ADR-0029: assert には locator を渡し、同期読みは代替 matcher の無い実測に限る

- Status: Accepted
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

`src/components/action/button.test.tsx` の `expect(document.activeElement).toBe(button.element())` は `await button.click()` の直後にあった。ADR-0013 が「操作後の同期読みは更新前の値を拾う」と書いた形そのものである。

**この grep は取りこぼす。** ルールを有効にすると、上の 45 件に加えて 9 件が出た。いずれも同期読みを変数へ束縛してから assert へ渡す形で、1 行の正規表現では束縛と使用が別の行にあるため見えない。`src/components/ui/sidebar.test.tsx` の `expect(trigger.getAttribute("aria-expanded")).toBe("true")` は `userEvent.keyboard("{Enter}")` の直後にあり、retry を持たないまま操作後の属性を読んでいた。件数を数える手段としては lint のほうが正確で、grep は着手前の規模感にしか使えない。

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

#8308 のコメントは回避策として Playwright provider の `actionTimeout` を挙げる。この設定を入れると `expect.poll.timeout` が `expect.element` にも効く。**採る。** 詳細は Consequences の「assert の予算を宣言する」。

ただし予算を下げても「最初から出ない」否定 assert の問題は残る。待って成立しない条件にどんな予算を渡しても無駄に待つからで、区別は呼び出しごとにしか置けない。

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

### assert の予算を宣言する

移行で `expect.element` の肯定 assert が増えた。既定のままだと、赤になった assert 1 件がテストの残り予算を使い切る (2026-09-22 実測で 14942ms)。テンプレートとして配るので、ブラウザテストが増えた先ほど効く。

**assert の予算をテストの予算と分けて宣言する。** `vitest.browser.config.ts` の `expect.poll.timeout` を 5000 にする。

値は Playwright の既定を写す。Playwright は同じ分け方を公式に持ち、「Auto-retrying assertions like `expect(locator).toHaveText()` have a separate timeout, 5 seconds by default. Assertion timeout is unrelated to the test timeout.」と書いて assertion 側の既定を 5000ms と文書化している。vitest の `expect.poll.timeout` はその対応物で、既定は 1000ms である。

このリポジトリのテストへ当てて決めた数字ではない。当てた結果は下表で、5000 は足りている側にある (2026-09-22、全 project 同時実行)。

| `expect.poll.timeout` | 結果                                          |
| --------------------- | --------------------------------------------- |
| 1000 (vitest の既定)  | 12 件が赤                                     |
| 2000                  | 6 件が赤                                      |
| 3000                  | 緑                                            |
| 5000 (採用)           | 緑。肯定 assert の赤は 14942ms から 5038ms へ |

`testTimeout` は動かさない。browser の既定 15000 は vitest 公式が文書化した値で、テストの予算としては妥当である (単独実行の最遅テストは 605ms だが、全 project 同時実行では 3595ms まで伸びる)。締めるべきは assert の予算であって、テストの予算ではない。

どちらの設定も、上流が意図した用途で使っている。

| 設定                                    | 上流の位置づけ                                                                                                                                                                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expect.poll.timeout`                   | `actionTimeout` を作った issue #6983 で、メンテナが `expect.element()` について「which can be already configured by `expect.poll.timeout`」と書いている。`expect.element` の予算を決める口はこれ                                  |
| `browser.providerOptions.actionTimeout` | 同 issue で「CI is quite often slower and locators take more than the default... it would be nice to be able to set larger timeouts at a config level」を動機に要望され、PR #6984 が足した。Playwright の同名オプションに対応する |

2 つを対で置くのは #8308 のためである。`expect.poll.timeout` だけでは `expect.element` に届かず、`actionTimeout` が未設定のときだけ vitest が assert の timeout をタスクの残り予算から計算する。#8308 は OPEN で、閉じる PR は無い (2026-09-22 に `closedByPullRequestsReferences` が空であることを確認)。

`actionTimeout` を置くと Playwright の操作にも上限が付く。これは副作用ではなく利得の側でもある。残り予算からの計算は、action の timeout がテストを跨いで持ち越されるのを止めるために入った (#7871 のメンテナ回答「The actions timeouts are now affected by the test timeout. Previously they would carry over to other tests if the test timed out.」)。その代わりテストの後半ほど予算が縮み、同 issue は `Timeout 581ms exceeded` のような説明のつかない失敗を報告している。固定値を置くとこの縮みが消える。

`testTimeout` の既定値は版で動く。メンテナは #9157 で、docs の数字 (15000) が PR #8705 で意図せず変わった可能性に触れている。このリポジトリの 4.1.11 では 15000 で、肯定 assert の赤 14942ms と整合する (2026-09-22 実測)。版を上げたときは docs の数字を写さず測り直す。

`expectAbsent` の `{ timeout: 0 }` はこの設定と独立に効く (同日実測で 53ms)。呼び出しごとの指定が先に読まれるためで、予算を宣言しても「待たない」は残る。

### 「最初から出ない」判定は `expectAbsent` が 1 箇所で持つ

`{ timeout: 0 }` を渡す薄いヘルパーを `src/test/absent.ts` へ置く。呼び出し側の名前で「待たないつもりである」ことが読めるようにする。`{ timeout: 0 }` を外す退行は `src/test/absent.test.tsx` の所要時間の閾値が捕まえる (外すと同じ assert が 4 秒以上かけて落ちる)。`expect.element(x).not.toBeInTheDocument()` をそのまま書けば消滅待ちで、`expectAbsent(x)` なら不在確認である。

移行時にこの 2 つを取り違えると、消滅待ちを `expectAbsent` にした側だけが flake を作る。誤りの向きが非対称なので、`.not.toBeInTheDocument()` から `expectAbsent` へ移す箇所は 1 件ずつ、直前の操作が要素を消すものかどうかで判定する。

### ADR-0013 を改訂する

Consequences の「lint で表現できる形は無い」を、本 ADR が決めた判定へ差し替える。誤った一文を生きた文書に残すと、次に同じ検討をする人がもう一度同じ結論で止まる。

`.claude/rules/testing.md` には「locator の扱い」の節を足し、上の Decision の表を規範の形で置く。既存の「状態のアサートは semantic matcher を先に探す」「ブラウザテストの CSS とレイアウト実測」と重なる項目は、新しい節へ吸収して重複を残さない。

### ルールが追えない形

判定は 1 ファイルの構文だけで行う。次の 3 つは報告しない。`testing.md` が「件数はこのルールで数える」と書くので、数えた結果がこの範囲を出ないことを併記しておく。

| 形                                  | 例                                                                  | なぜ追えないか                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 束縛を 2 段以上またぐ               | `const el = x.element(); const t = el.textContent; expect(t)...`    | 参照を 1 段だけ辿る。任意段を追うのは taint 解析になる                                         |
| helper の戻り値                     | `expect(titleTextbox(screen).query())` を別ファイルの helper が包む | 関数を跨いだ追跡が要る。先行例 (`eslint-plugin-playwright`) も 1 段の dereference に留めている |
| `expectAbsent` の肯定 anchor の有無 | `await expectAbsent(x)` を単独で置く                                | 「直前に意味のある assert があるか」は構文で決まらない                                         |

最後の 1 つは `src/test/absent.ts` の docstring と `testing.md` が規範として持ち、レビューで見る。呼び出し側の名前 (`expectAbsent`) が「待たない」ことを示すので、anchor の有無は読めば分かる形にしてある。

### 再評価の条件

- #8308 が閉じて `expect.poll.timeout` が単独で `expect.element` へ効くようになったら、`actionTimeout` の指定が要るかを測り直す
- #9751 が timeout の設定を 1 か所へ集約し、`expect.element` の既定を宣言できるようになったら、`expectAbsent` が `{ timeout: 0 }` を持つ必要があるかを測り直す
- `@vitest/eslint-plugin` が同種のルールを持ったら、そちらへ移して自前のルールを消す
- 上流が locator に対応する matcher を足したら、ルールの許可リストからその形を外す。1 要素ずつ外して `vp lint` を走らせ、違反が 0 件のままなら不要と判定する

### 本 ADR が扱わないもの

クリックの発火方法は ADR-0015 が持つ。合成イベントを送る helper は 2026-09-22 の改訂で廃止され、その引数が同期読みだった経路も一緒に消えた。

`getBoundingClientRect` と `getComputedStyle` による実測 (ADR-0013 と `testing.md`「ブラウザテストの CSS とレイアウト実測」) は escape hatch に残す。ただし許すのは読み方ではなく assert である。単一プロパティを文字列リテラルと比べる形は `toHaveStyle` で書けるので、そちらへ移した。

`toHaveStyle` は**文字列形式で書く**。2026-09-22 に失敗時の文言を比べた。

| 書き方                                                   | 失敗時                                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `toHaveStyle("pointer-events: auto")`                    | `- Expected` / `+ Received` の差分が出る                                                      |
| `toHaveStyle({ pointerEvents: "auto" })`                 | `Expected styles could not be parsed by the browser. Did you make a typo?` だけで差分が出ない |
| `expect(getComputedStyle(x).pointerEvents).toBe("auto")` | `expected 'none' to be 'auto'`                                                                |

escape hatch に残るのは、`toHaveStyle` で表せない 3 つの形である。

| 形                 | 例                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------- |
| 2 回の観測を比べる | `src/components/ui/sidebar.test.tsx` の「開く前後で背景色が変わったこと」                   |
| 数値の大小         | `expect(Number(getComputedStyle(off).opacity)).toBeLessThan(...)`                           |
| 擬似要素を読む     | `getComputedStyle(el, "::before").content`。`toHaveStyle` は要素自身しか見ない (同日に実測) |

許可は callee 単位なので、この 3 つより広い。ルールは読みだけを見て assert の形を見ないためで、狭めるには matcher を見る分岐が要る。先行例 (`prefer-web-first-assertions`) は `supportedMatchers` で同じことをしているが、あちらは autofix の可否を決めるためで範囲の限定ではない。1 つの callee のためにその分岐を足すかは、リテラル比較が再び増えたときに判断する。

## 検討した選択肢

| 案                                                                             | 評価                                                                                                                                                                                                  | 採否     |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `expect()` の引数に届く同期読みを lint で報告し、代替 matcher の無い形だけ許す | 禁止したい形が式の構造で表せる。公式が DANGER 表記で同じ向きを案内しており、他エコシステムに先行例がある                                                                                              | **採用** |
| レビューで見る (ADR-0013 の現状)                                               | ADR-0013 の 3 日後の PR #16 (`91515ee`) が同じ形を新しく足している。判断を誤ってもほとんどの実行で通るため、レビューでは落ちない                                                                      | 却下     |
| `element()` を全面禁止し `findElement()` に統一する                            | `getBoundingClientRect` などの実測が待つ理由のない箇所まで `await` になる。ADR-0013 が同じ理由で却下している                                                                                          | 却下     |
| `actionTimeout` を設定して `expect.poll.timeout` を効かせる                    | **採用。** assert の予算をテストの予算から分けられる。値は Playwright が文書化した assertion 側の既定 5000ms を写す。「最初から出ない」否定 assert はこれでも無駄に待つので `expectAbsent` と併用する | **採用** |
| `testTimeout` を短くして赤のコストを抑える                                     | 待つべき assert の予算も一緒に縮む。遅い環境で緑のテストが落ちる                                                                                                                                      | 却下     |
| 否定 assert には触れず、同期読みの移行だけ行う                                 | 移行が 15 秒の赤を持ち込む。移行前の `expect(x.query()).toBeNull()` は同期の 1 回読みで、赤は即座だった                                                                                               | 却下     |
| `lint.overrides` で未移行ファイルを列挙して段階移行する                        | 対象は 13 ファイルで、列挙と、それを消す作業のほうが移行より大きい                                                                                                                                    | 却下     |

## 出典

- vitest browser の locator: <https://vitest.dev/guide/browser/locators>
- vitest browser の assertion API: <https://vitest.dev/guide/browser/assertion-api>
- 同梱の `@vitest/browser` 4.1.11 の `context.d.ts` (同期読み 4 メソッドと `findElement` の docstring) と `matchers.d.ts` (`expect.element` が受ける型と timeout の docstring)
- 同梱の `node_modules/vite-plus/docs/guide/lint.md`「JS Plugins」
- oxlint の JS plugin 作成ガイド: <https://oxc.rs/docs/guide/usage/linter/writing-js-plugins.html>
- `eslint-plugin-playwright` の `prefer-web-first-assertions`: <https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/prefer-web-first-assertions.md>
- vitest-dev/vitest#8308 (OPEN): <https://github.com/vitest-dev/vitest/issues/8308>
- vitest-dev/vitest#9751 (OPEN): <https://github.com/vitest-dev/vitest/issues/9751>
- vitest-dev/vitest#6983 / PR #6984 (`actionTimeout` の導入と、`expect.poll.timeout` が `expect.element` の口だというメンテナ回答): <https://github.com/vitest-dev/vitest/issues/6983>
- vitest-dev/vitest#7871 (action の timeout がテストの残り予算で縮む): <https://github.com/vitest-dev/vitest/issues/7871>
- vitest-dev/vitest#9157 (`testTimeout` の既定が docs と食い違う可能性): <https://github.com/vitest-dev/vitest/issues/9157>
- Playwright の Test timeouts (assertion timeout を test timeout と分ける): <https://playwright.dev/docs/test-timeouts>
