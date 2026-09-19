# ADR-0022: Storybook を状態のカタログとして導入し、対話的な部品には play function を書く

- Status: Accepted
- Date: 2026-09-20
- 関連: ADR-0002 (ツールチェーン) / ADR-0006 (registry 統制、付随ファイルの扱い) / ADR-0013 (待機) / ADR-0014 (Transition) / ADR-0015 (実イベント) / ADR-0018 (animation) / ADR-0020 (層) / ADR-0021 (className)

## Context

部品の状態 (variant / tone / disabled) を並べて見る場所が無く、確認手段はアプリの画面を開くことだけだった。デザイントークンも `src/styles.css` の `@theme` と `:root` が SSOT だが、値を一覧する手段が無く light と dark を並べて比べられなかった。

framework の選定は `tanstackStart()` plugin と Storybook の Vite builder の衝突 (storybookjs/storybook#33747) が決める。標準の Vite builder はこの衝突を自分で回避する必要があり、server function を呼ぶ部品の story を組めない。

本 ADR は導入時 (2026-09-19) の spec と、play function の対象を再検討した spec (2026-09-20) の両方の決定を統合する。後者は前者の「play を書く対象の判断軸」と「`action/` を対象外とする判断」を置き換えた。前者は当時の決定の記録として凍結し、以後の判断は後者を正とする。

## Decision

### 1. framework は TanStack 専用のものを使う

`tanstackStart()` plugin と衝突しない TanStack 専用 framework を使う。router を memory-backed で自動ラップし、server function を自動 stub する。TanStack Query は自動構成の対象外で、preview の構成に手動で置く。

### 2. story は状態のカタログとし、対話的な部品には play function を書く

story の基本は部品が取りうる状態を並べることで、振る舞いの検証を目的にしない。対象の判断は次の軸による。

| 部品の性質                                       | play を書くか | 理由                                            |
| ------------------------------------------------ | ------------- | ----------------------------------------------- |
| `args` だけで状態が決まる (寸法・variant・tone)  | 書かない      | story の control で切り替えられ、検証と重複する |
| 操作を受けて状態が変わる (dialog・form・menu 等) | 書く          | 状態遷移そのものが story の対象になる           |

対象の層は `ui/` `action/` `parts/` とし、`screens/` は外す (実画面で見るほうが早い)。当初 `action/` も対象外としていたが、pending 表現に server function の stub が要るという当初の理由は誤りで、決着する Promise を渡すだけで pending の描画と解除が成立した (2026-09-20 実測)。

play で書いた検証は既存のブラウザテストから削る。同じ振る舞いを 2 箇所で固定しない。対象の全 case が移れば test ファイルごと削るが、locator と文言を持つ `*.test-helpers.ts` は削らない (`routes/` のテストが同じものを引く)。

移行は story を書く部品に限り、一律移行はしない。ファイルごとに移せるかを実測してから進める。

### 3. 検証専用の story は `tags: ["!dev"]` でサイドバーから外す

story の終了状態が他の story と同じ見た目になるものは検証専用として扱い、`tags: ["!dev"]` を付ける。サイドバーの一覧から消えるが、vitest の project 実行では対象に残る (実測: `index.json` の `tags` が `dev` を含まなくなる)。

### 4. story に決着しない Promise を置かない

pending の見た目をカタログに残す目的で、いつまでも解決しない Promise を返す action を書かない。Storybook の vitest 実行は 1 つの React root へ story を描き替えるため、決着しない Transition が後続 story の Transition と干渉し、後続 story が pending のまま止まる (2026-09-20 実測)。pending を検証する story は決着する Promise を返す action で書く。

### 5. play の操作は合成イベントとし、実イベントの規律はブラウザテストが持つ

play は Storybook の UI 上でも実行されるため CDP を使えず、`storybook/test` の合成イベントで操作する。ADR-0015 が定めた実イベントでの発火の規律はブラウザテスト側がそのまま持ち、play へは移さない。ADR-0015 が禁じた同期 2 連射は、`storybook/test` の操作が各手順を await するため起きない。

popup を閉じる play は、ADR-0013 の retry API ではなく `storybook/test` の `waitFor` で、閉じた popup の unmount を待ってから終える。a11y 検査は play の後に走るため、待たないと ADR-0018 が扱う animate-out の窓に入る。Storybook の test 実行では ADR-0018 の animation 無効化を適用しない。

### 6. トークンは CSS 変数を実測して描く

`styles.css` を SSOT に保つため、story 側に値を書き写さない。`getComputedStyle` で解決後の値を読んで一覧を組み立て、light と dark の切り替えは `@storybook/addon-themes` の class 切り替えで行う。コントラスト比を併記し、計算は `src/lib/` の純粋関数へ切り出して境界条件のテストを同時に書く。

トークンの一覧を CSSOM から読む選択の帰結として、`styles.css` の `@theme` に `static` を付ける。Tailwind は既定で「utility から参照されている変数」だけを出力するため、定義したのに未使用のトークンが一覧から消える。`static` は公式のノブで `inline` と併用できる。2026-09-20 の実測では、`@theme static inline` にした結果 `--font-heading` / `--radius-sm` / `--radius-lg` / `--radius-xl` の 4 件が新たに出力されるようになり、生成される CSS は 160552 バイトから 162430 バイトへ増えた。

Tailwind は theme の出力を `@layer theme` に置くため、CSSOM の走査は `@layer` を含むグループ規則を再帰的に辿る必要がある。辿らないと `@layer` の中の `:root` を見落とす。

### 7. a11y は `error` で自動検査し、既存のブラウザテストは残す

`parameters.a11y.test` を `"error"` にする。story を書いた部品は自動で axe の対象になり、検査の範囲が既存より広がる。

| 対象                 | 役割                                                   |
| -------------------- | ------------------------------------------------------ |
| story                | どんな状態があるか。目で見るカタログ                   |
| 既存のブラウザテスト | その状態が壊れていないか。寸法と色を固定する回帰の防止 |

役割が違うため両方残す。ADR-0013 / ADR-0015 / ADR-0018 が固めた待機・実イベント・animation 無効化の規律は既存のテストが持ち続ける。

### 8. story はコンポーネントと並べ、registry の baseline から除く

`*.stories.tsx` は部品と同じディレクトリに置く。`src/components/ui/` に置いたものも `*.test.tsx` と同じ「registry 由来でない付随ファイル」として baseline 検査の対象外になる (ADR-0006)。story は出荷される bundle に入らないため、`no-restricted-imports` の対象からも外す。

### 9. 導入は 3 段階に分け、PR を stack にする

1 度に全部品の story を書かない。段階ごとに PR を分け `gh stack` で積む。1 段目は基盤と Storybook 自体の story、2 段目は外見を定義する `parts/`、3 段目は `ui/` の主要部品とする。段階 2 と 3 は、対象の層に story があり a11y 検査が通ることを完了条件とする。

## 検討した選択肢

| 案                                                       | 評価                                                                                                           | 採否     |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------- |
| 標準の Vite builder を使う                               | `tanstackStart()` との衝突を自分で回避することになり、server function を呼ぶ部品の story が組めない            | 却下     |
| play function を全部品に一律書く                         | 公式 (Interaction testing) が一律適用の保守費用を警告しており、`args` で決まる状態の検証とも二重になる         | 却下     |
| 「初期状態では中身が見えない部品」を play の対象軸にする | 公式が「複雑で対話的な部品ならさらに踏み込める」と述べる後段を落とし、公式にない軸を独自に作ってしまう         | 却下     |
| 既存のブラウザテストを丸ごと story へ移す                | portable stories は state 更新を伴う再描画を支援しない。待機・実イベント・animation の規律を移植する動機も無い | 却下     |
| トークンを公式の `ColorPalette` で書く                   | 色値を MDX へ書き写すため `styles.css` と二重管理になる                                                        | 却下     |
| 検証専用 story をサイドバーへ出したまま置く              | 同じ見た目の story が並び、カタログとして読めなくなる (実測: 9 story 中 4 つが重複)                            | 却下     |
| 検証専用 story を別ファイルへ分ける                      | story glob と「部品の隣へ置く」規約の両方を変えることになる                                                    | 却下     |
| pending の見た目を決着しない action で作る               | 後続 story の Transition を止める (節 4 の実測)                                                                | 却下     |
| `action/` を当初どおり対象外に保つ                       | pending 表現に server function の stub が要るという理由が実測で誤りと判明した                                  | 却下     |
| 状態のカタログに徹し、対話的な部品にだけ play を書く     | 外見確認という目的を満たし、検証の二重化も保守費用の増大も避けられる                                           | **採用** |

## Consequences

- 部品の状態を並べて見る場所ができ、トークンの一覧も `styles.css` から自動で出る
- story を書いた部品は axe の検査対象になり、検査範囲が既存のブラウザテストより広がる
- テストの実行対象が増え、`vp test run` に storybook project が加わり CI の実行時間が伸びる
- `.stories.tsx` を registry のディレクトリに置くため、ADR-0006 の baseline 検査に除外が 1 種類増える
- Storybook の静的ビルドは検証しない (storybookjs/storybook#33747 が未解決)
- 検証が一部 CDP の実イベントから合成イベントへ移り、backdrop の遮りを含む pointer の忠実さは下がる。一方イベント間に描画が挟まる点は既存のブラウザテストと同じ性質になる
- サイドバーに出る story と出ない story ができ、`tags` の付け忘れでカタログが汚れうる。機械検査は置かず、レビューで見る
- 移行のたびに「移せない case」が出る可能性が残り、段階 2 と 3 の各ファイルで実測が要る

CSSOM の走査件数は次のとおり (2026-09-20 実測)。

| 集計                                                                                                      | 件数   |
| --------------------------------------------------------------------------------------------------------- | ------ |
| `@layer` を再帰しない場合                                                                                 | 34 件  |
| `@layer` を再帰し `@theme static inline` を適用した場合                                                   | 109 件 |
| うち denylist (`--radius` / `--font` を除く) 方式で紛れ込む非色トークン                                   | 27 件  |
| `isColor()` で色トークンだけに絞った件数                                                                  | 68 件  |
| `--color-X` の別名を落とした Colors の件数 (`--color-black` / `--color-white` は生トークンが無いため残る) | 35 件  |

## 出典

- Storybook: TanStack framework — https://storybook.js.org/docs/get-started/frameworks/tanstack-react
- Storybook: Vitest addon — https://storybook.js.org/docs/writing-tests/integrations/vitest-addon
- Storybook: Interaction testing — https://storybook.js.org/docs/writing-tests/interaction-testing
- Storybook: Themes addon — https://storybook.js.org/docs/essentials/themes
- Storybook: Tags — https://storybook.js.org/docs/writing-stories/tags
- Tailwind CSS: Theme variables (Generating all CSS variables) — https://tailwindcss.com/docs/theme
- storybookjs/storybook#33747 (Vite builder と tanstack start plugin の衝突)
