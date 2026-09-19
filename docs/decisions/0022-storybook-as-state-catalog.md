# ADR-0022: Storybook を状態のカタログとして導入し、対話的な部品には play function を書く

- Status: Accepted
- Date: 2026-09-20
- 関連: ADR-0002 (ツールチェーン) / ADR-0006 (registry 統制、付随ファイルの扱い) / ADR-0013 (待機) / ADR-0014 (Transition) / ADR-0015 (実イベント) / ADR-0018 (animation) / ADR-0020 (層) / ADR-0021 (className)

## Context

部品の状態 (variant / tone / disabled) を並べて見る場所が無く、確認手段はアプリの画面を開くことだけだった。デザイントークンも `src/styles.css` の `@theme` と `:root` が SSOT だが、値を一覧する手段が無く light と dark を並べて比べられなかった。

framework の選定は `tanstackStart()` plugin と Storybook の Vite builder の衝突 (storybookjs/storybook#33747) が決める。標準の Vite builder はこの衝突を自分で回避する必要があり、server function を呼ぶ部品の story を組めない。

本 ADR は 2 つの spec の決定を統合する。

- 2026-09-19 の spec: 導入そのものの決定
- 2026-09-20 の spec: play function の対象を再検討し、前者の「play を書く対象の判断軸」と「`action/` を対象外とする判断」を置き換えた

spec はどちらも当時の記録として凍結する。以後の判断は後者を正とする。

## Decision

### 1. framework は TanStack 専用のものを使う

`tanstackStart()` plugin と衝突しない TanStack 専用 framework を使う。router を memory-backed で自動ラップし、server function を自動 stub する。

自動構成が届かない範囲が 2 つある。

- TanStack Query は対象外。preview の構成へ手動で置く
- server-only 依存は `__mocks__` で遮断する

### 2. story は状態のカタログとし、対話的な部品には play function を書く

story の基本は部品が取りうる状態を並べることで、振る舞いの検証を目的にしない。対象の判断は次の軸による。

| 部品の性質                                       | play を書くか | 理由                                            |
| ------------------------------------------------ | ------------- | ----------------------------------------------- |
| `args` だけで状態が決まる (寸法・variant・tone)  | 書かない      | story の control で切り替えられ、検証と重複する |
| 操作を受けて状態が変わる (dialog・form・menu 等) | 書く          | 状態遷移そのものが story の対象になる           |

対象の層は `ui/` `action/` `parts/` とし、`screens/` は外す (実画面で見るほうが早い)。当初 `action/` も対象外としていたが、pending 表現に server function の stub が要るという当初の理由は誤りで、決着する Promise を渡すだけで pending の描画と解除が成立した (2026-09-20 実測)。

play で書いた検証は既存のブラウザテストから削る。同じ振る舞いを 2 箇所で固定しない。

対象の全 case が移れば test ファイルごと削る。locator と文言を持つ `*.test-helpers.ts` は残す (`routes/` のテストが同じものを引く)。

移行は story を書く部品に限り、一律移行はしない。ファイルごとに移せるかを実測してから進める。

variant の網羅を story の数で表現しない。代表値を story にし、残りは `argTypes` の control で切り替える。

story を variant の直積で増やすと、カタログが読み通せない長さになる。

### 3. 検証専用の story は `tags: ["!dev"]` でサイドバーから外す

story の終了状態が他の story と同じ見た目になるものは検証専用として扱い、`tags: ["!dev"]` を付ける。サイドバーの一覧から消えるが、vitest の project 実行では対象に残る (実測: `index.json` の `tags` が `dev` を含まなくなる)。

### 4. story に決着しない Promise を置かない

pending の見た目をカタログに残す目的で、いつまでも解決しない Promise を返す action を書かない。pending を検証する story は決着する Promise を返す action で書く。

Storybook の vitest 実行は 1 つの React root へ story を描き替える。決着しない Transition が残ると後続 story の Transition と干渉し、後続 story が pending のまま止まる (2026-09-20 実測)。

### 5. play の操作は合成イベントとし、実イベントの規律はブラウザテストが持つ

play は Storybook の UI 上でも実行されるため CDP を使えず、`storybook/test` の合成イベントで操作する。ADR-0015 が定めた実イベントでの発火の規律はブラウザテスト側がそのまま持ち、play へは移さない。

ADR-0015 が禁じた同期 2 連射は play では起きない。`storybook/test` の操作が各手順を await するためである。

popup を閉じる play は、閉じた popup の unmount を待ってから終える。待たないと、play の後に走る a11y 検査が ADR-0018 の扱う animate-out の窓に入る。

待機は `storybook/test` の `waitFor` で書く。ADR-0013 の retry API は play から呼べない。

Storybook の test 実行では ADR-0018 の animation 無効化を適用しない。

### 6. トークンは CSS 変数を実測して描く

`styles.css` を SSOT に保つため、story 側に値を書き写さない。

- 値は `getComputedStyle` で解決後のものを読む
- light と dark は `@storybook/addon-themes` の class 切り替えで出し分ける
- テーマを切り替えたら、読み取りを行う要素を `key` で remount する。値は React の依存に現れないため、再 render だけでは React Compiler がメモ化した結果を返して止まる

### 6-1. コントラストは対で出し、計算はライブラリに任せる

比較の相手を `--background` 一律にしない。`styles.css` の命名が示す前景・背景の対 (`--X-foreground` と `--X`、および `--foreground` と `--background`) だけを並べる。

画面上で重ならない組み合わせの比は、閾値を割ったかどうかの判断に使えない。

axe は描画された実ペアしか見ない。story を持たない部品で使う色はこの検査に出てこないため、トークン側の一覧が要る。

計算は自前で書かず `culori` の `wcagContrast` を使う。同じ入力で 6 案を測った結果は次のとおり (2026-09-20)。

| 案                                     | oklch の対           | 非色トークン | 採否     |
| -------------------------------------- | -------------------- | ------------ | -------- |
| `culori`                               | 5.021                | `undefined`  | **採用** |
| `colorjs.io`                           | 5.022                | throw        | 却下     |
| `chroma-js`                            | 5.014                | throw        | 却下     |
| `colord` + a11y plugin                 | **1.000 (誤値)**     | `false`      | 却下     |
| `color2k`                              | throw (oklch 非対応) | —            | 却下     |
| `@csstools/color-helpers`              | 比の関数のみ         | parser 無し  | 却下     |
| Storybook / Vitest / `axe-core` の API | —                    | —            | 却下     |

決め手は非色トークンの扱いである。この story はトークン一覧から色だけを選り分ける述語が要る。

`culori` は解析できない値に `undefined` を返すのでそのまま述語になるが、throw する案は全件を try/catch で包むことになる。

`colord` は oklch を解析できないまま `1.000` を返す。誤りが warn にも例外にも出ないため採らない。

`axe-core` は実装に `getContrast` を持つが型定義に無く、private API を型アサーションで呼ぶことになる。Tailwind の公開 export に色の解析と比の関数は無い。

Storybook の design token addon は `styles.css` へ注釈コメントを要求し、palette addon は週あたりのダウンロードが 1 桁である。

`wcagContrast` は解析できない値で TypeError を投げる (型は `number` を返すと宣言している)。渡す前に選り分ける。

トークンの一覧を CSSOM から読む選択の帰結として、`styles.css` の `@theme` に `static` を付ける。`static` は公式のノブで `inline` と併用できる。

`inline` は utility へ値を直接埋め込むため、`rounded-4xl` を書いても `var(--radius-4xl)` を読む rule が生まれない。Tailwind は既定で参照されている変数だけを出力するので、実際に使われているトークンが一覧から消える。

`src/components/ui/badge.tsx` の `rounded-4xl` がその例で、`static` なしでは `--radius-4xl` がカタログに出ない。

代償は、未参照の宣言が本番 CSS へ乗ることである。`@theme static inline` から `static` を外して `vp build` を 2 回回せば、出力される変数と CSS のバイト数の差を測れる。

Tailwind は theme の出力を `@layer theme` に置くため、CSSOM の走査は `@layer` を含むグループ規則を再帰的に辿る必要がある。辿らないと `@layer` の中の `:root` を見落とす。

### 7. a11y は `error` で自動検査し、既存のブラウザテストは残す

`parameters.a11y.test` を `"error"` にする。story を書いた部品は自動で axe の対象になり、検査の範囲が既存より広がる。

| 対象                 | 役割                                                   |
| -------------------- | ------------------------------------------------------ |
| story                | どんな状態があるか。目で見るカタログ                   |
| 既存のブラウザテスト | その状態が壊れていないか。寸法と色を固定する回帰の防止 |

役割が違うため両方残す。ADR-0013 / ADR-0015 / ADR-0018 が固めた待機・実イベント・animation 無効化の規律は既存のテストが持ち続ける。

### 8. story はコンポーネントと並べ、registry の baseline から除く

`*.stories.tsx` は部品と同じディレクトリに置く。`src/components/ui/` に置いたものも `*.test.tsx` と同じ「registry 由来でない付随ファイル」として baseline 検査の対象外になる (ADR-0006)。

story は出荷される bundle に入らないため、`no-restricted-imports` の対象からも外す。

### 9. 導入は 3 段階に分け、PR を stack にする

1 度に全部品の story を書かない。段階ごとに PR を分け `gh stack` で積む。

| 段階 | 範囲                                 |
| ---- | ------------------------------------ |
| 1    | 基盤とデザイントークンの story       |
| 2    | 外見を定義する `parts/` と `action/` |
| 3    | `ui/` の主要部品                     |

段階 2 と 3 は、対象の層に story があり a11y 検査が通ることを完了条件とする。

## 検討した選択肢

| 案                                                       | 評価                                                                                                               | 採否     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------- |
| 標準の Vite builder を使う                               | `tanstackStart()` との衝突を自分で回避することになり、server function を呼ぶ部品の story が組めない                | 却下     |
| play function を全部品に一律書く                         | 公式 (Interaction testing) が一律適用の保守費用を警告しており、`args` で決まる状態の検証とも二重になる             | 却下     |
| 「初期状態では中身が見えない部品」を play の対象軸にする | 公式が「複雑で対話的な部品ならさらに踏み込める」と述べる後段を落とし、公式にない軸を独自に作ってしまう             | 却下     |
| 既存のブラウザテストを丸ごと story へ移す                | portable stories は state 更新を伴う再描画を支援しない。待機・実イベント・animation の規律を移植する動機も無い     | 却下     |
| トークンを公式の `ColorPalette` で書く                   | 色値を MDX へ書き写すため `styles.css` と二重管理になる                                                            | 却下     |
| トークンを専用 addon で一覧化する                        | `styles.css` へ注釈コメントを足す必要があり、Storybook 専用の記述が SSOT に混ざる                                  | 却下     |
| コントラスト比を自前で計算する                           | 対応する色空間を実装ごと抱える。`oklch()` を読めない実装になり、変換のためにブラウザの色パーサを借りる連鎖が起きた | 却下     |
| 全トークンを単一の背景と比べる                           | 画面上で重ならない組み合わせの比が並び、閾値を割ったかどうかの判断に使えない                                       | 却下     |
| 検証専用 story をサイドバーへ出したまま置く              | 同じ見た目の story が並び、カタログとして読めなくなる (2026-09-20 に 1 部品で実測、9 story 中 4 つが重複)          | 却下     |
| 検証専用 story を別ファイルへ分ける                      | story glob と「部品の隣へ置く」規約の両方を変えることになる                                                        | 却下     |
| pending の見た目を決着しない action で作る               | 後続 story の Transition を止める (節 4 の実測)                                                                    | 却下     |
| `action/` を当初どおり対象外に保つ                       | pending 表現に server function の stub が要るという理由が実測で誤りと判明した                                      | 却下     |
| 状態のカタログに徹し、対話的な部品にだけ play を書く     | 外見確認という目的を満たし、検証の二重化も保守費用の増大も避けられる                                               | **採用** |

## Consequences

- 部品の状態を並べて見る場所ができ、トークンの一覧も `styles.css` から自動で出る
- story を書いた部品は axe の検査対象になり、検査範囲が既存のブラウザテストより広がる
- テストの実行対象が増え、`vp test run` に storybook project が加わり CI の実行時間が伸びる
- `.stories.tsx` を registry のディレクトリに置くため、ADR-0006 の baseline 検査に除外が 1 種類増える
- Storybook の静的ビルドは検証しない (storybookjs/storybook#33747 が未解決)
- 検証が一部 CDP の実イベントから合成イベントへ移り、backdrop の遮りを含む pointer の忠実さは下がる。一方イベント間に描画が挟まる点は既存のブラウザテストと同じ性質になる
- サイドバーに出る story と出ない story ができ、`tags` の付け忘れでカタログが汚れうる。機械検査は置かず、レビューで見る
- 移行のたびに「移せない case」が出る可能性が残り、段階 2 と 3 の各ファイルで実測が要る
- `storybook/test` の `expect` は vitest の matcher をすべて持つわけではない。ブラウザテストの assertion を story へ機械的に写せない箇所が出る

## 出典

- Storybook: TanStack framework — https://storybook.js.org/docs/get-started/frameworks/tanstack-react
- Storybook: Vitest addon — https://storybook.js.org/docs/writing-tests/integrations/vitest-addon
- Storybook: Interaction testing — https://storybook.js.org/docs/writing-tests/interaction-testing
- Storybook: Themes addon — https://storybook.js.org/docs/essentials/themes
- Storybook: Tags — https://storybook.js.org/docs/writing-stories/tags
- Tailwind CSS: Theme variables (Generating all CSS variables) — https://tailwindcss.com/docs/theme
- storybookjs/storybook#33747 (Vite builder と tanstack start plugin の衝突)
