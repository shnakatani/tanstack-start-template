# ADR-0022: story は状態のカタログとし、play は操作で状態が変わる部品にだけ書く

- Status: Accepted
- Date: 2026-09-20
- 関連: ADR-0051 (framework) / ADR-0052 (play の操作とブラウザテストの分担) / ADR-0053 (トークンの story) / ADR-0054 (story の a11y 検査) / ADR-0055 (story の置き場所と対象) / ADR-0014 (Transition) / ADR-0021 (className)

## Context

部品の状態 (variant / tone / disabled) を並べて見る場所が無く、確認手段はアプリの画面を開くことだけだった。

## Decision

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

### 検討した選択肢

| 案                                                       | 評価                                                                                                      | 採否     |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------- |
| play function を全部品に一律書く                         | 公式 (Interaction testing) が一律適用の保守費用を警告しており、`args` で決まる状態の検証とも二重になる    | 却下     |
| 「初期状態では中身が見えない部品」を play の対象軸にする | 公式が「複雑で対話的な部品ならさらに踏み込める」と述べる後段を落とし、公式にない軸を独自に作ってしまう    | 却下     |
| 検証専用 story をサイドバーへ出したまま置く              | 同じ見た目の story が並び、カタログとして読めなくなる (2026-09-20 に 1 部品で実測、9 story 中 4 つが重複) | 却下     |
| 検証専用 story を別ファイルへ分ける                      | story glob と「部品の隣へ置く」規約の両方を変えることになる                                               | 却下     |
| pending の見た目を決着しない action で作る               | 後続 story の Transition を止める (「story に決着しない Promise を置かない」の実測)                       | 却下     |
| `action/` を対象外にする                                 | pending 表現に server function の stub が要るという理由は、実測で成り立たない (2026-09-20)                | 却下     |
| 状態のカタログに徹し、対話的な部品にだけ play を書く     | 外見確認という目的を満たし、検証の二重化も保守費用の増大も避けられる                                      | **採用** |

## Consequences

- 部品の状態を並べて見る場所ができる
- サイドバーに出る story と出ない story ができ、`tags` の付け忘れでカタログが汚れうる。機械検査は置かず、レビューで見る

## 出典

- Storybook: Interaction testing — https://storybook.js.org/docs/writing-tests/interaction-testing
- Storybook: Tags — https://storybook.js.org/docs/writing-stories/tags
