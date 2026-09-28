# テストの注釈

合否に入れないが読ませたい注意を、Vitest の注釈 (`annotate`) で残す作法と、その読み方を持つ。何を注釈にするかは、主題ごとのガイドが持つ (a11y は `docs/guides/accessibility.md`「ブラウザテストの `incomplete` を読む」)。

## how-to

### 注釈を残す

- テストの文脈の `annotate(message, "warning")` で残す。`console.warn` に出さない。`console.warn` は PR の画面に出ない (「`console.warn` ではなく注釈で残す理由」)
- helper から残すときは、テストの文脈 (`it("…", async ({ annotate }) => …)`) から `annotate` を引数で受ける (`src/test/a11y/a11y.ts` の `expectNoA11yViolations`)。`recordArtifact` は使わない (「helper に `annotate` を引数で渡す理由」)
- type は `notice` / `warning` / `error` のどれかにする。ほかの文字列は `github-actions` reporter が `notice` として出し、文字列は注釈の題になる (Vitest docs の Test Annotations「github-actions」: <https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/guide/test-annotations.md>。題の扱いは docs に無く、Vitest 5.0.1 の実装の `getTitle`: <https://github.com/vitest-dev/vitest/blob/v5.0.1/packages/vitest/src/node/reporters/github-actions.ts>)
- Storybook の画面でも動く story の helper は、テストの文脈が無いので `console.warn` で残す (Vitest docs の Test Context「annotate」: <https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/guide/test-context.md>)

### 注釈を読む

reporter が注釈を出すかは、テストの成否で決まる。type では変わらない (Vitest docs の Test Annotations: "The `default` reporter prints annotations only if the test has failed"、"The `verbose` reporter is the only terminal reporter that reports annotations when the test doesn't fail"。<https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/guide/test-annotations.md>)。

| 場面                         | 出るか                                       | 読み方                                                                         |
| ---------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| 手元で、失敗したテストの注釈 | default reporter がエラーの近くに出す        | 普段の `vp test run` で足りる                                                  |
| 手元で、通ったテストの注釈   | default reporter は出さない                  | `--reporter=verbose` を付ける。a11y の注釈は `mise run a11y:incomplete` で読む |
| PR (GitHub Actions) の注釈   | `github-actions` reporter が成否を問わず出す | 該当テストの行に、type のとおりの注釈が付く                                    |

- `github-actions` reporter は、`reporters` を設定していないとき、CI で `GITHUB_ACTIONS` が `true` なら Vitest が自動で足す。`reporters` を書くと既定の組が置き換わり、PR に注釈が出なくなる。足すときは `configDefaults.reporters` を展開する (Vitest docs の Reporters「Default Configuration」: "the configured list replaces the default list"。<https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/guide/reporters.md>)
- `github-actions` reporter に `displayAnnotations: false` を渡すと、注釈を PR に出さなくなる (Vitest docs の Reporters「GitHub Actions Reporter」: <https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/guide/reporters.md>)
- PR に出る注釈は、1 step あたり warning と error がそれぞれ 10 件までで、超えた分は何も知らせずに画面から落ちる (GitHub docs の REST API「Update a check run」の `annotations`: "GitHub Actions are limited to 10 warning annotations and 10 error annotations per step"。<https://docs.github.com/en/rest/checks/runs>、2026-09-29 に確認)。超えていそうなら手元の verbose で読む

### 注釈の位置を読む

注釈の位置 (PR の注釈の `file` / `line`) は、`annotate` を呼んだときの stack のうち、テストファイルの中で最初に現れる行になる (Vitest 5.0.1 の `findTestFileStackTrace`: <https://github.com/vitest-dev/vitest/blob/v5.0.1/packages/vitest/src/runtime/runner/utils/collect.ts>)。

| `annotate` を呼ぶ場所                                   | 位置                                |
| ------------------------------------------------------- | ----------------------------------- |
| テストの本体                                            | その行                              |
| 別ファイルの helper (`src/test/` の helper)             | helper を呼んだテストの行           |
| テストファイルの中の helper を `vi.defineHelper` で包む | helper を呼んだテストの行           |
| テストファイルの中の helper を包まない                  | helper の中で `annotate` を呼んだ行 |

- 4 行とも Vitest 5.0.1 で 2026-09-29 に実測した。docs は位置の決まり方を書いていない。`vi.defineHelper` の docs も assertion の失敗の stack trace にしか触れない (<https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/api/vi.md>)
- `vi.defineHelper` で包んだ helper の行が stack から外れるのは、vitest-dev/vitest の PR 11047 (Vitest 5.0.1 に含まれる。<https://github.com/vitest-dev/vitest/pull/11047>) からである
- テストファイルの行が stack に 1 つも無いと、注釈は位置を持たず、`github-actions` reporter は PR に出さない (<https://github.com/vitest-dev/vitest/blob/v5.0.1/packages/vitest/src/node/reporters/github-actions.ts> の `onTestCaseAnnotate`)。UI と HTML reporter では、位置を持たない注釈はソースの表示に出ず、テストの Report にだけ出る。docs の Test Annotations「html」はソースの表示にしか触れないので、Vitest 5.0.1 の UI の実装で確かめた (ソースの表示: <https://github.com/vitest-dev/vitest/blob/v5.0.1/packages/ui/client/components/views/ViewEditor.vue> の `createAnnotationElement`、Report: <https://github.com/vitest-dev/vitest/blob/v5.0.1/packages/ui/client/components/views/ViewTestReport.vue>)
- Vitest を上げたら位置を確かめ直す。上の 4 通りで `annotate` を呼ぶ使い捨てのテストを置き、`GITHUB_ACTIONS=true vp test run <path>` の `::warning` 行の `line` を見る

## explanation

### `console.warn` ではなく注釈で残す理由

- PR の画面の注釈を作るのは、workflow command の書式 (`::warning file=…::…`) で出した行である (GitHub docs「Workflow commands」の Setting a warning message: "This message will create an annotation"。<https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands>)。`console.warn` の出力はこの書式にならず、CI のログに流れるだけになる。`annotate` は `github-actions` reporter がこの書式に変える
- 注釈は、PR では `github-actions` reporter が該当テストの行に付け、手元では失敗時と verbose のときに reporter が出す。読む経路が reporter にまとまる
- 両方に出すと、verbose で読んだときに同じ注意が 2 回並ぶ

### helper に `annotate` を引数で渡す理由

helper の中から実行中のテストに注釈を付ける手段は、引数で受けた `annotate` のほかに `recordArtifact` がある。`recordArtifact` は使わない。

- experimental の API で、SemVer に沿わない変更がありうる (Vitest docs の Test Artifacts: "`recordArtifact` is an experimental API. Breaking changes might not follow SemVer"。<https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/api/advanced/artifacts.md>)
- 同じ docs は、テストに注意を足すだけなら注釈を使うよう案内する ("Use annotations if you just want to add notes to your tests. Use artifacts if you need custom data.")

## 出典

本文の各項目が引く出典はその項目に添えた。ここには、本文のどの項目にも紐づかないが、調べたときに読んだものを置く。Vitest は 5.0.1 に固定した版を指す。

- `annotate` の実装 (`recordArtifact` を通して位置を決める。位置が `findTestFileStackTrace` で決まる経路): <https://github.com/vitest-dev/vitest/blob/v5.0.1/packages/vitest/src/runtime/runner/context.ts>
- vitest-dev/vitest の PR 7953 (注釈の API の導入と、reporter ごとの出方の設計): <https://github.com/vitest-dev/vitest/pull/7953>
- vitest-dev/vitest の PR 9594 (`vi.defineHelper` の導入。stack の切り詰めを `__VITEST_HELPER__` の目印で行う): <https://github.com/vitest-dev/vitest/pull/9594>
- GitHub community の Discussion 26680 (注釈の件数の上限の報告): <https://github.com/orgs/community/discussions/26680>
