# ADR-0052: story の a11y は `error` で検査し、テーマごとに project を持つ

- Status: Accepted
- Date: 2026-09-20
- 関連: ADR-0048 (story を状態のカタログにする) / ADR-0049 (story とブラウザテストの役割分担)

## Context

story を書いた部品は、`parameters.a11y.test` の設定しだいで axe の対象になる。

## Decision

### a11y は `error` で自動検査する

`parameters.a11y.test` を `"error"` にする。story を書いた部品は自動で axe の対象になり、検査の範囲が既存より広がる。

違反が出たら抑制せず直す。部品側の欠陥なら部品を直す。story 単位の `parameters.a11y` は global の `"error"` より強いので、書けば黙る。抑制するときは、理由と本体の扱いを決める issue 番号をその場に書く (実例は `table-skeleton.stories.tsx` の `empty-table-header`)。

### テーマごとの project は 2 つ持つが、Storybook 経由の実行では light だけにする

a11y を light と dark の両方へ当てるため、`vitest.storybook.config.ts` の `storybookProject()` を `initialGlobals` のテーマ違いで 2 つ作る。これは `@storybook/addon-vitest` の型が名指しで勧める形で、「define one Vitest project per theme, each with a different value」と書いてある。

**その形のまま Storybook 経由で走らせると起動しない。** addon は `VITEST_STORYBOOK=true` のとき project 名を `storybook:${configDir}` へ強制上書きする (`dist/vitest-plugin/index.js` の `storybook:workspace-name-override`)。同じ `configDir` から 2 つ作れば名前が衝突し、Storybook の test panel も `storybook tools test run` も `Project name ... is not unique` で止まる。上流の storybookjs/storybook#32427 が 2025-09-07 から open で、同じ light / dark 構成の報告が付いている。

`VITEST_STORYBOOK` が真のときだけ light の 1 つに絞る。真偽は addon と同じ読み方をする (`optionalEnvToBoolean` は `"false"` と `"0"` と空文字だけを偽にするので、`=== "true"` で比べると `VITEST_STORYBOOK=1` で addon だけが名前を上書きして衝突が戻る)。判定は `scripts/lib/storybook-env.ts` が持つ。判定の正本は `mise run verify` が回す `vp test run` で、そこは両テーマのまま変わらない。test panel は書いている最中の確認に使うもので、dark を落としても正本は痩せない。

| 経路                                       | テーマ        |
| ------------------------------------------ | ------------- |
| `vp test run` / `mise run verify` / CI     | light と dark |
| Storybook の test panel / `tools test run` | light のみ    |

次の 2 つは採らない。

| 案                                | 採らない理由                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| 2 project を 1 つへ戻す           | addon の型が勧める形を捨てることになり、dark の a11y 検査が正本からも消える           |
| テーマごとに `configDir` を分ける | 上流のバグのために設定ディレクトリを 2 つ持つ。テンプレートとして読む人の負担が増える |

post 順の config フックで名前を戻す手も効かない。addon の上書きは `order: "pre"` で入り、こちらの post 順では戻せなかった (2026-09-21 実測)。同じ手が `cacheDir` には効くので、効かないことは書いておかないと次に触る人が同じ実験をやり直す。

撤去条件は storybookjs/storybook#32427 が閉じること。閉じたら `VITEST_STORYBOOK` の分岐を外し、`VITEST_STORYBOOK=true vp test run` が通ることで確かめる。

### vitest 経由の story には canvas の padding が当たらない

`layout` パラメータを当てるのは `WebView.prepareForStory` で (`storybook/dist/preview/runtime.js` の `applyLayout`)、この経路は Storybook の preview iframe にしかない。vitest から走らせた story には既定の `layout: "padded"` が効かず、canvas の原点へ密着して描かれる。

この差は `.storybook/preview.css` が埋める。Storybook の UI では body へ `sb-main-*` が付くので、付いていないときだけ同じ `1rem` を当てる。decorator の書き方は `docs/guides/storybook.md`「story を書く」にある。

埋めないと、グリフが行ボックスからはみ出す部品 (registry の `leading-none` など) で、そのはみ出しが背景を持つ唯一の箱 (body) の外へ出て axe が色を測れなくなる。`html` は背景を持たないので受け止められない。

## Consequences

- story を書いた部品は axe の検査対象になり、検査範囲が既存のブラウザテストより広がる
- テストの実行対象が増え、`vp test run` に storybook project が加わり CI の実行時間が伸びる

## 出典

- Storybook: Vitest addon — https://storybook.js.org/docs/writing-tests/integrations/vitest-addon
