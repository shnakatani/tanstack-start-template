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

`ui/` の play は「開く」までにする。開いた先の操作 (選択・送信・閉じる) は書かない。registry 部品の振る舞いは上流が持っていて、こちらの story で固定すると上流の更新のたびに落ちる。

対象の層は `ui/` `action/` `parts/` とし、`screens/` は外す (実画面で見るほうが早い)。当初 `action/` も対象外としていたが、pending 表現に server function の stub が要るという当初の理由は誤りで、決着する Promise を渡すだけで pending の描画と解除が成立した (2026-09-20 実測)。

play で書いた検証は既存のブラウザテストから削る。同じ振る舞いを 2 箇所で固定しない。

対象の全 case が移れば test ファイルごと削る。locator と文言を持つ `*.test-helpers.ts` は残す (`routes/` のテストが同じものを引く)。

移行は story を書く部品に限り、一律移行はしない。ファイルごとに移せるかを実測してから進める。

variant の網羅を story の数で表現しない。代表値を story にし、残りは `argTypes` の control で切り替える。

`argTypes` の `options` は `readonly any[]` で、`satisfies Meta<typeof X>` を書いても中身を検査しない。`cva` の variant をリテラルで写すと、足したときに story だけ古くなり lint も型検査も鳴らない (2026-09-20 実測)。`satisfies Record<Variant, null>` のオブジェクトを出処にして `Object.keys` で渡すと、足した側が型エラーになる。

story を variant の直積で増やすと、カタログが読み通せない長さになる。

### 3. 検証専用の story は `tags: ["!dev"]` でサイドバーから外す

story の終了状態が他の story と同じ見た目になるものは検証専用として扱い、`tags: ["!dev"]` を付ける。サイドバーの一覧から消えるが、vitest の project 実行では対象に残る (実測: `index.json` の `tags` が `dev` を含まなくなる)。

同じ見た目でも、別の部品の story なら残す。カタログは部品ごとに引くものなので、その部品の状態が 1 つも並ばない事態を避ける (`ActionButtonShell` の `Idle` は `ActionButton` の `Default` と同じ見た目だが、pending が prop で切り替わることはそちらでしか見えない)。

### 4. story に決着しない Promise を置かない

pending の見た目をカタログに残す目的で、いつまでも解決しない Promise を返す action を書かない。pending を検証する story は決着する Promise を返す action で書く。

Storybook の vitest 実行は 1 つの React root へ story を描き替える。決着しない Transition が残ると後続 story の Transition と干渉し、後続 story が pending のまま止まる (2026-09-20 実測)。

### 5. play の操作は合成イベントとし、実イベントの規律はブラウザテストが持つ

play は Storybook の UI 上でも実行されるため CDP を使えず、`storybook/test` の合成イベントで操作する。ADR-0015 が定めた実イベントでの発火の規律はブラウザテスト側がそのまま持ち、play へは移さない。

ADR-0015 が禁じた同期 2 連射は play では起きない。`storybook/test` の操作が各手順を await するためである。

どのブラウザテストが持つかを決めておく。story へ移した結果、実イベントの検証がリポジトリから消えることを防ぐ。

| 対象                                                                                     | 実イベントの規律を持つテスト                               |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `ActionButton` の二重発火 (`ActionButtonShell` の `disabled={isPending}`)                | `src/components/action/button.test.tsx`                    |
| `ActionForm` / `ActionFormSubmit` の二重発火 (`ActionForm` の `if (isPending) return`)   | `src/components/action/form.test.tsx`                      |
| `DeleteConfirmDialog` の確定とキャンセルへ inert バックドロップ越しに pointer が届くこと | `src/routes/notes/index.test.tsx` の `dispatchNativeClick` |
| 画面側の二重確定の dedupe (`queryClient.isMutating`)                                     | `src/routes/notes/index.test.tsx` の Enter 2 連射          |

画面のテストは Action 層の guard を代替しない。`confirmDelete` は `close()` のあと `void runAction(...)` と同期に返るので Transition が即終了し、2 発目の時点で `isPending` は false になる。`disabled={isPending}` を外しても browser project は 1 件も落ちない (2026-09-20 実測)。経路が薄いラッパーを通ることは、その guard を通ることを意味しない。

story を書かない部品のテストは触らない。story を書いた部品でも、移せない case はブラウザテストに残し、残す理由をそのファイルの JSDoc に書く。理由を書かないと、次に読む人が「移し忘れ」と読んで消す。

移せないのはレイアウトと配色の実測 (`getComputedStyle` / `getBoundingClientRect`)、型契約 (`expectTypeOf`)、CDP 経由の実イベントの 3 つである。`src/components/ui/` の既存テスト 26 case のうち 25 case がこれに当たる (2026-09-20 実測)。

この 3 つは play を書く部品の話である。節 2 で play を書かないと決めた部品 (args だけで状態が決まるもの) では、story が描画と axe しか走らせず何も検証しない。構造の契約もブラウザテストに残り、残す根拠は節 7 の役割分担になる。JSDoc にはどちらの根拠で残したかを書く。

popup を閉じる play は、閉じた popup の unmount を待ってから終える。待たないと、play の後に走る a11y 検査が ADR-0018 の扱う animate-out の窓に入る。

待機は `storybook/test` の `waitFor` で書く。ADR-0013 の retry API は play から呼べない。

Storybook の test 実行では ADR-0018 の animation 無効化を適用しない。開閉を待つ story は `findBy` 系の待機だけで足りている。足りなくなったら、`vitest.storybook.config.ts` の `setupFiles` へ入れる。`.storybook/preview.tsx` へ入れると `storybook dev` でも animation が消え、人が見るときの動きまで失う。

### 6. トークンは CSS 変数を実測して描く

`styles.css` を SSOT に保つため、story 側に値を書き写さない。

- 値は `getComputedStyle` で解決後のものを読む
- light と dark は `@storybook/addon-themes` の class 切り替えで出し分ける
- テーマごとの読み取り結果を外部ストアにし、`useSyncExternalStore` で購読する。値は React の依存に現れないため、再 render だけでは React Compiler がメモ化した結果を返して止まる
- `key` による remount は採らない。テーマの class は `STORY_RENDERED` 後に当たるため、remount は play function より後に起き、play が作った状態を捨てる (2026-09-20 実測)

### 6-1. コントラストの検算はこの story で扱わない

トークンの値を変えた人が閾値を割っていないか確かめる仕組みは要るが、この story では扱わない。2026-09-20 に 2 つの形を試して、どちらも目的を果たさなかった。

| 試した形                                     | なぜ外したか                                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 全トークンを `--background` と比べる         | 画面上で重ならない組み合わせの比が並ぶ。閾値を割ったかどうかの判断に使えない                       |
| 命名から対を導く (`--X-foreground` と `--X`) | 命名は「画面で重なること」の代理にならない。使われていない対で不合格を出し、実在の対を出さなかった |

JS で比を計算する形そのものにも無理がある。ブラウザは sRGB 外の `oklch()` を clip し、alpha を持つ背景は下地と合成する。描画されていない値を計算しても実際の見え方と一致しない。

実際に重なる組み合わせを実テキストとして描けば、`parameters.a11y.test` の axe がそのまま判定する。新しい依存は要らず、gamut も alpha も正確になる。この形で試したところ、当時の `--destructive: oklch(0.53 0.245 27.325)` (上流の既定値でも ADR-0024 移行後の値でもない、2026-09-20 時点でこのリポジトリが持っていた値) における `bg-destructive/20` と `text-destructive` が 3.74:1 で不合格になった。破壊ボタンの hover の実在の組み合わせである。

この形を採り、実在の対を描く story を `src/components/contrast.stories.tsx` に置いた。トークンの値をどう決めるか、および axe がルールを持たない非テキストの 3:1 (WCAG 1.4.11) をどう扱うかは ADR-0024 が引き取った。

トークンの一覧を CSSOM から読む選択の帰結として、`static` が要る。`inline` は utility へ値を直接埋め込むため、`rounded-*` の utility を書いても対応する変数を読む rule が生まれない。Tailwind は既定で参照されている変数だけを出力するので、実際に使っているトークンでもカタログから消える。

どの変数が落ちるかは Tailwind の source scan の結果で決まる。**scan は既定でリポジトリ全体を読み、Markdown も対象にする**ため、ADR や rules に書いた名前が「使用中」と判定されて出力に残っていた。`styles.css` の `@import "tailwindcss" source("../src")` で対象をアプリのソースへ絞る。効果は `source()` を外して `vp build` を 2 回回せば測れる。

`@source not` で除外を並べる形は採らない。symlink (`.claude/skills` は `.agents` を指す) と、後から増える置き場を取りこぼす。絞る側を書けば、対象に入れ忘れた場所は utility が生成されないことで気付ける。

**`static` は Storybook だけに掛ける。** `.storybook/preview.css` が `src/styles.css` を `@import "../src/styles.css" theme(static);` で読み直す。`theme()` は import 単位で効くため、本番の CSS は `static` の分を持たない。

代償は、Tailwind 既定 theme の未定義トークンがカタログに混ざることである。2026-09-20 の実測では Radius に 2 件、Typography に 6 件で、Colors は `--color-*: initial` が効いていて増えない。

Tailwind は theme の出力を `@layer theme` に置くため、CSSOM の走査は `@layer` を含むグループ規則を再帰的に辿る必要がある。辿らないと `@layer` の中の `:root` を見落とす。

telemetry は `core.disableTelemetry` で切る。既定で有効で、実行したコマンド・バージョン・addon 一覧・story とコンポーネントの件数を送る。このテンプレートから作られる全プロジェクトへ配られる設定なので、`envDir: false` や `disable_tools` と同じく明示で潰す側に揃える。

### 7. a11y は `error` で自動検査し、既存のブラウザテストは残す

`parameters.a11y.test` を `"error"` にする。story を書いた部品は自動で axe の対象になり、検査の範囲が既存より広がる。

違反が出たら抑制せず直す。部品側の欠陥なら部品を直す。story 単位の `parameters.a11y` は global の `"error"` より強いので、書けば黙る。抑制するときは、理由と本体の扱いを決める issue 番号をその場に書く (実例は `table-skeleton.stories.tsx` の `empty-table-header`)。

| 対象                 | 役割                                                   |
| -------------------- | ------------------------------------------------------ |
| story                | どんな状態があるか。目で見るカタログ                   |
| 既存のブラウザテスト | その状態が壊れていないか。寸法と色を固定する回帰の防止 |

役割が違うため両方残す。ADR-0013 / ADR-0015 / ADR-0018 が固めた待機・実イベント・animation 無効化の規律は既存のテストが持ち続ける。

### 7-1. テーマごとの project は 2 つ持つが、Storybook 経由の実行では light だけにする

a11y を light と dark の両方へ当てるため、`vitest.storybook.config.ts` の `storybookProject()` を `initialGlobals` のテーマ違いで 2 つ作る。これは `@storybook/addon-vitest` の型が名指しで勧める形で、「define one Vitest project per theme, each with a different value」と書いてある。

**その形のまま Storybook 経由で走らせると起動しない。** addon は `VITEST_STORYBOOK=true` のとき project 名を `storybook:${configDir}` へ強制上書きする (`dist/vitest-plugin/index.js` の `storybook:workspace-name-override`)。同じ `configDir` から 2 つ作れば名前が衝突し、Storybook の test panel も `storybook tools test run` も `Project name ... is not unique` で止まる。上流の storybookjs/storybook#32427 が 2025-09-07 から open で、同じ light / dark 構成の報告が付いている。

`VITEST_STORYBOOK=true` のときだけ light の 1 つに絞る。判定の正本は `mise run verify` が回す `vp test run` で、そこは両テーマのまま変わらない。test panel は書いている最中の確認に使うもので、dark を落としても正本は痩せない。

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

### 8. story はコンポーネントと並べ、registry の baseline から除く

`*.stories.tsx` は部品と同じディレクトリに置く。`src/components/ui/` に置いたものも `*.test.tsx` と同じ「registry 由来でない付随ファイル」として baseline 検査の対象外になる (ADR-0006)。

story を置けるのは `src/components/` 配下に限る。`.storybook/main.ts` の `stories` をそこへ絞っているためで、他へ置くと Storybook も vitest の project も拾わず、a11y 検査ごと無言で外れる。範囲を広げるかどうかは、`features/` や `routes/**/-components/` に story を書きたくなった時点で決める。

story は `no-restyle` / `require-static-classes` の適用外である。`vite.config.ts` の override が `src/components/{ui,action,parts}/**` を `excludeFiles` で外しており、story もそこに置くためである。部品へ `className` を直接渡しても lint は鳴らない (2026-09-20 実測)。渡してよい範囲は消費側と同じで、`no-restyle` の `allow: ["layout"]` に収まる class に限る。外見を上書きする class は部品側の variant にする (ADR-0021)。catalog は実際の使われ方を見せるものなので、消費側で書ける形を story で書けなくしない。lint が鳴らないぶんはレビューで見る。

CSF の meta は 1 ファイルに 1 つで、`component` もそこに紐づく。1 つのファイルが複数の部品を export するとき、まとめて書くと別の部品の meta 配下に並ぶ。単独で描画できる部品は story ファイルを分ける。

トークンの story は CSS 変数の値を見せる場所で、typography の階層のような class の規範は持たない。`styling.md` の表を story へ写すと片方だけが古くなる。markdown と code を突き合わせる機械検査は持っていない。

story は出荷される bundle に入らないため、`no-restricted-imports` の対象からも外す。

### 9. 導入は 3 段階に分け、PR を stack にする

1 度に全部品の story を書かない。段階ごとに PR を分け `gh stack` で積む。

| 段階 | 範囲                                 |
| ---- | ------------------------------------ |
| 1    | 基盤とデザイントークンの story       |
| 2    | 外見を定義する `parts/` と `action/` |
| 3    | `ui/` の registry 部品すべて         |

段階 3 は `src/components/ui/` の registry 部品をすべてカタログ化する。消費側からの import 件数で絞らない。

当初は「import 0 件の部品には story を書かない」としていたが、この基準は成立しなかった。理由は 3 つで、いずれも 2026-09-20 の実測による。

- **消費者の母数が捨てられる前提のもの。** `README.md` はデモアプリ (`src/features/notes/` と `src/routes/notes/`) の削除を利用者へ案内している。削除すると `empty` のように消費者が 0 件へ落ちる部品が出る。テンプレートの利用者にとって「テンプレート本体が今使っているか」はカタログの価値と無関係である
- **基準が推移的に閉じない。** `sheet` / `tooltip` は `sidebar` からのみ、`textarea` / `input-group` は `combobox` からのみ参照され、その参照元自体に消費者がいない。`ui/` の外で数えると 0 件になるが、素朴に数えると 1 件以上になる。同じ状態の部品が数え方だけで両側へ分かれる
- **検査の穴が残る。** story も test も持たない部品は axe が一度も当たらないまま利用者へ配られる。全件カタログ化すると light / dark の 2 テーマぶんの a11y 検査が全部品に掛かる

上流の `write-story` skill は「ALWAYS write a Storybook story for any component written」と書いており、この決定はその既定値へ寄せたことになる。vendor した registry を対象外と読む余地はあるが、テンプレートは registry を配ることが役目なので対象に含める。

段階 2 と 3 は、対象の層に story があり a11y 検査が通ることを完了条件とする。

## 検討した選択肢

| 案                                                       | 評価                                                                                                                                                                  | 採否     |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 標準の Vite builder を使う                               | `tanstackStart()` との衝突を自分で回避することになり、server function を呼ぶ部品の story が組めない                                                                   | 却下     |
| play function を全部品に一律書く                         | 公式 (Interaction testing) が一律適用の保守費用を警告しており、`args` で決まる状態の検証とも二重になる                                                                | 却下     |
| 「初期状態では中身が見えない部品」を play の対象軸にする | 公式が「複雑で対話的な部品ならさらに踏み込める」と述べる後段を落とし、公式にない軸を独自に作ってしまう                                                                | 却下     |
| 既存のブラウザテストを丸ごと story へ移す                | portable stories は state 更新を伴う再描画を支援しない。待機・実イベント・animation の規律を移植する動機も無い                                                        | 却下     |
| トークンを公式の `ColorPalette` で書く                   | 色値を MDX へ書き写すため `styles.css` と二重管理になる                                                                                                               | 却下     |
| トークンを専用 addon で一覧化する                        | `styles.css` へ注釈コメントを足す必要があり、Storybook 専用の記述が SSOT に混ざる                                                                                     | 却下     |
| コントラスト比を自前で計算する                           | 対応する色空間を実装ごと抱える。`oklch()` を読めない実装になり、変換のためにブラウザの色パーサを借りる連鎖が起きた                                                    | 却下     |
| 全トークンを単一の背景と比べる                           | 画面上で重ならない組み合わせの比が並び、閾値を割ったかどうかの判断に使えない                                                                                          | 却下     |
| `styles.css` に `static` を付ける                        | 未参照の宣言が本番 CSS へ乗り、この template から作られる全プロジェクトが払う。差の測り方は `@theme inline` と `@theme static inline` を入れ替えて `vp build` を 2 回 | 却下     |
| トークン名を `styles.css` のソースから読む               | `static` が無いと未出力の変数は `getComputedStyle` で解決できず、名前だけが並ぶ                                                                                       | 却下     |
| `__unstable__loadDesignSystem` でビルド時に列挙する      | `@tailwindcss/node` が export するが、名前のとおり安定 API ではないと明示されている                                                                                   | 却下     |
| 検証専用 story をサイドバーへ出したまま置く              | 同じ見た目の story が並び、カタログとして読めなくなる (2026-09-20 に 1 部品で実測、9 story 中 4 つが重複)                                                             | 却下     |
| 検証専用 story を別ファイルへ分ける                      | story glob と「部品の隣へ置く」規約の両方を変えることになる                                                                                                           | 却下     |
| pending の見た目を決着しない action で作る               | 後続 story の Transition を止める (節 4 の実測)                                                                                                                       | 却下     |
| `action/` を当初どおり対象外に保つ                       | pending 表現に server function の stub が要るという理由が実測で誤りと判明した                                                                                         | 却下     |
| 状態のカタログに徹し、対話的な部品にだけ play を書く     | 外見確認という目的を満たし、検証の二重化も保守費用の増大も避けられる                                                                                                  | **採用** |

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
- Tailwind CSS: Detecting classes in source files — https://tailwindcss.com/docs/detecting-classes-in-source-files
- storybookjs/storybook#33747 (Vite builder と tanstack start plugin の衝突)
