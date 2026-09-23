# ADR-0053: story は状態のカタログとし、play は合成イベントで、操作で状態が変わる部品にだけ書く (実イベントの規律はブラウザテスト)

- Status: Accepted
- Date: 2026-09-20
- 関連: ADR-0052 (framework) / ADR-0057 (story の a11y 検査) / ADR-0044 (待機) / ADR-0045 (実イベント) / ADR-0046 (animation) / ADR-0054 (story の置き場所と対象) / ADR-0014 (層) / ADR-0018 (Transition)

## Context

部品の状態 (variant / tone / disabled) を並べて見る場所が無く、確認手段はアプリの画面を開くことだけだった。
play は Storybook の UI 上でも実行されるため CDP を使えない。story と既存のブラウザテストは同じ部品の振る舞いを固定しうる。

## Decision

**story は部品の状態のカタログとし、play は操作で状態が変わる部品にだけ、`storybook/test` の合成イベントで書く。実イベントの規律と play へ移せない検証はブラウザテストに残す。**

### story は状態のカタログとし、対話的な部品には play function を書く

story の基本は部品が取りうる状態を並べることで、振る舞いの検証を目的にしない。対象の判断は次の軸による。

| 部品の性質                                       | play を書くか | 理由                                            |
| ------------------------------------------------ | ------------- | ----------------------------------------------- |
| `args` だけで状態が決まる (寸法・variant・tone)  | 書かない      | story の control で切り替えられ、検証と重複する |
| 操作を受けて状態が変わる (dialog・form・menu 等) | 書く          | 状態遷移そのものが story の対象になる           |

`ui/` の play は「開く」までにする。開いた先の操作 (選択・送信・閉じる) は書かない。registry 部品の振る舞いは上流が持っていて、こちらの story で固定すると上流の更新のたびに落ちる。

対象の層は `ui/` `action/` `parts/` とし、`screens/` は外す (実画面で見るほうが早い)。`action/` の pending 表現に server function の stub は要らない。決着する Promise を渡すだけで pending の描画と解除が成立する (2026-09-20 実測)。

variant の網羅を story の数で表現しない。代表値を story にし、残りは `argTypes` の control で切り替える。

`argTypes` の `options` は `readonly any[]` で、`satisfies Meta<typeof X>` を書いても中身を検査しない。`cva` の variant をリテラルで写すと、足したときに story だけ古くなり lint も型検査も鳴らない (2026-09-20 実測)。`satisfies Record<Variant, null>` のオブジェクトを出処にして `Object.keys` で渡すと、足した側が型エラーになる。

story を variant の直積で増やすと、カタログが読み通せない長さになる。

### 検証専用の story は `tags: ["!dev"]` でサイドバーから外す

story の終了状態が他の story と同じ見た目になるものは検証専用として扱い、`tags: ["!dev"]` を付ける。サイドバーの一覧から消えるが、vitest の project 実行では対象に残る (実測: `index.json` の `tags` が `dev` を含まなくなる)。

同じ見た目でも、別の部品の story なら残す。カタログは部品ごとに引くものなので、その部品の状態が 1 つも並ばない事態を避ける (`ActionButtonShell` の `Idle` は `ActionButton` の `Default` と同じ見た目だが、pending が prop で切り替わることはそちらでしか見えない)。

### story に決着しない Promise を置かない

pending の見た目をカタログに残す目的で、いつまでも解決しない Promise を返す action を書かない。pending を検証する story は決着する Promise を返す action で書く。

Storybook の vitest 実行は 1 つの React root へ story を描き替える。決着しない Transition が残ると後続 story の Transition と干渉し、後続 story が pending のまま止まる (2026-09-20 実測)。

### play へ移した検証はブラウザテストから削る

play で書いた検証は既存のブラウザテストから削る。同じ振る舞いを 2 箇所で固定しない。

対象の全 case が移れば test ファイルごと削る。locator と文言を持つ `*.test-helpers.ts` は残す (`routes/` のテストが同じものを引く)。

移行は story を書く部品に限り、一律移行はしない。ファイルごとに移せるかを実測してから進める。

### play の操作は合成イベントとし、実イベントの規律はブラウザテストが持つ

play は Storybook の UI 上でも実行されるため CDP を使えず、`storybook/test` の合成イベントで操作する。ADR-0045 が定めた実イベントでの発火の規律はブラウザテスト側がそのまま持ち、play へは移さない。

ADR-0045 が禁じた同期 2 連射は play では起きない。`storybook/test` の操作が各手順を await するためである。

どのブラウザテストが持つかを決めておく。story へ移した結果、実イベントの検証がリポジトリから消えることを防ぐ。

| 対象                                                                                   | 実イベントの規律を持つテスト                                                     |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `ActionButton` の二重発火 (`ActionButtonShell` の `disabled={isPending}`)              | `src/components/action/button.test.tsx`                                          |
| `ActionForm` / `ActionFormSubmit` の二重発火 (`ActionForm` の `if (isPending) return`) | `src/components/action/form.test.tsx`                                            |
| `DeleteConfirmDialog` の確定とキャンセルへ実 pointer が届くこと                        | `src/routes/notes/-components/notes-page.test.tsx` の `confirmDelete` (ADR-0045) |
| 画面側の二重確定の dedupe (`queryClient.isMutating`)                                   | `src/routes/notes/-components/notes-page.test.tsx` の Enter 2 連射               |

画面のテストは Action 層の guard を代替しない。`confirmDelete` は `close()` のあと `void runAction(...)` と同期に返るので Transition が即終了し、2 発目の時点で `isPending` は false になる。`disabled={isPending}` を外しても browser project は 1 件も落ちない (2026-09-20 実測)。経路が薄いラッパーを通ることは、その guard を通ることを意味しない。

story を書かない部品のテストは触らない。story を書いた部品でも、移せない case はブラウザテストに残し、残す理由をそのファイルの JSDoc に書く。理由を書かないと、次に読む人が「移し忘れ」と読んで消す。

移せないのはレイアウトと配色の実測 (`getComputedStyle` / `getBoundingClientRect`)、型契約 (`expectTypeOf`)、CDP 経由の実イベントの 3 つである。`src/components/ui/` の既存テスト 26 case のうち 25 case がこれに当たる (2026-09-20 実測)。

この 3 つは play を書く部品の話である。上で play を書かないと決めた部品 (args だけで状態が決まるもの) では、story が描画と axe しか走らせず何も検証しない。構造の契約もブラウザテストに残り、残す根拠は下の役割分担になる。JSDoc にはどちらの根拠で残したかを書く。

popup を閉じる play は、閉じた popup の unmount を待ってから終える。待たないと、play の後に走る a11y 検査が ADR-0046 の扱う animate-out の窓に入る。

待機は `storybook/test` の `waitFor` で書く。ADR-0044 の retry API は play から呼べない。

Storybook の test 実行では ADR-0046 の animation 無効化を適用しない。開閉を待つ story は `findBy` 系の待機だけで足りている。足りなくなったら、`vitest.storybook.config.ts` の `setupFiles` へ入れる。`.storybook/preview.tsx` へ入れると `storybook dev` でも animation が消え、人が見るときの動きまで失う。

### story とブラウザテストの役割分担

| 対象                 | 役割                                                   |
| -------------------- | ------------------------------------------------------ |
| story                | どんな状態があるか。目で見るカタログ                   |
| 既存のブラウザテスト | その状態が壊れていないか。寸法と色を固定する回帰の防止 |

役割が違うため両方残す。ADR-0044 / ADR-0045 / ADR-0046 が固めた待機・実イベント・animation 無効化の規律は既存のテストが持ち続ける。

### 検討した選択肢

| 案                                                                                                         | 評価                                                                                                           | 採否     |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------- |
| play function を全部品に一律書く                                                                           | 公式 (Interaction testing) が一律適用の保守費用を警告しており、`args` で決まる状態の検証とも二重になる         | 却下     |
| 「初期状態では中身が見えない部品」を play の対象軸にする                                                   | 公式が「複雑で対話的な部品ならさらに踏み込める」と述べる後段を落とし、公式にない軸を独自に作ってしまう         | 却下     |
| 検証専用 story をサイドバーへ出したまま置く                                                                | 同じ見た目の story が並び、カタログとして読めなくなる (2026-09-20 に 1 部品で実測、9 story 中 4 つが重複)      | 却下     |
| 検証専用 story を別ファイルへ分ける                                                                        | story glob と「部品の隣へ置く」規約の両方を変えることになる                                                    | 却下     |
| pending の見た目を決着しない action で作る                                                                 | 後続 story の Transition を止める (「story に決着しない Promise を置かない」の実測)                            | 却下     |
| `action/` を対象外にする                                                                                   | pending 表現に server function の stub が要るという理由は、実測で成り立たない (2026-09-20)                     | 却下     |
| 既存のブラウザテストを丸ごと story へ移す                                                                  | portable stories は state 更新を伴う再描画を支援しない。待機・実イベント・animation の規律を移植する動機も無い | 却下     |
| 状態のカタログに徹し、対話的な部品にだけ合成イベントの play を書き、実イベントの規律はブラウザテストに残す | 外見確認という目的を満たし、検証の二重化も保守費用の増大も避けられる。実イベントの検証もリポジトリから消えない | **採用** |

## Consequences

- 部品の状態を並べて見る場所ができる
- サイドバーに出る story と出ない story ができ、`tags` の付け忘れでカタログが汚れうる。機械検査は置かず、レビューで見る
- 検証が一部 CDP の実イベントから合成イベントへ移り、backdrop の遮りを含む pointer の忠実さは下がる。一方イベント間に描画が挟まる点は既存のブラウザテストと同じ性質になる
- `storybook/test` の `expect` は vitest の matcher をすべて持つわけではない。ブラウザテストの assertion を story へ機械的に写せない箇所が出る

## 出典

- Storybook: Interaction testing — https://storybook.js.org/docs/writing-tests/interaction-testing
- Storybook: Tags — https://storybook.js.org/docs/writing-stories/tags
