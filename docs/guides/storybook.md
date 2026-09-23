# Storybook

story を書くとき、play を書くとき、Storybook の agent 向けツールを使うときの手順と、その形にしている理由を持つ。

| 決定                                                                                                   | ADR      |
| ------------------------------------------------------------------------------------------------------ | -------- |
| a11y の自動検査は story を `error` でテーマごとに走らせ、`incomplete` は描画を統制できる層でだけ落とす | ADR-0028 |

## how-to

### story を置く

- story は部品と同じディレクトリに `<部品>.stories.tsx` で置き、`title` を書かない。見出しはファイルパスから決まる
- story を置けるのは `src/components/` 配下に限る。`.storybook/main.ts` の `stories` をそこへ絞っているためで、他へ置くと Storybook も vitest の project も拾わず、a11y 検査ごと無言で外れる。範囲を広げるかは、`features/` や `routes/**/-components/` に story を書きたくなった時点で決める
- `src/components/ui/` の registry 部品は、消費側からの import が 0 件でもすべて story を書く。理由は「registry 部品を全件カタログにする理由」にある
- `src/components/ui/` に置いた `*.stories.tsx` は、`*.test.tsx` と同じ「registry 由来でない付随ファイル」として baseline 検査の対象外になる (ADR-0020)
- 1 つのファイルが複数の部品を export するときは、単独で描画できる部品ごとに story ファイルを分ける。親を要求する部品は親の story で扱う。CSF の meta は 1 ファイルに 1 つなので、まとめると別の部品の meta の配下に並ぶ
- story だけが使うロジックは、story と同じディレクトリの `<名前>.story-helpers.ts` に置く。`src/lib/` に置くと出荷されうる
- トークンの story に、typography の階層のような class の規範を写さない。写すと片方だけが古くなり、突き合わせる検査も無い

### story を書く

- variant の網羅を story の数で表さない。代表値を story にし、残りは `argTypes` の control で切り替える。直積で増やすと、カタログが読み通せない長さになる
- `argTypes` の `options` は `readonly any[]` で、`satisfies Meta<typeof X>` を書いても中身を検査しない。`cva` の variant をリテラルで写すと、variant を足したときに story だけ古くなり、lint も型検査も鳴らない (2026-09-20 実測)。`satisfies Record<Variant, null>` のオブジェクトを出処にして `Object.keys` で渡すと、足した側が型エラーになる
- 検証専用の story (終了状態が他の story と同じ見た目になるもの) には `tags: ["!dev"]` を付ける。サイドバーの一覧から消えるが、vitest の project 実行では対象に残る (`index.json` の `tags` が `dev` を含まなくなる。2026-09-20 実測)。付け忘れはレビューで見る。ただし同じ見た目でも、別の部品の story なら残す。カタログは部品ごとに引くので、その部品の状態が 1 つも並ばない事態を避ける。実例は `ActionButtonShell` の `Idle` (`ActionButton` の `Default` と同じ見た目だが、pending が prop で切り替わることはそちらでしか見えない)
- story から部品へ渡す `className` は layout に限る (`no-restyle` の `allow: ["layout"]` に収まる class)。story は `no-restyle` / `require-static-classes` の適用外なので lint は鳴らない。外見を上書きする class は部品側の variant にする (ADR-0022)。カタログは実際の使われ方を見せるものなので、消費側で書ける形を story で書けなくしない。lint が鳴らないぶんはレビューで見る
- pending の見た目をカタログに残す目的で、いつまでも解決しない Promise を返す action を書かない。pending を検証する story は決着する Promise を返す action で書く (`src/test/settling-action.ts`)。Storybook の vitest 実行は 1 つの React root へ story を描き替えるので、決着しない Transition が残ると後続 story の Transition と干渉し、後続 story が pending のまま止まる (2026-09-20 実測)
- story の decorator は器の形 (flex / gap) だけを持ち、余白を足さない。vitest から走らせた story には Storybook の `layout: "padded"` が効かず、その差は `.storybook/preview.css` が埋める (「vitest 経由の story に padding を当てる理由」)

### カタログと play の範囲

story は部品が取りうる状態を並べるカタログで、振る舞いの検証を目的にしない。play は操作で状態が変わる部品にだけ書く。理由は「story を状態のカタログにする理由」にある。

| 部品の性質                                       | play を書くか | 理由                                            |
| ------------------------------------------------ | ------------- | ----------------------------------------------- |
| `args` だけで状態が決まる (寸法・variant・tone)  | 書かない      | story の control で切り替えられ、検証と重複する |
| 操作を受けて状態が変わる (dialog・form・menu 等) | 書く          | 状態遷移そのものが story の対象になる           |

- `ui/` の play は「開く」までにする。開いた先の操作 (選択・送信・閉じる) は書かない。registry 部品の振る舞いは上流が持っていて、こちらの story で固定すると上流の更新のたびに落ちる
- 対象の層は `ui/` `action/` `parts/` とし、`screens/` は外す (実画面で見るほうが早い)
- `action/` の pending 表現に server function の stub は要らない。決着する Promise を渡すだけで pending の描画と解除が成立する (2026-09-20 実測)

### 上流の `write-story` skill との違い

`vp exec storybook skills` が出す `write-story` skill は上流の規約で、このリポジトリの決定と食い違う箇所がある。play を書く範囲は skill の「Simulate key user flows」ではなく「カタログと play の範囲」に従い、操作で状態が変わる部品にだけ書く。このガイドに書かれていない項目は skill の既定に従う。

### 自動構成の外を手で置く

TanStack 専用の framework は、router を memory-backed で自動ラップし、server function を自動で stub する (「framework を TanStack 専用にし、telemetry を切る理由」)。次の 2 つは自動構成が届かない。

- TanStack Query は対象外。Query を使う部品の story を書くようになったら、QueryClient を `.storybook/preview.tsx` の構成へ手で置く
- server-only の依存を引く部品の story を書くようになったら、その依存を `__mocks__` で遮断する

### play を書く

- play の操作は `storybook/test` の合成イベントで書く。play は Storybook の UI 上でも走るので CDP を使えない。実イベントでの発火の規律 (`docs/guides/testing.md`) はブラウザテスト側が持ち、play へは移さない (「story とブラウザテストの分担」)
- 同期の 2 連射は play では起きない。`storybook/test` の操作が各手順を await するためである
- 待機は `storybook/test` の `waitFor` で書く。ブラウザテストの retry API (`docs/guides/testing.md`「待つ口を選ぶ」) は play から呼べない
- popup を閉じる play は、閉じた popup の unmount を待ってから終える。待たないと、play の後に走る a11y 検査が animate-out の窓に入る (`docs/guides/testing.md`「animation を無効にして走らせる理由」)
- Storybook の test 実行では、ブラウザテストの animation の無効化を適用していない。開閉を待つ story は `findBy` 系の待機だけで足りている。足りなくなったら `vitest.storybook.config.ts` の `setupFiles` へ入れる。`.storybook/preview.tsx` へ入れると `storybook dev` でも animation が消え、人が見るときの動きまで失う
- `storybook/test` の `expect` は、vitest の matcher をすべて持つわけではない。ブラウザテストの assertion を play へ機械的に写せない箇所がある

### ブラウザテストから play へ移す

1. 移すのは story を書く部品に限り、ファイルごとに移せるかを実測してから進める。一律には移さない
2. play で書いた検証は、既存のブラウザテストから削る。同じ振る舞いを 2 か所で固定しない
3. 対象の全 case が移れば、test ファイルごと削る。locator と文言を持つ `*.test-helpers.ts` は残す (`routes/` のテストが同じものを引く)
4. 移せない case (レイアウトと配色の実測 (`getComputedStyle` / `getBoundingClientRect`)、型契約 (`expectTypeOf`)、CDP 経由の実イベント) はブラウザテストに残し、残す理由と、実イベントの規律をどのテストが持つかを、そのファイルの JSDoc に書く。書かないと、次に読む人が「移し忘れ」と読んで消す。story へ移した結果、実イベントの検証がリポジトリから消えることも防ぐ
5. play を書かない部品 (args だけで状態が決まるもの) では、story が描画と axe しか走らせず何も検証しない。構造の契約もブラウザテストに残し、JSDoc には移せない case と役割分担 (「story とブラウザテストの分担」) のどちらの根拠で残したかを書く
6. story を書かない部品のテストは触らない

### Storybook の CLI を使う

`vp exec storybook skills` と `vp exec storybook tools` の使い方は AGENTS.md「Storybook の skill と tools」にある。ツールごとに、Storybook の起動が要るかが違う (2026-09-20 に storybook@10.6.0 で、port 6006 の Storybook を止め `--no-attach` を付けて 1 つずつ実行した)。

| ツール                                                     | 起動     | 備考                               |
| ---------------------------------------------------------- | -------- | ---------------------------------- |
| `docs list` / `docs show` / `stories changed` / `test run` | 不要     |                                    |
| `stories preview` / `review create`                        | 必要     | preview の URL と review の発行    |
| `stories find-by-component`                                | 実質必要 | 起動なしでも走るが、結果が空で返る |

`stories find-by-component` の逆依存グラフは dev server が持つ。未起動だと `no stories found` が返り、story が無いのと区別が付かない。tool の help 自身が「If a component has no matches here, it has no stories yet (say so, don't fabricate)」と書くので、読んだ側は「story が無い」と報告してしまう。起動して `--port` で指すと、距離つきで返る。

## explanation

### framework を TanStack 専用にし、telemetry を切る理由

framework の選定は `tanstackStart()` plugin と Storybook の Vite builder の衝突 (storybookjs/storybook の issue 33747) が決める。標準の Vite builder はこの衝突を自分で回避する必要があり、server function を呼ぶ部品の story を組めない。TanStack 専用 framework (`@storybook/tanstack-react`) は router を memory-backed で自動ラップし、server function を自動 stub する。

telemetry は `.storybook/main.ts` の `core.disableTelemetry` で切る。既定で有効で、実行したコマンド・バージョン・addon 一覧・story とコンポーネントの件数を送る。このテンプレートから作られる全プロジェクトへ配られる設定なので、`envDir: false` や `disable_tools` (ADR-0004) と同じく明示で潰す側に揃える。

| 案                               | 評価                                                                                                | 採否     |
| -------------------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| 標準の Vite builder を使う       | `tanstackStart()` との衝突を自分で回避することになり、server function を呼ぶ部品の story が組めない | 却下     |
| TanStack 専用 framework を使う   | router を memory-backed で自動ラップし、server function を自動 stub する                            | **採用** |
| telemetry を既定のまま有効にする | このテンプレートから作られる全プロジェクトへ配られる設定なので、明示で潰す                          | 却下     |

- Storybook の静的ビルドは検証していない。issue 33747 が未解決のため
- 出典: Storybook: TanStack framework (https://storybook.js.org/docs/get-started/frameworks/tanstack-react)、Telemetry (https://storybook.js.org/docs/configure/telemetry)

### story を状態のカタログにする理由

部品の状態 (variant / tone / disabled) を並べて見る場所が無く、確認手段はアプリの画面を開くことだけだった。story をその場所にし、振る舞いの検証は play を書く部品に限る。

| 案                                                       | 評価                                                                                                      | 採否     |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------- |
| play function を全部品に一律書く                         | 公式 (Interaction testing) が一律適用の保守費用を警告しており、`args` で決まる状態の検証とも二重になる    | 却下     |
| 「初期状態では中身が見えない部品」を play の対象軸にする | 公式が「複雑で対話的な部品ならさらに踏み込める」と述べる後段を落とし、公式にない軸を独自に作ってしまう    | 却下     |
| 検証専用 story をサイドバーへ出したまま置く              | 同じ見た目の story が並び、カタログとして読めなくなる (2026-09-20 に 1 部品で実測、9 story 中 4 つが重複) | 却下     |
| 検証専用 story を別ファイルへ分ける                      | story glob と「部品の隣へ置く」規約の両方を変えることになる                                               | 却下     |
| pending の見た目を決着しない action で作る               | 後続 story の Transition を止める (「story を書く」の実測)                                                | 却下     |
| `action/` を対象外にする                                 | pending 表現に server function の stub が要るという理由は、実測で成り立たない (2026-09-20)                | 却下     |
| 状態のカタログに徹し、対話的な部品にだけ play を書く     | 外見確認という目的を満たし、検証の二重化も保守費用の増大も避けられる                                      | **採用** |

- 出典: Storybook: Interaction testing (https://storybook.js.org/docs/writing-tests/interaction-testing)、Tags (https://storybook.js.org/docs/writing-stories/tags)

### story とブラウザテストの分担

play は Storybook の UI 上でも実行されるため CDP を使えない。story と既存のブラウザテストは同じ部品の振る舞いを固定しうるので、役割を分け、play へ移した検証はブラウザテストから削る。

| 対象                 | 役割                                                   |
| -------------------- | ------------------------------------------------------ |
| story                | どんな状態があるか。目で見るカタログ                   |
| 既存のブラウザテスト | その状態が壊れていないか。寸法と色を固定する回帰の防止 |

- 役割が違うため両方残す。待機・実イベント・animation 無効化の規律 (`docs/guides/testing.md`) は既存のテストが持ち続ける
- 移せないのはレイアウトと配色の実測、型契約、CDP 経由の実イベントの 3 つである。`src/components/ui/` の既存テスト 26 case のうち 25 case がこれに当たる (2026-09-20 実測)
- 画面のテストは Action 層の guard を代替しない。`confirmDelete` は `close()` のあと `void runAction(...)` と同期に返るので Transition が即終了し、2 発目の時点で `isPending` は false になる。`disabled={isPending}` を外しても browser project は 1 件も落ちない (2026-09-20 実測)。経路が薄いラッパーを通ることは、その guard を通ることを意味しない
- 検証が一部 CDP の実イベントから合成イベントへ移り、backdrop の遮りを含む pointer の忠実さは下がる。一方イベント間に描画が挟まる点は既存のブラウザテストと同じ性質になる

| 案                                                                | 評価                                                                                                           | 採否     |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------- |
| 既存のブラウザテストを丸ごと story へ移す                         | portable stories は state 更新を伴う再描画を支援しない。待機・実イベント・animation の規律を移植する動機も無い | 却下     |
| play は合成イベントで書き、実イベントの規律はブラウザテストに残す | Storybook の UI 上でも play が動き、実イベントの検証もリポジトリから消えない                                   | **採用** |

### registry 部品を全件カタログにする理由

「import 0 件の部品には story を書かない」という基準は成立しない。理由は 3 つで、いずれも 2026-09-20 の実測による。

- 消費者の母数が捨てられる前提のもの。`README.md` はデモアプリ (`src/features/notes/` と `src/routes/notes/`) の削除を利用者へ案内している。削除すると `empty` のように消費者が 0 件へ落ちる部品が出る。テンプレートの利用者にとって「テンプレート本体が今使っているか」はカタログの価値と無関係である
- 基準が推移的に閉じない。`sheet` / `tooltip` は `sidebar` からのみ、`textarea` / `input-group` は `combobox` からのみ参照され、その参照元自体に消費者がいない。`ui/` の外で数えると 0 件になるが、素朴に数えると 1 件以上になる。同じ状態の部品が数え方だけで両側へ分かれる
- 検査の穴が残る。story も test も持たない部品は axe が一度も当たらないまま利用者へ配られる。全件カタログ化すると light / dark の 2 テーマぶんの a11y 検査が全部品に掛かる

上流の `write-story` skill は「ALWAYS write a Storybook story for any component written」と書いており、この方針はその既定値に沿う。vendor した registry を対象外と読む余地はあるが、テンプレートは registry を配ることが役目なので対象に含める。

### vitest 経由の story に padding を当てる理由

`layout` パラメータを当てるのは `WebView.prepareForStory` で (`storybook/dist/preview/runtime.js` の `applyLayout`)、この経路は Storybook の preview iframe にしかない。vitest から走らせた story には既定の `layout: "padded"` が効かず、canvas の原点へ密着して描かれる。

- この差は `.storybook/preview.css` が埋める。Storybook の UI では body へ `sb-main-*` が付くので、付いていないときだけ同じ `1rem` を当てる
- 埋めないと、グリフが行ボックスからはみ出す部品 (registry の `leading-none` など) で、そのはみ出しが背景を持つ唯一の箱 (body) の外へ出て axe が色を測れなくなる。`html` は背景を持たないので受け止められない

### CLI を使い、MCP を入れない理由

`storybook@10.6.0` は agent 向けの機構を 2 経路で配っている。本体同梱の CLI (`storybook skills` / `storybook tools`) と、別パッケージの `@storybook/addon-mcp` である。どちらも同じツール群を公開する。公式 docs に載っているのは MCP だけで、CLI は記載が無く、`storybook --help` のコマンド一覧にも出ない。

| 観点             | CLI                                  | MCP                                                                     |
| ---------------- | ------------------------------------ | ----------------------------------------------------------------------- |
| 追加パッケージ   | 不要 (本体同梱)                      | `@storybook/addon-mcp`                                                  |
| Storybook の起動 | 多くのツールで不要 (上の表)          | 全ツールで必要 (HTTP endpoint 経由)                                     |
| 設定             | 不要                                 | `main.ts` に `componentsManifest: true` と、エージェントへの URL の登録 |
| 配布             | clone すれば誰でも同じコマンドが動く | 登録はエージェント側の個人設定                                          |

決め手は配布である。MCP の登録はエージェント側の設定に URL を 1 つ持つが、このリポジトリの Storybook の port は worktree ごとに変わる (`.mise.toml` の `storybook` タスクが `derive-dev-port.sh` で導出する)。同じ登録を collaborator へ配れない。CLI は `--cwd` / `-c` でプロジェクトを指すので、port の影響を受けない。

MCP が優るのは、ツールの説明がエージェントに常に見える点である。CLI は AGENTS.md に書いても読み飛ばされれば使われない。AGENTS.md の「Storybook の skill と tools」節を消さないのはこのためである。MCP へ移るなら、port を固定するか、worktree ごとに登録し直す運用が要る。
