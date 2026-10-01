# Storybook

story を書くとき、play を書くとき、Storybook の agent 向けツールを使うときの手順と、その形にしている理由を持つ。

| 決定                                                                                                               | ADR      |
| ------------------------------------------------------------------------------------------------------------------ | -------- |
| 開発環境のツールチェーンは mise と Vite+ に寄せる                                                                  | ADR-0004 |
| registry との乖離は生成時 baseline との 3-way で判別し、許容リスト (registry コードと `src/styles.css`) の行に限る | ADR-0020 |
| design system の層から外へ class 文字列を配らず、共有する外見は部品・prop・variant で配る                          | ADR-0022 |
| a11y の自動検査は story を `error` でテーマごとに走らせ、`incomplete` は描画を統制できる層でだけ落とす             | ADR-0028 |
| story とブラウザテストはアプリと同じく StrictMode の下で描く                                                       | ADR-0039 |

## how-to

### story を置く

- story は部品と同じディレクトリに `<部品>.stories.tsx` で置き、`title` を書かない。見出しはファイルパスから決まる (「story に `title` を書かない理由」)
- story を置けるのは `src/components/` 配下に限る。`.storybook/main.ts` の `stories` をそこへ絞っているためで、他へ置くと Storybook も vitest の project も拾わず、a11y 検査ごと無言で外れる。範囲を広げるかは、`features/` や `routes/**/-components/` に story を書きたくなった時点で決める
- `src/components/ui/` の registry 部品は、消費側からの import が 0 件でもすべて story を書く。理由は「registry 部品を全件カタログにする理由」にある
- `src/components/ui/` に置いた `*.stories.tsx` は、`*.test.tsx` と同じ「registry 由来でない付随ファイル」として baseline 検査の対象外になる (ADR-0020)
- 1 つのファイルが複数の部品を export するときは、単独で描画できる部品ごとに story ファイルを分ける。親を要求する部品は親の story で扱う。CSF の meta は 1 ファイルに 1 つなので、まとめると別の部品の meta の配下に並ぶ
- story だけが使うロジックは、story と同じディレクトリの `<名前>.story-helpers.ts` に置く。`src/lib/` に置くと出荷されうる
- トークンの story に、typography の階層のような class の規範を写さない。写すと片方だけが古くなり、突き合わせる検査も無い

### story を書く

- variant の網羅を story の数で表さない。代表値を story にし、残りは `argTypes` の control で切り替える。直積で増やすと、カタログが読み通せない長さになる
- `cva` の variant を control で切り替えるときは、`argTypes` の `options` を手で渡す。理由は「`cva` の variant の `options` を手で渡す理由」にある
- 手で渡す `options` は `satisfies Record<Variant, null>` のオブジェクトを出処にして `variantOptions` (`src/components/ui/variant-options.story-helpers.ts`) で渡す。`options` は `readonly any[]` で、`satisfies Meta<typeof X>` を書いても中身を検査しない。リテラルで写すと、variant を足したときに story だけ古くなり、lint も型検査も鳴らない (2026-09-20 実測)。`satisfies` を通すと、足した側が型エラーになる
- 検証専用の story (終了状態が他の story と同じ見た目になるもの) には `tags: ["!dev"]` を付ける。サイドバーの一覧から消えるが、vitest の project 実行では対象に残る ([Storybook docs「Tags」][] の Built-in tags。`index.json` の `tags` が `dev` を含まなくなる。2026-09-20 実測)。付け忘れはレビューで見る。ただし同じ見た目でも、別の部品の story なら残す。カタログは部品ごとに引くので、その部品の状態が 1 つも並ばない事態を避ける。実例は `ActionButtonShell` の `Idle` (`ActionButton` の `Default` と同じ見た目だが、pending が prop で切り替わることはそちらでしか見えない)
- story から部品へ渡す `className` は layout に限る (`no-restyle` の `allow: ["layout"]` に収まる class)。外見を上書きする class は部品側の variant にする (ADR-0022)。カタログは実際の使われ方を見せるものなので、消費側で書ける形を story で書けなくしない
- `ui/` の story は `no-restyle` / `require-static-classes` の適用外で、lint は鳴らない (ADR-0011)。鳴らないぶんはレビューで見る。`parts/` や `action/` など `ui/` の外の story は、消費側と同じく lint が止める
- pending の見た目をカタログに残す目的で、いつまでも解決しない Promise を返す action を書かない。pending を検証する story は決着する Promise を返す action で書く (`src/test/app/settling-action.ts`)。決着しない Transition が残ると、後続 story が pending のまま止まる
- Storybook の vitest 実行は story ごとに描き先の要素と root を作り直し、前の story を unmount する。それでも、React が進行中の Transition を root をまたいでまとめるので ([React docs「useTransition」][] の Caveats の "If there are multiple ongoing Transitions, React currently batches them together.")、後続 story の Transition が残った Transition と一緒に待たされる。2026-09-28 に React 19.3.0・Storybook 10.6.0 で、決着しない action を押した story の後ろでは 50ms で決着する action の story が 1.5 秒たっても pending のままで、単独では 78ms で解けた
- story の decorator は器の形 (flex / gap) だけを持ち、余白を足さない (「vitest 経由の story に padding を当てる理由」)
- 狭い幅での見え方は、story に `globals: { viewport: { value: "narrow" } }` を付けて目で見る。その story に寸法を測る play は書かない (「狭幅を story で見る理由」)。実例は `src/components/parts/centered-card.stories.tsx` の `Narrow`
- viewport を選ばない story は、vitest から走らせるとブラウザテストの既定と別の寸法で描かれる。story とブラウザテストで幅に依る見え方が食い違ったら、まずこの差を疑う (「vitest 経由の story の viewport が決まる仕組み」)

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

`vp exec storybook skills` が出す `write-story` skill ([Storybook の `storybook-story-instructions.md`][]) は上流の規約で、このリポジトリの決定と食い違う箇所がある。play を書く範囲は [Storybook の `storybook-story-instructions.md`][] の「Simulate key user flows」ではなく「カタログと play の範囲」に従い、操作で状態が変わる部品にだけ書く。このガイドに書かれていない項目は [Storybook の `storybook-story-instructions.md`][] の既定に従う。

### 自動構成の外を手で置く

TanStack 専用の framework は、router を memory-backed で自動ラップし、server function を自動で stub する (「framework を TanStack 専用にし、telemetry を切る理由」)。次のものは自動構成が届かない。

- TanStack Query は対象外。Query を使う部品の story を書くようになったら、QueryClient を `.storybook/preview.tsx` の構成へ手で置く
- server-only の依存を引く部品の story を書くようになったら、その依存を `__mocks__` で遮断する
- story の URL を組むとき、path の `$name` と `$` の segment だけが展開され、`{-$name}` や `{$id}.json` のような波括弧の segment は展開されない。tanstack-react の path の展開の制限で (`pnpm-workspace.yaml` の patch も上流の修正も同じ)、上流の修正 ([storybookjs/storybook#36333][]) の本文も `{-$optional}` を未対応と書く。波括弧の segment を持つ route の story を書くようになったら、URL が組めるかをその時点で確かめる

### play を書く

- play の操作は `storybook/test` の合成イベントで書く。play は Storybook の UI 上でも走るので CDP を使えない。実イベントでの発火の規律 (`docs/guides/testing/user-interactions.md`「クリックを発火する」「合成イベントが実物からずれる理由」) はブラウザテスト側が持ち、play へは移さない (「story とブラウザテストの分担」)
- 同期の 2 連射は play では起きない。`storybook/test` の操作が各手順を await するためである
- 待機は `storybook/test` の `waitFor` で書く。ブラウザテストの retry API (`docs/guides/testing/waiting-and-assertions.md`「待つ口を選ぶ」) は play から呼べない
- popup を閉じる play は、閉じた popup の unmount を待ってから終える。待たないと、play の後に走る a11y 検査が animate-out の窓に入る (`docs/guides/testing/user-interactions.md`「animation を無効にして走らせる理由」)
- Storybook の test 実行では、ブラウザテストの animation の無効化を適用していない。開閉を待つ story は `findBy` 系の待機だけで足りている。足りなくなったら `tooling/test/storybook-project.ts` の `setupFiles` へ入れる。`.storybook/preview.tsx` へ入れると `storybook dev` でも animation が消え、人が見るときの動きまで失う
- `storybook/test` の `expect` は、vitest の matcher をすべて持つわけではない。ブラウザテストの assertion を play へ機械的に写せない箇所がある
- story は StrictMode の下で描かれ、描画と mount 直後の effect が 2 回走る (`docs/guides/testing/configuration.md`「StrictMode の下で描く」)

### ブラウザテストから play へ移す

1. 移すのは story を書く部品に限り、ファイルごとに移せるかを実測してから進める。一律には移さない
2. play で書いた検証は、既存のブラウザテストから削る。同じ振る舞いを 2 か所で固定しない
3. 対象の全 case が移れば、test ファイルごと削る。locator と文言を持つ `*.test-helpers.ts` は残す (`routes/` のテストが同じものを引く)
4. 移せない case (レイアウトと配色の実測 (`getComputedStyle` / `getBoundingClientRect`)、CDP 経由の実イベント) はブラウザテストに残し、残す理由と、実イベントの規律をどのテストが持つかを、そのファイルの JSDoc に書く。書かないと、次に読む人が「移し忘れ」と読んで消す。story へ移した結果、実イベントの検証がリポジトリから消えることも防ぐ。型契約 (`expectTypeOf`) は `*.test-d.ts` に置く (`docs/guides/testing/type-tests.md`「型テストを置く」)。
5. play を書かない部品 (args だけで状態が決まるもの) では、story が描画と axe しか走らせず何も検証しない。構造の契約もブラウザテストに残し、JSDoc には移せない case と役割分担 (「story とブラウザテストの分担」) のどちらの根拠で残したかを書く
6. story を書かない部品のテストは触らない

### Storybook の CLI を使う

`vp exec storybook skills` と `vp exec storybook tools` の使い方は AGENTS.md「Storybook の skill と tools」にある。ツールごとに、Storybook の起動が要るかが違う (2026-09-20 に storybook@10.6.0 で、port 6006 の Storybook を止め `--no-attach` を付けて 1 つずつ実行した)。

| ツール                                                     | 起動     | 備考                               |
| ---------------------------------------------------------- | -------- | ---------------------------------- |
| `docs list` / `docs show` / `stories changed` / `test run` | 不要     |                                    |
| `stories preview` / `review create`                        | 必要     | preview の URL と review の発行    |
| `stories find-by-component`                                | 実質必要 | 起動なしでも走るが、結果が空で返る |

`stories find-by-component` の逆依存グラフは dev server が持つ。未起動だと `no stories found` が返り、story が無いのと区別が付かない。tool の help 自身 ([Storybook の `stories/definition.ts`][] の `findByComponent`) が「If a component has no matches here, it has no stories yet (say so, don't fabricate)」と書くので、読んだ側は「story が無い」と報告してしまう。起動して `--port` で指すと、距離つきで返る。

## explanation

### framework を TanStack 専用にし、telemetry を切る理由

framework の選定は `tanstackStart()` plugin と Storybook の Vite builder の衝突 ([storybookjs/storybook#33747][]) が決める。標準の Vite builder はこの衝突を自分で回避する必要があり、server function を呼ぶ部品の story を組めない。TanStack 専用 framework (`@storybook/tanstack-react`) は router を memory-backed で自動ラップし、server function を自動 stub する ([Storybook docs「Storybook for TanStack React」][])。

telemetry は `.storybook/main.ts` の `core.disableTelemetry` で切る。既定で有効で、実行したコマンド・バージョン・addon 一覧・story とコンポーネントの件数を送る ([Storybook docs「Telemetry」][])。このテンプレートから作られる全プロジェクトへ配られる設定なので、`envDir: false` や `disable_tools` (ADR-0004) と同じく明示で潰す側に揃える。

`boot` イベントだけはこの設定で止まらない。`main.ts` を読む前に送られるためで、中身はメタデータを持たない。止めるには環境変数 `STORYBOOK_DISABLE_TELEMETRY` が要る ([Storybook docs「Telemetry」][])。

| 案                               | 評価                                                                                                | 採否     |
| -------------------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| 標準の Vite builder を使う       | `tanstackStart()` との衝突を自分で回避することになり、server function を呼ぶ部品の story が組めない | 却下     |
| TanStack 専用 framework を使う   | router を memory-backed で自動ラップし、server function を自動 stub する                            | **採用** |
| telemetry を既定のまま有効にする | このテンプレートから作られる全プロジェクトへ配られる設定なので、明示で潰す                          | 却下     |

- Storybook の静的ビルド (`vp exec storybook build`) は、`mise run verify` と CI では走らせていない。`tanstackStart()` plugin と標準の Vite builder の衝突 ([storybookjs/storybook#33747][]) は 2026-09-30 時点で未解決だが、TanStack 専用 framework が `tanstackStart()` の plugin を外すので build は通る (2026-09-30、`@storybook/tanstack-react` 10.6.0)。`lazyPlugins` に async の関数を渡すと外せなくなる (`docs/guides/vite-configuration.md`「plugin を先頭で import する理由」)

### story を状態のカタログにする理由

story は部品の状態 (variant / tone / disabled) を、アプリの画面を開かずに並べて見る場所である。振る舞いの検証は play を書く部品に限る。

| 案                                                       | 評価                                                                                                                                       | 採否     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| play function を全部品に一律書く                         | [Storybook docs「Interaction tests」][] が一律適用の保守費用を警告しており、`args` で決まる状態の検証とも二重になる                        | 却下     |
| 「初期状態では中身が見えない部品」を play の対象軸にする | [Storybook docs「Interaction tests」][] が「複雑で対話的な部品ならさらに踏み込める」と述べる後段を落とし、公式にない軸を独自に作ってしまう | 却下     |
| 検証専用 story をサイドバーへ出したまま置く              | 同じ見た目の story が並び、カタログとして読めなくなる (2026-09-20 に 1 部品で実測、9 story 中 4 つが重複)                                  | 却下     |
| 検証専用 story を別ファイルへ分ける                      | story glob と「部品の隣へ置く」規約の両方を変えることになる                                                                                | 却下     |
| pending の見た目を決着しない action で作る               | 後続 story の Transition を止める (「story を書く」の実測)                                                                                 | 却下     |
| `action/` を対象外にする                                 | pending 表現に server function の stub が要るという理由は、実測で成り立たない (2026-09-20)                                                 | 却下     |
| 状態のカタログに徹し、対話的な部品にだけ play を書く     | 外見確認という目的を満たし、検証の二重化も保守費用の増大も避けられる                                                                       | **採用** |

### story とブラウザテストの分担

play は Storybook の UI 上でも実行されるため CDP を使えない。story と既存のブラウザテストは同じ部品の振る舞いを固定しうるので、役割を分け、play へ移した検証はブラウザテストから削る。

| 対象                 | 役割                                                   |
| -------------------- | ------------------------------------------------------ |
| story                | どんな状態があるか。目で見るカタログ                   |
| 既存のブラウザテスト | その状態が壊れていないか。寸法と色を固定する回帰の防止 |

- 役割が違うため両方残す。待機・実イベント・animation 無効化の規律 (`docs/guides/testing/waiting-and-assertions.md`「待つ口を選ぶ」、`docs/guides/testing/user-interactions.md`「クリックを発火する」「animation を無効にして走らせる理由」) は既存のテストが持ち続ける
- 移せないのはレイアウトと配色の実測、CDP 経由の実イベントの 2 つである。型契約 (`expectTypeOf`) は `*.test-d.ts` に置く (`docs/guides/testing/type-tests.md`「型テストを置く」)
- 画面のテストは Action 層の guard を代替しない。`confirmDelete` は `close()` のあと `void runAction(...)` と同期に返るので Transition が即終了し、2 発目の時点で `isPending` は false になる。`disabled={isPending}` を外しても browser project は 1 件も落ちない (2026-09-20 実測)。経路が薄いラッパーを通ることは、その guard を通ることを意味しない
- 検証が一部 CDP の実イベントから合成イベントへ移り、backdrop の遮りを含む pointer の忠実さは下がる。一方イベント間に描画が挟まる点は既存のブラウザテストと同じ性質になる

| 案                                                                | 評価                                                                                                           | 採否     |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------- |
| 既存のブラウザテストを丸ごと story へ移す                         | portable stories は state 更新を伴う再描画を支援しない。待機・実イベント・animation の規律を移植する動機も無い | 却下     |
| play は合成イベントで書き、実イベントの規律はブラウザテストに残す | Storybook の UI 上でも play が動き、実イベントの検証もリポジトリから消えない                                   | **採用** |

### registry 部品を全件カタログにする理由

「import 0 件の部品には story を書かない」という基準は成立しない。理由は 3 つで、いずれも 2026-09-20 の実測による。

- 消費者の数は画面の追加と削除で動く。画面を消すと `empty` のように消費者が 0 件へ落ちる部品が出るが、次の画面で使われうる。「今どの画面が使っているか」はカタログの価値と無関係である
- 基準が推移的に閉じない。`sheet` / `tooltip` は `sidebar` からのみ、`textarea` / `input-group` は `combobox` からのみ参照され、その参照元自体に消費者がいない。`ui/` の外で数えると 0 件になるが、素朴に数えると 1 件以上になる。同じ状態の部品が数え方だけで両側へ分かれる
- 検査の穴が残る。story も test も持たない部品は axe が一度も当たらないまま利用者へ配られる。全件カタログ化すると light / dark の 2 テーマぶんの a11y 検査が全部品に掛かる

上流の `write-story` skill ([Storybook の `storybook-story-instructions.md`][]) は「ALWAYS write a Storybook story for any component written」と書いており、この方針はその既定値に沿う。vendor した registry を対象外と読む余地はあるが、テンプレートは registry を配ることが役目なので対象に含める。

### story に `title` を書かない理由

[Storybook docs「Sidebar & URLS」][] は "We recommend using a nesting scheme that mirrors the filesystem path of the components." と勧め、auto-title はその階層をファイルの場所から作る。`title` を手で書くと、ファイルを動かしたときに title だけが古いパスを指す。

### `cva` の variant の `options` を手で渡す理由

Storybook は `argTypes` を部品の型から推論し、手で書いた `argTypes` はその推論を上書きする ([Storybook docs「ArgTypes」][] の "Any argTypes specified manually will override the inferred values.")。`cva` の variant は、推論に任せるとどちらの解析器でも control で使える選択肢にならない。

| 解析器 (`.storybook/main.ts` の `typescript.reactDocgen`) | variant の推論結果                                                                                                                                                                             |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 既定の `react-docgen`                                     | `any` になり、control に選択肢が出ない (2026-10-01、`vp exec storybook tools docs show --id ui-button` の Props が `variant?: any`)                                                            |
| `react-docgen-typescript`                                 | literal の union に `null` が混ざり、`null` も選択肢に出る。選ぶと variant の class が付かない (2026-10-02、Storybook 10.6.0 / react-docgen-typescript 2.4.0 / class-variance-authority 0.7.1) |

- 公式は型が出ないときの直し方として `react-docgen-typescript` への切り替えを案内し ([Storybook docs「TypeScript」][] の "The types are not being generated for my component")、[Storybook docs「Manifests」][] も manifest の props を抜き出す解析器として多くのプロジェクトに `react-docgen-typescript` を勧める (同じ段落は、生成が遅ければ速いが粗い `react-docgen` へ切り替えてよいとも書く)。このリポジトリはこの案内から外れ、既定の `react-docgen` のまま `options` を手で書く
- `null` は class-variance-authority 0.7.1 の `VariantProps` が variant の型に持つ値で、渡すと variant を外す ([cva docs「What's new」][] の "Passing `null` used to disable a variant")。`react-docgen-typescript` の経路ではこの `null` が選択肢に残り (上の表の実測)、`react-docgen-typescript` の設定にも `null` を外すものは無い
- cva の作者は "`null` will be removed in `cva@1.0`, and this is likely a Storybook issue not a `cva` issue" と答えて issue を閉じた ([joe-bell/cva#270][]。外す内容は [cva docs「What's new」][] の "Goodbye `null`")。型から `null` を外すのは cva@1 で、cva 0.7.1 のまま `react-docgen-typescript` の control から `null` を外すことは、cva も Storybook も約束していない
- cva@1 はパッケージ名が `cva` に変わり、安定版は無い (2026-10-04、`npm view cva dist-tags` が `latest: 0.0.0`、`beta: 1.0.0-beta.12`)。上げると、import 元を `"cva"` に、base の class を `cva({ base })` の 1 引数に書き換える ([cva docs「What's new」][] の Breaking changes の "cva now accepts a single parameter")。registry 由来の `ui/` の `cva(...)` がすべて変わる

| 案                                                                                                 | 評価                                                                                                                         | 採否     |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- |
| 既定の `react-docgen` の推論に任せる                                                               | variant が `any` になり、選択肢が出ない                                                                                      | 却下     |
| `react-docgen-typescript` に切り替えて推論に任せる (公式の案内)                                    | `null` が選択肢に出て、選ぶと variant の class が付かない部品が描かれる                                                      | 却下     |
| `react-docgen-typescript` に切り替え、cva 側で `null` を除く型を部品 16 ファイルに使う             | registry の部品を書き換えることになり、registry からの乖離 (ADR-0020) が 13 件増える (2026-10-02)                            | 却下     |
| cva@1 (beta) へ上げ、`null` の無い型を `react-docgen-typescript` に推論させる                      | registry 由来の `ui/` の `cva(...)` がすべて書き換わり、上の行と同じく registry からの乖離 (ADR-0020) を増やす。安定版も無い | 却下     |
| `react-docgen-typescript` に切り替え、`.storybook/preview.tsx` の自前の `argTypesEnhancers` で除く | 利用者向けの docs に無い API に頼り、`experimentalDocgenServer` を有効にすると効かない                                       | 却下     |
| `options` を手で書き、`satisfies Record<Variant, null>` で網羅を強制する                           | 写しは残るが、variant の増減は型エラーで落ちる (「story を書く」)                                                            | **採用** |

shadcn の registry が cva@1 へ移ったら、手書きの `options` を外す。registry から取り直した部品が cva@1 を使うので、上げても registry からの乖離にならない。2026-10-04 時点の registry の `button` (`base-vega`) は、まだ `class-variance-authority` から `cva` を import している。外す手段は 2 つある。

| 手段                                                   | 外し方                                                                                                                                                                                                |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react-docgen-typescript` へ切り替える (公式の案内)    | `null` が選択肢に出ないことを確かめてから、手書きの `options` を消す。`createLink` で包んだ部品、Base UI の型の prop、story だけが持つ args は `react-docgen-typescript` でも推論できず、手書きが残る |
| cva@1 の `getSchema` (`cva/tools`) で `options` を作る | variant の名前・値・既定を返す。[cva docs「What's new」][] の Features は "Use it to generate Storybook controls or variant galleries from your component." と書く                                    |

### vitest 経由の story に padding を当てる理由

`layout` パラメータを当てるのは `WebView.prepareForStory` で ([Storybook の `WebView.ts`][] の `applyLayout`)、この経路は Storybook の preview iframe にしかない。vitest から走らせた story には既定の `layout: "padded"` が効かず、canvas の原点へ密着して描かれる。

- この差は `.storybook/preview.css` の `body:not(.sb-show-main)` が埋める。Storybook の UI では body へ `sb-show-main` が付くので、付いていないときだけ同じ `1rem` を当てる。`sb-main-*` で見ないのは、`layout: "none"` の story が UI 側でも `sb-main-*` を持たないため (理由は同ファイルのコメント)
- 埋めないと、グリフが行ボックスからはみ出す部品 (registry の `leading-none` など) で、そのはみ出しが背景を持つ唯一の箱 (body) の外へ出て axe が色を測れなくなる。`html` は背景を持たないので受け止められない
- decorator で余白を足さないのは、この余白が全 story に共通の要件だからである。[Storybook docs「Decorators」][] は部品が端まで描かれるときの直し方として decorator で余白を足す例を示すが、その余白は Storybook の UI では既定の `layout: "padded"` ([Storybook docs「Story layout」][]) が、vitest 経由では `preview.css` がすでに付ける。decorator で足すと、その story だけが二重の余白で描かれる

### 狭幅を story で見る理由

狭い幅での見え方は、story の `narrow` viewport で目で見る。その story では寸法を機械で測らない。

- registry の部品の寸法は上流が決め、消費側が size を変えるのも正当な使い方である。story で測ると、上流の変更でも消費側の変更でも落ち、そのたびに消される
- `narrow` の寸法は `.storybook/preview.tsx` が `src/test/browser/viewport-sizes.ts` の `NARROW_VIEWPORT` から引き、ブラウザテストと同じ値を使う。写すとどちらかが古くなる

### vitest 経由の story の viewport が決まる仕組み

vitest から走らせた story の viewport は、`@storybook/addon-vitest` の `setViewport` が story ごとに `page.viewport()` を呼んで決める ([Storybook の `viewports.ts`][])。story ごとに上書きされるので、`tooling/test/storybook-project.ts` の `browser.viewport` に書いても story には効かない。

| story の状態                                                                              | 描く寸法                                                                         |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| viewport を選んでいる (`globals.viewport.value` か `parameters.viewport.defaultViewport`) | 選んだ option の `styles` の幅と高さ                                             |
| viewport を選んでいない                                                                   | addon の既定の 1200x900                                                          |
| `patchedDependencies` の addon-vitest の patch が当たっていない                           | どの story も project の `browser.viewport` (未設定なら Vitest の既定の 414x896) |

- 1200x900 は `@storybook/addon-vitest` 10.6.0 の `DEFAULT_VIEWPORT_DIMENSIONS` である (2026-09-30 に確認)。ブラウザテストの既定 (`src/test/browser/viewport-sizes.ts` の `DEFAULT_VIEWPORT`) とは別の値で、同じ部品でも story とブラウザテストで描く寸法が違う
- addon-vitest 10.6.0 は `page` を `@vitest/browser/context` から読むが、Vitest 5 ではこの import が失敗する。addon は失敗を握りつぶして何もせずに戻るので、viewport の指定が効かないまま story が走り、何も言わない。project が `browser.viewport` を書いていなければ、描く寸法は Vitest の既定の 414x896 になる ([Vitest docs「browser.viewport」][]、Vitest 5.0.1)。patch は import 先を `vitest/browser` へ替える (`docs/guides/dependencies-and-toolchain.md`「patch を当てる」)

### CLI を使い、MCP を入れない理由

`storybook@10.6.0` は agent 向けの機構を 2 経路で配っている。本体同梱の CLI (`storybook skills` / `storybook tools`) と、別パッケージの `@storybook/addon-mcp` である。どちらも同じツール群を公開する。公式 docs に載っているのは MCP だけで、CLI は記載が無く、`storybook --help` のコマンド一覧にも出ない。

| 観点             | CLI                                  | MCP                                                                                                                     |
| ---------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| 追加パッケージ   | 不要 (本体同梱)                      | `@storybook/addon-mcp`                                                                                                  |
| Storybook の起動 | 多くのツールで不要 (上の表)          | 全ツールで必要 (HTTP endpoint 経由)                                                                                     |
| 設定             | 不要                                 | `main.ts` の `features` に `componentsManifest: true` ([Storybook docs「MCP server」][])と、エージェントへの URL の登録 |
| 配布             | clone すれば誰でも同じコマンドが動く | 登録はエージェント側の個人設定                                                                                          |

決め手は配布である。MCP の登録はエージェント側の設定に URL を 1 つ持つが、このリポジトリの Storybook の port は worktree ごとに変わる (`.mise.toml` の `storybook` タスクが `derive-dev-port.sh` で導出する)。同じ登録を collaborator へ配れない。CLI は `--cwd` / `-c` でプロジェクトを指すので、port の影響を受けない。

MCP が優るのは、ツールの説明がエージェントに常に見える点である。CLI は AGENTS.md に書いても読み飛ばされれば使われない。AGENTS.md の「Storybook の skill と tools」節を消さないのはこのためである。MCP へ移るなら、port を固定するか、worktree ごとに登録し直す運用が要る。

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。

[Storybook docs「Tags」]: https://storybook.js.org/docs/writing-stories/tags
[React docs「useTransition」]: https://react.dev/reference/react/useTransition
[Storybook の `storybook-story-instructions.md`]: https://github.com/storybookjs/storybook/blob/v10.6.0/code/core/src/cli/skills/content/instructions/storybook-story-instructions.md
[Storybook の `stories/definition.ts`]: https://github.com/storybookjs/storybook/blob/v10.6.0/code/core/src/shared/open-service/toolsets/stories/definition.ts
[storybookjs/storybook#33747]: https://github.com/storybookjs/storybook/issues/33747
[Storybook docs「Storybook for TanStack React」]: https://storybook.js.org/docs/get-started/frameworks/tanstack-react
[Storybook docs「Telemetry」]: https://storybook.js.org/docs/configure/telemetry
[Storybook docs「Interaction tests」]: https://storybook.js.org/docs/writing-tests/interaction-testing
[Storybook の `WebView.ts`]: https://github.com/storybookjs/storybook/blob/v10.6.0/code/core/src/preview-api/modules/preview-web/WebView.ts
[storybookjs/storybook#36333]: https://github.com/storybookjs/storybook/pull/36333
[Storybook の `viewports.ts`]: https://github.com/storybookjs/storybook/blob/v10.6.0/code/addons/vitest/src/vitest-plugin/viewports.ts
[Vitest docs「browser.viewport」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/config/browser/viewport.md
[Storybook docs「Sidebar & URLS」]: https://storybook.js.org/docs/configure/user-interface/sidebar-and-urls
[Storybook docs「Story layout」]: https://storybook.js.org/docs/configure/story-layout
[Storybook docs「Decorators」]: https://storybook.js.org/docs/writing-stories/decorators
[Storybook docs「ArgTypes」]: https://storybook.js.org/docs/api/arg-types
[Storybook docs「TypeScript」]: https://storybook.js.org/docs/configure/integration/typescript
[Storybook docs「Manifests」]: https://storybook.js.org/docs/ai/manifests
[Storybook docs「MCP server」]: https://storybook.js.org/docs/ai/mcp/overview
[joe-bell/cva#270]: https://github.com/joe-bell/cva/issues/270
[cva docs「What's new」]: https://beta.cva.style/getting-started/whats-new
