# テストの注釈

合否に入れないが読ませたい注意を、Vitest の注釈 (`annotate`) で残す作法と、その読み方を持つ。何を注釈にするかは、主題ごとのガイドが持つ (a11y は `docs/guides/accessibility.md`「ブラウザテストの `incomplete` を読む」)。

## how-to

### 注釈を残す

- テストの文脈の `annotate(message, "warning")` で残す。`console.warn` に出さない。`console.warn` は PR の画面に出ない (「`console.warn` ではなく注釈で残す理由」)
- helper から残すときは、テストの文脈 (`it("…", async (context) => …)`) を引数で受け、文脈の `annotate` で残す (`src/test/a11y/a11y.ts` の `expectNoA11yViolations`)。理由は「helper にテストの文脈を渡す理由」
- type は `notice` / `warning` / `error` のどれかにする。ほかの文字列は `github-actions` reporter が `notice` として出す ([Vitest docs「Test Annotations」][] の github-actions)
- ほかの文字列は、PR の注釈の題になる。docs には無く、[Vitest の `github-actions.ts`][] の `getTitle` が決める
- Storybook の画面でも動く story の helper は、テストの文脈が無いので `console.warn` で残す ([Vitest docs「Test Context」][] の annotate)

### 注釈を読む

reporter が注釈を出すかは、テストの成否で決まる。type では変わらない。

根拠は [Vitest docs「Test Annotations」][] の "The `default` reporter prints annotations only if the test has failed" と "The `verbose` reporter is the only terminal reporter that reports annotations when the test doesn't fail" である。

| 場面                         | 出るか                                       | 読み方                                                                         |
| ---------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| 手元で、失敗したテストの注釈 | default reporter がエラーの近くに出す        | 普段の `vp test run` で足りる                                                  |
| 手元で、通ったテストの注釈   | default reporter は出さない                  | `--reporter=verbose` を付ける。a11y の注釈は `mise run a11y:incomplete` で読む |
| PR (GitHub Actions) の注釈   | `github-actions` reporter が成否を問わず出す | 該当テストの行に、type のとおりの注釈が付く                                    |

- `github-actions` reporter は、`reporters` を設定していなければ、CI (`GITHUB_ACTIONS` が `true`) で Vitest が自動で足す ([Vitest docs「Reporters」][] の Default Configuration)
- `reporters` を書くと既定の組が置き換わり、PR に注釈が出なくなる。足すときは `configDefaults.reporters` を展開する ([Vitest docs「Reporters」][] の Default Configuration: "the configured list replaces the default list")
- `github-actions` reporter に `displayAnnotations: false` を渡すと、注釈を PR に出さなくなる ([Vitest docs「Reporters」][] の GitHub Actions Reporter)
- PR に出る注釈は、1 step あたり warning と error がそれぞれ 10 件までである ([GitHub docs「REST API endpoints for check runs」][] の Update a check run: "limited to 10 warning annotations and 10 error annotations per step"。2026-09-29 に確認)
- 上限を超えた分の扱いは GitHub docs に書かれていない。超えていそうなら手元の verbose で読む

### 注釈の位置を読む

注釈の位置 (PR の注釈の `file` / `line`) は、`annotate` を呼んだときの stack のうち、テストファイルの中で最初に現れる行になる ([Vitest の `collect.ts`][] の `findTestFileStackTrace`)。

| `annotate` を呼ぶ場所                                   | 位置                                |
| ------------------------------------------------------- | ----------------------------------- |
| テストの本体                                            | その行                              |
| 別ファイルの helper (`src/test/` の helper)             | helper を呼んだテストの行           |
| テストファイルの中の helper を `vi.defineHelper` で包む | helper を呼んだテストの行           |
| テストファイルの中の helper を包まない                  | helper の中で `annotate` を呼んだ行 |

- 4 行とも Vitest 5.0.1 で 2026-09-29 に実測した。docs は位置の決まり方を書いていない。[Vitest docs「Vi」][] の vi.defineHelper も assertion の失敗の stack trace にしか触れない
- `vi.defineHelper` で包んだ helper の行が stack から外れるのは、[vitest-dev/vitest#11047][] (Vitest 5.0.1 に含まれる) からである
- テストファイルの行が stack に 1 つも無いと、注釈は位置を持たず、`github-actions` reporter は PR に出さない ([Vitest の `github-actions.ts`][] の `onTestCaseAnnotate`)
- UI と HTML reporter では、位置を持たない注釈はソースの表示に出ず、Report にだけ出る ([Vitest の `ViewEditor.vue`][] の `createAnnotationElement`、[Vitest の `ViewTestReport.vue`][])
- [Vitest docs「Test Annotations」][] の html は、テストファイルの外で呼んだ注釈は UI で見えないと書く。5.0.1 の実装は Report に全部並べるので、docs が実装より古い
- Vitest を上げたら位置を確かめ直す。上の 4 通りで `annotate` を呼ぶ使い捨てのテストを置き、`GITHUB_ACTIONS=true vp test run <path>` の `::warning` 行の `line` を見る

## explanation

### `console.warn` ではなく注釈で残す理由

- PR の画面の注釈を作るのは、workflow command の書式 (`::warning file=…::…`) で出した行である ([GitHub docs「Workflow commands」][] の Setting a warning message: "This message will create an annotation")
- `console.warn` の出力はこの書式にならず、CI のログに流れるだけになる。`annotate` は `github-actions` reporter がこの書式に変える
- 注釈は、PR では `github-actions` reporter が該当テストの行に付け、手元では失敗時と verbose のときに reporter が出す。読む経路が reporter にまとまる
- 両方に出すと、verbose で読んだときに同じ注意が 2 回並ぶ

### helper にテストの文脈を渡す理由

helper の中から実行中のテストを扱う手段は、引数で受けたテストの文脈のほかに `recordArtifact` と `TestRunner.getCurrentTest()` がある。どちらも使わない。

`TestRunner.getCurrentTest()` を使わない理由:

- 実行中のテストを 1 つのグローバルで持つので、並行で走るテストでは別のテストを指す。2026-09-29 に Vitest 5.0.1 で、`describe.concurrent` の中で隣のテストの tag を読むことを実測した (`src/test/a11y/a11y.test.tsx` の「並行で走るテスト」)
- docs も、グローバルな `expect` は並行テストを追えないので文脈の `expect` を使うよう書く ([Vitest docs「Test Context」][] の expect)

`recordArtifact` を使わない理由:

- experimental の API で、SemVer に沿わない変更がありうる ([Vitest docs「Test Artifacts」][]: "`recordArtifact` is an experimental API. Breaking changes might not follow SemVer")
- [Vitest docs「Test Artifacts」][] は、テストに注意を足すだけなら注釈を使うよう案内する ("Use annotations if you just want to add notes to your tests. Use artifacts if you need custom data.")

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。Vitest は 5.0.1 に固定した版を指す。

本文は引かないが、調べたときに読んだもの:

- [Vitest の `context.ts`][] (`annotate` の実装。`recordArtifact` を通し、位置が `findTestFileStackTrace` で決まる経路)
- [vitest-dev/vitest#7953][] (注釈の API の導入と、reporter ごとの出方の設計)
- [vitest-dev/vitest#9594][] (`vi.defineHelper` の導入。stack の切り詰めを `__VITEST_HELPER__` の目印で行う)
- [community/community#26680][] (注釈の件数の上限の報告)

[Vitest docs「Test Annotations」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/guide/test-annotations.md
[Vitest の `github-actions.ts`]: https://github.com/vitest-dev/vitest/blob/v5.0.1/packages/vitest/src/node/reporters/github-actions.ts
[Vitest docs「Test Context」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/guide/test-context.md
[Vitest docs「Reporters」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/guide/reporters.md
[GitHub docs「REST API endpoints for check runs」]: https://docs.github.com/en/rest/checks/runs
[Vitest の `collect.ts`]: https://github.com/vitest-dev/vitest/blob/v5.0.1/packages/vitest/src/runtime/runner/utils/collect.ts
[Vitest docs「Vi」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/api/vi.md
[vitest-dev/vitest#11047]: https://github.com/vitest-dev/vitest/pull/11047
[Vitest の `ViewEditor.vue`]: https://github.com/vitest-dev/vitest/blob/v5.0.1/packages/ui/client/components/views/ViewEditor.vue
[Vitest の `ViewTestReport.vue`]: https://github.com/vitest-dev/vitest/blob/v5.0.1/packages/ui/client/components/views/ViewTestReport.vue
[GitHub docs「Workflow commands」]: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands
[Vitest docs「Test Artifacts」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/api/advanced/artifacts.md
[Vitest の `context.ts`]: https://github.com/vitest-dev/vitest/blob/v5.0.1/packages/vitest/src/runtime/runner/context.ts
[vitest-dev/vitest#7953]: https://github.com/vitest-dev/vitest/pull/7953
[vitest-dev/vitest#9594]: https://github.com/vitest-dev/vitest/pull/9594
[community/community#26680]: https://github.com/orgs/community/discussions/26680
