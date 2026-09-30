# アクセシビリティ

axe の検査の置き場所と読み方、抑制の書き方、読み上げの通知の書き方、クライアント遷移の伝え方を持つ。

| 決定                                                                                                                              | ADR      |
| --------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 状態の通知は常時 mount の live region に集約し、項目の状態は静的テキストと `aria-busy` で持つ                                     | ADR-0026 |
| ページは URL の変化で作り直さず、取得結果の入れ替わりはページの effect が取得の決着で通知し、直前に通知した条件と同じなら出さない | ADR-0027 |
| a11y の自動検査は story を `error` でテーマごとに走らせ、`incomplete` は描画を統制できる層でだけ落とす                            | ADR-0028 |
| クライアント遷移は、新しいページの見出しへの focus と title の読み上げで伝える                                                    | ADR-0035 |

## explanation

### 層ごとの役割

同じ axe を回す層が複数あるのは重複ではない。見る対象と、落ちたときに直す場所が違う。

| 層                      | 見るもの                                                                                       | 落ちたら直す場所 |
| ----------------------- | ---------------------------------------------------------------------------------------------- | ---------------- |
| `jsx-a11y` (静的 lint)  | JSX の字面。custom 部品 (`<Button>` など) の中身は見ない                                       | その JSX         |
| devtools の a11y パネル | 触った画面。自動では実行しない                                                                 | 気付いた人が起票 |
| story の axe            | 部品が取りうる状態。操作の後も `play` で見る                                                   | 部品か story     |
| ブラウザテストの axe    | story を置けないページと文書全体 (`src/routes/`)。ランドマーク構造など、部品へ分解できないもの | そのケースの実装 |

境界は「操作の前か後か」ではない。story も `play` で操作の後の状態を見る (`docs/guides/storybook.md`「カタログと play の範囲」)。分かれるのは置ける場所と、そこから来る描画を統制できるか (ADR-0028) である。`.storybook/main.ts` の `stories` は `src/components/**` しか見ないので、ページと文書全体は story にできない。`root-document.test.ts` が見ているランドマーク構造は部品へ分解できず、ブラウザテストでしか押さえられない。両方要る。

ブラウザテストの axe が見るのは、`expectNoA11yViolations` を書いたケースだけである。書いていない画面は、devtools の a11y パネルで触りながら確かめる。

### axe の緑が意味しないこと

axe の結果が緑でも、「測った」ことも「WCAG を満たした」ことも意味しない。緑を測った証明とせず、測った件数を別に要求する。

- `incomplete` を塞いでも、`passes` に入ったことは「測った」の証明にならない。`color-contrast` は、画面に出ていない要素を合格にする (`axe.js` の `_isVisibleOnScreen` 分岐、`messageKey: 'hidden'`)。この空振りは `passes` にも数えられるので、`passes` の件数を見ても捕まえられない
- この形は axe に固有ではない。前件が成立しないまま成立する assertion は vacuous pass と呼ばれ、定石は「失敗を厳しくする」ではなく「実際に測った件数が 0 でないことを別に要求する」である
- `expectNoA11yViolations` (`src/test/a11y/a11y.ts`) の `passes.length > 0` はその粗い版で、ルール単位では見ていない。捕まえるのはルールが 1 つも走らなかった場合 (対象が空、設定で全ルールが外れた) だけで、`hidden` の空振りは捕まえない
- `passes` の件数を要求するのはブラウザテストの層だけで、story の層 (`src/test/a11y/a11y-story.ts`) は `passes` を見ない。story の層で空振りの緑を落とすものは無い

| 案                                                       | 評価                                                                                                                                                                  | 採否     |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `violations` が 0 件なら合格とする (`addon-a11y` の既定) | ルールが 1 つも走らなかった場合 (対象が空、設定で全ルールが外れた) も緑になる                                                                                         | 却下     |
| 測った件数 (`passes`) が 0 でないことを別に要求する      | ルールが 1 つも走らなかった場合を落とせる。`expectNoA11yViolations` に 1 行で入る。画面に出ていない要素の合格 (`color-contrast` の `hidden`) は、この形でも捕まえない | **採用** |

- 緑を静かに壊す設定が 2 つある。どちらも既定では無効なので、触らない

| 設定                                                 | 起きること                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `resultTypes`                                        | 含まれない group の `nodes` を先頭 1 件へ切り詰める。`incomplete` の件数が黙って過少になる |
| `contrastRatio.normal.minThreshold` / `maxThreshold` | 比が範囲外のとき合格になる (`axe.js` の evaluate の冒頭)                                   |

- axe が担当するのは WCAG の一部だけである。2026-09-21 に `axe-core@4.13.0` で数えると 105 ルール / 28 SC で、[axe-core の `README.md`][] は「平均 57% を自動検出」と書く。色に関わる範囲は特に狭い

| SC                      | axe のルール                                                                                                                                                                                                                          | 代わりに押さえるもの              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1.4.3 (文字 4.5:1)      | `color-contrast` 1 つ                                                                                                                                                                                                                 | —                                 |
| 1.4.11 (非テキスト 3:1) | 0 ルール                                                                                                                                                                                                                              | トークンの値を人が測る (ADR-0024) |
| 1.4.1 (色の使用)        | `link-in-text-block` だけ                                                                                                                                                                                                             | 本文中のリンク以外は見ない        |
| `::placeholder`         | 誤った前景色で評価する ([dequelabs/axe-core#4260][]。issue を閉じた [dequelabs/axe-core#5359][] も ::placeholder の色では評価せず、基準に届かない空の入力を incomplete にするだけで、2026-09-30 時点の安定版 4.13.0 には入っていない) | 人が見比べる (ADR-0025)           |

### `incomplete` は混成のバケツ

axe の `incomplete` は「判定できなかった」だけを意味しない。技術的に判定できなかったもの、ルールが JavaScript のエラーで落ちたもの、失敗にするのをためらって人の確認へ回したものが混ざる。件数ゼロを条件にすると、この 3 つを区別せずに落とすことになる。どの層でどれを落とすかは ADR-0028 が決める。

### 比は実際に載る面ごとに測る

同じ文字色でも、載る面によって比が変わる (ページ直下、ダイアログの中、`bg-input/30` の入力欄の中)。[WCAG 2.2「contrast ratio」][] の note は、背景を「そのテキストが通常の利用で実際に載る背景」とし、評価の対象を "color pairs ... an author would expect to appear adjacent in typical presentation" と複数形で書く。テーマやダイアログの面は typical presentation に入るので、面ごとに測る。導き方の詳細は ADR-0025 が持つ。

### 抑制を出た story に置く理由

| 案                                                         | 評価                                                                                          | 採否     |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| 出た story の `parameters.a11y` に、理由と出口を添えて置く | 抑制の範囲がその story に閉じ、外せる条件が抑制の隣に残る                                     | **採用** |
| `.storybook/preview.tsx` でルールをグローバルに無効化する  | 全 story でその規則が働かなくなり、後から足した部品の違反も出なくなる                         | 却下     |
| `IGNORED_INCOMPLETE` に足す                                | `incomplete` だけを合否から外す仕組みで、`violations` は止まらない。守備範囲が違う (ADR-0028) | 却下     |

- `context.exclude` で外した要素は、その story ではどの規則の対象からも外れる。外した理由と出口は story 側のコメントが持つ

### a11y の検査を tag で分ける理由

a11y の検査は、ブラウザテストの中に 2 種類が混ざっている。a11y だけを問う専用のテストと、挙動テストの途中に置いた assert (楽観更新中の行、削除中の行のように、操作の途中にしか無い状態を測るもの) である。分けたいものを分解すると、プロセスを分ける必要があるのは 1 行だけになる。

| 分けたいもの                    | 手段            | 追加の描画 |
| ------------------------------- | --------------- | ---------- |
| 関心 (アクセシブルか / 動くか)  | テスト名と tag  | 無し       |
| 実行 (a11y だけ走らせる)        | `--tags-filter` | 無し       |
| runner の設定 (timeout / retry) | tag の定義      | 無し       |
| プロセス                        | project         | 増える     |

- [Vitest docs「Test Tags」][] の When to reach for tags は、tags を多数のファイルに散る横断カテゴリとカテゴリ単位の `timeout` / `retry` に、Test Projects をファイルごとに runner の設定 (isolation / pool / environment) が違うときに割り当てる。a11y の検査は runner の設定が挙動テストと同じで、横断カテゴリに当たる
- 専用の project は足さない。足すとそのぶん描画が増える。tag の定義は `timeout` / `retry` を持てる ([Vitest docs「tags」][] の `TestTagDefinition`) ので、project を選ぶ理由 (runner の設定と単独実行) は tag 側で満たせる
- tag は `it` 単位で付ける。a11y の `it` は挙動テストと同じ `describe` の中に混ざっているので、`describe` の単位では分けられない
- 専用のテストファイルへ分けない。テストの置き場所は壊れる原因で分けており、a11y の検査は挙動テストと同じ原因で壊れる
- 何もしない形も採らない。どれが a11y の問いかが読めず、a11y だけを単独で走らせられない

### クライアント遷移を伝える仕組み

クライアント遷移では文書が読み込み直されず、スクリーンリーダーは新しいページを読み始めない。`src/components/route-announcer.tsx` の `RouteAnnouncer` が router の遷移を購読し、次の 2 つを行う (ADR-0035)。

| 行うこと                                      | 利用者に起きること                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| 新しいページの `<h1>` へ focus を移す         | スクリーンリーダーは見出しを読み、キーボードの次の Tab は新しいページの先頭から始まる |
| `document.title` を `announce()` で読み上げる | focus の届かない場面の補いになる                                                      |

`RouteAnnouncer` は DOM を描かず購読だけを持つ部品で、`createRouter` の `InnerWrap` に渡す `RouterInnerWrap` (`src/components/router-inner-wrap.tsx`) の中に置く。root route の error boundary の外にあるので、root のエラー画面に置き換わっても購読が続く (`docs/guides/react/effects.md`「router との間の副作用の置き場所」)。

伝える遷移と伝えない遷移は次のとおり。判定は `src/lib/route-announcement.ts` の `shouldAnnounceNavigation` が持つ。

| 遷移                                  | 伝えるか | 理由                                                                                        |
| ------------------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| path の変化                           | 伝える   | ページが変わった                                                                            |
| 検索条件だけの変化                    | 伝えない | focus を動かすと検索の入力欄から外れる。結果の件数は ADR-0027 の通知が伝える                |
| 最初のページ                          | 伝えない | ブラウザとスクリーンリーダーが読む                                                          |
| 戻る・進む                            | 伝える   | path の変化として通常の遷移と同じに扱う                                                     |
| ルートのエラー画面、root のエラー画面 | 伝える   | エラー画面の `<h1>` へ移る。ルートのエラー画面では、読み上げは失敗したルートの title になる |

focus は奪わない。`src/lib/focus-page-heading.ts` の `focusPageHeading` は、遷移の直前 (`onBeforeNavigate`) の `document.activeElement` を受け取り、描画の後 (`onRendered`) の focus で移すかを決める。

| 描画の後の focus                          | 移すか   | 起きる場面                                                                                                                                                                                                                            |
| ----------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<body>`                                  | 移す     | 押したリンクが新しいページで消えた                                                                                                                                                                                                    |
| 無い (`document.activeElement` が `null`) | 移す     | focus を失った状態。`focusPageHeading` は `<body>` と同じに扱う                                                                                                                                                                       |
| 遷移の直前と同じ要素                      | 移す     | 押したリンクが残るレイアウトにある、戻る・進む                                                                                                                                                                                        |
| それ以外の要素                            | 移さない | 遷移中にアプリか利用者が別の要素へ focus を動かした。メニューの項目から遷移すると、閉じたメニューが trigger へ focus を戻すので見出しへ移らず、title の読み上げだけになる (Base UI の Menu の `finalFocus` の既定、2026-09-28 に実測) |

- 移し先は文書順で最初の `<h1>` である。レイアウトに `<h1>` を置くと、遷移のたびにそちらへ移る
- `<h1>` が無いと focus は `<body>` に落ち、`console.warn` が出る
- 見出しに focus の枠は出さない (`focusVisible: false`)。理由は ADR-0035 にある

not found の画面の title は `src/lib/page-title.ts` の `pageTitle` が決める。全 route の `head()` が `pageTitle` を通していれば、どの route が not found を受け持っても同じ title になる。判定の仕方と、扱わない URL は ADR-0035 にある。

### 読み込み中の表示の見せ方を選んだ理由

route の pending 表示 (ページ全体を置き換える skeleton と `PendingContent`) を支援技術にどう見せるかは、W3C に推奨の形が無い。[APG「Patterns」][] に読み込み中のパターンは無く、skeleton 専用の role の提案は、ARIA WG のメンバーが「`aria-live` / `aria-busy` と visually hidden text で足りる」として閉じた ([w3c/aria#1317][])。そこで次の 3 種の情報から形を決めた (2026-09-28 に調査)。

| 情報                   | 分かったこと                                                                                                                                                                                                                                          | 出典                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 仕様                   | `<table>` に別の role を載せると、`<th>` / `<td>` は対応する role を失う。status は `aria-atomic="true"` の live region                                                                                                                               | [ARIA in HTML][] の `th` / `td` の行、[WAI-ARIA 1.2][] の `status`                 |
| 支援技術の対応         | JAWS は `aria-busy="true"` の要素を読み飛ばし、NVDA・VoiceOver・TalkBack・Narrator は中身をそのまま読む ([a11ysupport.io の `aria-busy.json`][]、2019〜2021 年の測定)。2026-03-12 の ARIA WG でも「JAWS treats it like aria-hidden」と報告された      | [a11ysupport.io の `aria-busy.json`][]、[w3c/aria#2737][] (`aria-busy` の中の構造) |
| デザインシステムの実装 | 表の読み込み中を持つ系統 (Carbon、Primer、AWS Cloudscape、Twilio Paste、PatternFly、Ant Design、Salesforce Lightning、Atlassian、React Spectrum) はどれも本物の table と列見出しを残す。告知は区画ごとに 1 回にする (Primer、PatternFly、Fluent、EUI) | [Cloudscape の `src/table/skeleton-rows.tsx`][]、[Primer docs「Loading」][]        |

| 案                                                                                                                                                          | 評価                                                                                                                                            | 採否     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 本物の列見出しを持つ table を見せ、skeleton の行を `aria-hidden` にし、「読み込み中」の行を 1 つ置く ([Cloudscape の `src/table/skeleton-rows.tsx`][] の形) | 表の読み込み中を持つ系統の多数派と同じく table のまま見せる。読み込み中は 1 回だけ読まれる                                                      | **採用** |
| table 全体を `aria-hidden` にし、外側に「読み込み中」を置く ([Adrian Roselli「More Accessible Skeletons」][] の形)                                          | 読み込み中は 1 回で済むが、table を隠す系統は調べた範囲に無い                                                                                   | 却下     |
| 外側を status にして列見出し付きの table を見せ、本文は空のセルのまま                                                                                       | 空のセルが並んで読まれる。`aria-busy` を付けると JAWS で table ごと消える                                                                       | 却下     |
| `<table role="status" aria-busy="true">`                                                                                                                    | th と td が role を失い、columnheader が a11y tree に出ない。見出しが空なので axe の `empty-table-header` が出る。JAWS は status ごと読み飛ばす | 却下     |

- 「読み込み中」の行を画面に出さないのは、skeleton の見た目を読み込み後の表に近づけるためである。registry の `TableRow` / `TableCell` は下線と余白を持ち込むので、この行だけ素の `<tr>` / `<td>` で置く
- pending 表示は条件付きで mount されるので、表示した時点で読み上げられる保証は無い。支援技術は通常、live region の変化だけを伝え、最初から入っている中身は伝えない ([WAI-ARIA 1.3 Editor's Draft][] の live region の節「Typically, assistive technology will only convey changes to a live region」)。読み込みの開始と完了の告知は扱っていない

## how-to

### 読み込み中の表示を組む

対象は route の pending 表示 (ページ全体を置き換える skeleton と `PendingContent`) である。理由と却下した案は「読み込み中の表示の見せ方を選んだ理由」にある。

| 対象                    | 組み方                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 表の skeleton           | `TableSkeleton` に本物の列見出しを渡す。列見出しは実テーブルの列定義と同じ定数から採る                                    |
| skeleton の図形         | `aria-hidden` で隠す。図形は情報を持たず、読ませると空の要素が並ぶ                                                        |
| 「読み込み中」の文言    | 区画ごとに 1 つだけ置く。図形ごとに置くと、同じ文言が図形の数だけ読まれる                                                 |
| `aria-busy`             | pending 表示に付けない。読み込み中を伝える属性ではなく ([WAI-ARIA 1.2][] の `aria-busy`)、JAWS は付けた要素ごと読み飛ばす |
| `<table>` に載せる role | 載せない。`th` / `td` が role を失い、列見出しが支援技術に出ない                                                          |

### a11y の tag を付ける

1. axe で「アクセシブルか」を問うテストに `it(名前, { tags: ["a11y"] }, fn)` を付ける。tag の定義は `vitest.browser.config.ts` の `test.tags` にある
2. 単独で走らせるときは `vp test run --tags-filter a11y`、外すときは `--tags-filter '!a11y'`
3. 挙動テストの途中の状態を測る `expectNoA11yViolations` には `a11y` の tag を付けない。その状態は操作の途中にしか無く、専用のテストへ降ろすと操作の再現が重複する。assert の近くに、`a11y` の tag を付けない理由を書く
4. `expectNoA11yViolations` を呼ぶテストには、専用のテストか挙動テストかを問わず `axe` の tag を付ける。`mise run a11y:incomplete` がこの tag で絞る。付け忘れると helper が落ちる

- `--tags-filter '!a11y'` で外しても、挙動テストに相乗りした axe の検査は走る。`'!axe'` なら axe の検査は全部外れるが、その挙動テストも一緒に外れる
- tag の定義は browser project にしかない。他の project で使うなら、その project の `test.tags` へ足す
- story の a11y は `addon-a11y` が全 story へ一律に当てるので、tag の対象外である
- 相乗りの assert を後から降ろすと決めたら、共通の setup を helper へ切り出して、操作の再現の重複を避ける
- tag で絞った実行でも、verbose reporter は外れたテストを 1 行ずつ並べる。`--hide-skipped-tests` で止める ([Vitest docs「hideSkippedTests」][])
- helper は tag をテストの文脈の `task.tags` から読む。`describe` から継承した tag も入る (2026-09-29 に Vitest 5.0.1 で実測)。グローバルから読まない理由は `docs/guides/testing/annotations.md`「helper にテストの文脈を渡す理由」

### story で出た違反を抑制する

グローバルに無効化しない。抑制は出た story の `parameters.a11y` に置き、次の 3 つをコメントに書く。理由は「抑制を出た story に置く理由」にある。

- なぜそのルールがそこで出るのか
- 本体をどう扱うか (上流の issue の番号、または起票先)
- 抑制を外せる条件

粒度は 2 つあり、要素で外せるならそちらを選ぶ。ルールごと切ると、その story ではその規則が 1 つも働かなくなる。

| 粒度   | 書き方                            | 使う場面                                                 | 実例                                          |
| ------ | --------------------------------- | -------------------------------------------------------- | --------------------------------------------- |
| ルール | `parameters.a11y.config.rules`    | その story のどの要素でも、同じ理由で出る                | `combobox.stories.tsx` の `aria-hidden-focus` |
| 要素   | `parameters.a11y.context.exclude` | 特定の要素だけが判定できず、同じ規則を他の要素では見たい | `calendar.stories.tsx` の見出しの除外         |

`src/test/a11y/a11y-story.ts` の `IGNORED_INCOMPLETE` とは守備範囲が違う。あちらは `incomplete` だけを合否から外し、`config.rules` はルールごと止めるので `violations` も消える。同じルール名が両方に現れても重複ではない。片方を消せるかは、消して落ちるかで決める (次節の数え直し)。

### ブラウザテストの `incomplete` を読む

- `expectNoA11yViolations` (`src/test/a11y/a11y.ts`) は `incomplete` を合否に入れず、warning の注釈で残す。どの層で落とすかは ADR-0028 が決める
- 手元では `mise run a11y:incomplete` で読み、PR では該当テストの行に warning の注釈が付く。読み方は `docs/guides/testing/annotations.md`「注釈を読む」、位置の決まり方は `docs/guides/testing/annotations.md`「注釈の位置を読む」
- 注釈の位置は `expectNoA11yViolations` を呼んだテストの行で、どの要素がなぜ判定できなかったかは本文で見る。本文の形は `src/test/a11y/a11y-message.ts` の `describeA11yIncomplete`

### `incomplete` を数え直す

`IGNORED_INCOMPLETE` の行が今も要るかは、次の手順で確かめる。

1. `src/test/a11y/a11y-story.ts` の `IGNORED_INCOMPLETE` を空にする
2. story 側の `parameters.a11y.config.rules` も併せて外す。残すと、ルールごと止めた story は `incomplete` も出さないので数から漏れる
3. storybook の project を回し、落ちた story と失敗メッセージのルール ID を読む
4. 一度も出なくなった除外の行は消す。当たらない除外を残すと、なぜ外したかを誰も再現できなくなる

### axe を上げたとき

- `IGNORED_INCOMPLETE` の名指しは、axe の出荷物と突き合わせられない。版が上がって `color-contrast` の分岐が変わっても何も鳴らないので、ADR-0028「`color-contrast` の `incomplete` は外さない」の 3 分岐を `axe.js` で読み直す
- axe が担当するルールと SC の数 (上の「axe の緑が意味しないこと」) を数え直す

### story が CI でだけ赤になったら

story で統制できるのは markup までで、フォントは実行環境が持つ。テキストの折り返す位置が変わると矩形の重なり先も変わり、同じ story が手元では緑、CI では赤になりうる。直す対象は markup の側にある (折り返して枠の外へ出る書き方をやめる)。

### 読み上げの通知を書く

通知の経路は ADR-0026 と ADR-0027 が決める。文言は次のように書く。

- 操作の完了の文言には対象名を載せる (「『対象』を削除しました」)。同時に走る操作の完了が並んだとき、どれが終わったのかを区別できる
- 開始の文言には対象名を載せない (「削除しています」)。開始は押した直後に出るので対象は分かっており、載せると 1 回の操作で対象名を 2 度読ませる (ADR-0026)
- 対象名は切り詰めない。切り詰めた名前は先頭が同じ対象を区別できず、全文を読む手段も無くなる
- 行の状態 (「削除中」「保存中」「更新中」) は、読み順に入る静的テキストとして置く (必要なら `sr-only`)。`role="status"` / `<output>` は付けない。通知は announcer が担い、静的テキストは仮想カーソルで行を読んだときのためにある
- 取得結果の文言は、0 件も件数の形で書き、条件が空なら絞り込みの解除を伝える文言にする
- 取得結果の文言を、空状態の見出しと同じ文字列にしない。テストの `getByText` が live region と見出しの 2 要素に解決する

### ページを足すときに title と見出しを持たせる

遷移の読み上げは title を、遷移の後の focus は `<h1>` を使う (「クライアント遷移を伝える仕組み」)。ルートを足したら次の 2 つを持たせる。

1. route の `head()` の `meta` で、title を `pageTitle(ctx, <ページ名>)` (`src/lib/page-title.ts`) にする。ページ名は他のページと区別できる名前にする
2. ページの見出しを `PageHeader` (`src/components/parts/page-header.tsx`) の `title` で描く。`PageHeader` が `<h1>` を描く

- title を文字列で直接書かない。not found の判定を通らず、not found の画面でもそのページの名前が title になる
- `head()` を省かない。省くと親の route の title になり、同じ親の下のページと遷移の読み上げで区別できない
- ページの見出しを含む本体は、loader が待った query で描く。本体が loader の後に suspend すると、focus は本体ではなく pending 表示かレイアウトの `<h1>` (無ければ `<body>`) へ移る (ADR-0033、ADR-0035)
- ページを足したら、または見出しか title を変えたら、VoiceOver で見出しの focus と title の読み上げの聞こえ方を確かめる。自動テストでは聞こえ方を見られない (ADR-0035)

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。Vitest は 5.0.1 に固定した版を指す。

[axe-core の `README.md`]: https://github.com/dequelabs/axe-core/blob/v4.13.0/README.md
[dequelabs/axe-core#4260]: https://github.com/dequelabs/axe-core/issues/4260
[dequelabs/axe-core#5359]: https://github.com/dequelabs/axe-core/pull/5359
[WCAG 2.2「contrast ratio」]: https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
[Vitest docs「Test Tags」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/guide/test-tags.md
[Vitest docs「tags」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/config/tags.md
[APG「Patterns」]: https://www.w3.org/WAI/ARIA/apg/patterns/
[w3c/aria#1317]: https://github.com/w3c/aria/issues/1317
[ARIA in HTML]: https://www.w3.org/TR/html-aria/
[WAI-ARIA 1.2]: https://www.w3.org/TR/wai-aria-1.2/
[a11ysupport.io の `aria-busy.json`]: https://github.com/accessibilitysupported/a11ysupport.io/blob/master/data/tests/tech/aria/aria-busy.json
[w3c/aria#2737]: https://github.com/w3c/aria/issues/2737
[Cloudscape の `src/table/skeleton-rows.tsx`]: https://github.com/cloudscape-design/components/blob/main/src/table/skeleton-rows.tsx
[Primer docs「Loading」]: https://primer.style/product/ui-patterns/loading/
[Adrian Roselli「More Accessible Skeletons」]: https://adrianroselli.com/2020/11/more-accessible-skeletons.html
[WAI-ARIA 1.3 Editor's Draft]: https://w3c.github.io/aria/
[Vitest docs「hideSkippedTests」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/config/hideskippedtests.md
