# ADR-0027: a11y の検査は project ではなく tag で分ける

- Status: Accepted
- Date: 2026-09-21
- 関連: ADR-0026 (axe で何を測り何を測らないか) / ADR-0054 (story を検査の単位にする) / ADR-0018 (incomplete に噛まれた事故)

## Context

a11y の検査がブラウザテストの中に混ざっている。呼び出し箇所は次で数え直せる。

```bash
grep -rn "expectNoA11yViolations" src | grep -v src/test/a11y.ts
```

出てくるのは 2 種類で、テスト名からは区別が付かない。

- a11y だけを問う専用のテスト
- 挙動テストの途中に置かれた assert (楽観更新中の行、削除中の行のように、操作の途中にしか無い状態を測るもの)

このため「どれが a11y の問いか」が読めず、a11y だけを走らせる手段も無い。

分けたいものは 1 つではない。分解すると、**プロセスを分ける必要があるのは 1 行だけ**である。

| 分けたいもの                    | 手段           | 追加の描画 |
| ------------------------------- | -------------- | ---------- |
| 関心 (アクセシブルか / 動くか)  | テスト名と tag | 無し       |
| 実行 (a11y だけ走らせる)        | `--tagsFilter` | 無し       |
| runner の設定 (timeout / retry) | tag の定義     | 無し       |
| プロセス                        | project        | **増える** |

## Decision

### 1. tag で分ける

`it(名前, { tags: ["a11y"] }, fn)` を付ける。tag の定義は `vitest.browser.config.ts` の `test.tags`、単独実行は `vp test run --tagsFilter a11y`、除外は `--tagsFilter '!a11y'`。

公式の決定表がこの割り当てを指している。vitest の "When to reach for tags" は、tags を「多数のファイルに散る横断カテゴリ (`flaky` / `slow` / `frontend`)」と「カテゴリ単位の `timeout` / `retry`」に、Test Projects を「ファイルごとに **runner の設定** (isolation / pool / environment) が違うとき」に割り当てている。a11y の検査は runner の設定が挙動テストと同じで、多数のファイルへ散る横断カテゴリに当たる。

`strictTags` は既定で有効なので、定義に無い tag を書いたテストはエラーで落ちる (`vp test --help`、vitest 4.1.11 で確認)。

tag は `it` 単位で付ける。Ultraviolet は `describe` 単位で付けているが、こちらは a11y の `it` が挙動テストと同じ `describe` の中に混在しているので、`describe` では分けられない。

### 2. 専用の project を足さない

project を足すとそのぶん描画が増える。先行例が project を選んだ理由は runner の設定と単独実行で、どちらも tag 側で満たせる。tag の定義は `Omit<TestOptions, "tags" | "shuffle">` を extends しており、定義自体が `timeout` / `retry` を持てる (`@vitest/runner@4.1.11` の `TestTagDefinition`)。

### 3. 挙動テストの途中の状態を測る assert には tag を付けない

その状態は操作の途中にしか無く、専用のテストへ降ろすと操作の再現ぶんが重複する。tag は `it` 単位で、1 つのテストに「a11y の問い」と「挙動の問い」の両方を持たせる表現が無い。

代わりに、その assert の近くへ tag を付けない理由を書く。

## 検討した選択肢

| 案                               | 採否 | 理由                                                                                             |
| -------------------------------- | ---- | ------------------------------------------------------------------------------------------------ |
| **tag で分ける**                 | 採用 | 公式の決定表が横断カテゴリを tags に割り当てている。描画が増えず、tag 定義が runner 設定も持てる |
| 専用の vitest project を足す     | 却下 | runner の設定は挙動テストと同じ。project を足すとそのぶん描画が増える                            |
| 専用のテストファイルへ分ける     | 却下 | 置き場所は「壊れる原因」で決めており (`testing.md`)、a11y は挙動テストと同じ原因で壊れる         |
| 相乗りの assert も降ろして分ける | 却下 | 節 3 のとおり。分離の見返りはラベルだけで、操作の再現が重複する                                  |
| 何もしない                       | 却下 | どれが a11y の問いかが読めず、単独で走らせられない                                               |

## 先行例

先行例は網羅性の検算に使い、決定の根拠は公式の決定表に置く。

| 例                             | 手段                                                | そう分けた理由                                                                                                                |
| ------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Scaleway Ultraviolet (vitest)  | 専用ファイル + `tags: ['a11y']`。project は分けない | 意図で分ける。skill が「そのテストの本当の問いが is this accessible? なら a11y テスト」と定義している                         |
| HMCTS (jest、テンプレート配布) | project (`displayName: 'a11y'`)                     | config のコメントが挙げるのは「単独実行できる名前」「pa11y が fetch を使うので Node environment」「pa11y が遅いので timeout」 |
| alphagov/govuk-frontend (jest) | project (`--selectProjects`)                        | 単独実行したい                                                                                                                |
| mui/material-ui                | 分離 (#47895) を閉じ、畳み込み (#48341) を merge    | 本文に `supersedes #47895`。分離から戻した                                                                                    |

project を選んだ 2 件の理由は、いずれも runner の設定と単独実行に尽きる。どちらも tag 側で満たせる。2026-09-21 の調査では、vitest で a11y を専用 project へ分けている著名な先行例は見つからなかった。

## Consequences

- `--tagsFilter '!a11y'` でも、挙動テストに相乗りしている assert は走る。a11y を完全に外した実行はできない
- tag の定義は browser project にしかない。他の project でも使うなら、その project の `test.tags` へ足す
- story 側の a11y は `addon-a11y` が全 story へ一律に当てるので、tag の対象外 (ADR-0026)
- 相乗りの assert を降ろす判断を後からするなら、共通の setup を helper へ切り出して重複を避ける

## 出典

- tags と Test Projects の使い分け: https://vitest.dev/guide/test-tags
- Test Projects の用途: https://vitest.dev/guide/projects
- 分離を閉じて畳み込みへ戻した PR: https://github.com/mui/material-ui/pull/48341
- jest の project で分けた先行例: https://github.com/alphagov/govuk-frontend/pull/3522
- 同上、分けた理由がコメントに残る例: https://github.com/hmcts/appreg-frontend/blob/master/jest.a11y.config.js
- vitest で tag を使う先行例と、意図で分ける定義: https://github.com/scaleway/ultraviolet/blob/main/.agents/skills/unit-testing/SKILL.md
