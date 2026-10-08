# ADR-0035: クライアント遷移は、新しいページの見出しへの focus と title の読み上げで伝える

- Status: Accepted
- Date: 2026-09-28
- 関連: ADR-0026 (読み上げは `announce()` の polite の region に流す)、ADR-0027 (検索条件の変化は件数の通知で伝える)、ADR-0029 (route の pending 表示は `announce()` で通知しない)

## Context

クライアント遷移では文書が読み込み直されない。スクリーンリーダーは新しいページを読み始めず、focus は押したリンクに残るか、リンクが消えれば `<body>` に落ちる (下の「調査結果」)。スクリーンリーダー・キーボード・拡大鏡の利用者には、ページが変わったことが届かない。

| 前提                         | 中身                                                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| router が持つもの            | TanStack Router は route announcer も遷移後の focus 管理も持たない。TanStack/router#918 ("Accessibility"、2024-01-04 起票) は 2026-09-28 時点で open                                             |
| 規格が求めるもの             | WCAG の Understanding 2.4.2 は "the title of the page should also be changed dynamically" と title の更新を求める。focus の移し先を定める SC は無い                                              |
| 利用者での検証               | 見つかったユーザーテストは Gatsby と Fable Tech Labs の 1 件 (2019-07-11、5 セッション) だけ。スクリーンリーダーの利用者では "Focusing on a heading was found to be the best experience"         |
| 拡大鏡の利用者               | 同じテストで、読み上げに頼る試作は "quite useless as they relied on screen reader announcements" だった。読み上げだけでは届かない                                                                |
| 見出しへ移す前提             | Kitty Giraudel (2020-12-07) は、ローディング中やエラーでも関係する `<h1>` が必ずあると保証できるなら、隠した要素を置かずに `<h1>` へ `tabindex="-1"` で focus してよいとする                     |
| テンプレートが保証できること | ページの見出しは `PageHeader` (`src/components/parts/page-header.tsx`) が `<h1>` で描き、エラー画面と not found の画面も `<h1>` を持つ。本文は root の `<main>` (`src/routes/__root.tsx`) に入る |

この ADR が決めるのは、path の変わる遷移の後に新しいページを伝えることだけである。route の pending 表示 (読み込み中) の見せ方と通知は決めない。pending 表示は `announce()` で通知しない (ADR-0029)。その見せ方は `docs/guides/accessibility.md`「読み込み中の表示の見せ方を選んだ理由」にある。遷移の後の title の読み上げは、ページが変わったことを伝えるもので、読み込みの完了の告知ではない。

## Decision

| 項目               | 決定                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 伝え方             | 見出しへの focus 移動と、title の読み上げを併用する                                                                                                                                                                      |
| focus の移し先     | ページの `<h1>`。`tabindex="-1"` を付けて `focus({ preventScroll: true, focusVisible: false })` を呼ぶ。`<h1>` が無ければ `<body>`                                                                                       |
| focus の枠         | 見出しには出さない (`focusVisible: false`)                                                                                                                                                                               |
| 伝える遷移         | path が変わる遷移 (`pathChanged`)。戻る・進むも同じに扱う。ルートの `errorComponent` へ移る遷移も同じに扱う                                                                                                              |
| 伝えない遷移       | 検索条件だけの変化 (`pathChanged` が false)、最初のページ (`fromLocation` が無い)                                                                                                                                        |
| focus を奪わない   | `onBeforeNavigate` の時点の `document.activeElement` を覚え、`onRendered` の時点で focus が失われている (`null` か `<body>`) か、覚えた要素のままのときだけ移す                                                          |
| 読み上げ           | `document.title` をそのまま、`announce()` (ADR-0026) の polite で流す。文言は足さない                                                                                                                                    |
| title              | 各ルートの `head()` で `pageTitle(ctx, <ページ名>)` (`src/lib/page-title.ts`) を通して持つ。形は `<ページ名> — <APP_NAME>`、ページ名が無ければ `<APP_NAME>`                                                              |
| not found の title | `head()` に渡る `matches` のどれかが `isNotFound(match.error)` なら `ページが見つかりません — <APP_NAME>`                                                                                                                |
| 実装の置き場       | `createRouter` の `InnerWrap` に渡す部品 (`src/components/router-inner-wrap.tsx`) の中に、購読だけを持つ部品 (`src/components/route-announcer.tsx`) を置く。部品は effect で `router.subscribe` を購読し、DOM を描かない |

### focus を移す目的と、枠を出さない理由

focus を移す目的は次の 2 つで、どちらも枠を要さない。

- スクリーンリーダーが読み始める位置を、新しいページの見出しにする
- キーボードの次の Tab の起点を、新しいページの先頭にする

枠が担うのは、目で見る利用者が focus の位置を知る手がかりだけで、見えないのは遷移の後、次の Tab を押すまでの間である。見出しは操作できる要素ではなく、WCAG 2.4.7 の対象外である。枠を出すと、操作できない見出しがアプリ標準の focus 表現を持ち、ボタンやリンクと区別できなくなる。2026-09-28 に実アプリ (Chrome for Testing 147) で、キーボードで遷移すると見出しにブラウザ既定の `outline: auto` が出て、アプリ標準の枠と食い違うことを観測した。

Gatsby 2019 のテストの枠についての証言は両方向にある。

| 被験者       | 証言                                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 拡大鏡       | "In this user test, the participant found visible focus outlines to be helpful for orienting oneself in the application."  |
| スイッチ操作 | "The visible focus indicators were useful, though they added that focus outlines on inoperable elements can be confusing." |

### 検討した案: 伝え方と focus の移し先

| 候補                                                     | 採用例                                                                                                         | スクリーンリーダー                                                                                                                                   | キーボード                                     | 目で見る利用者 (拡大鏡を含む)                                                            | 採否     |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------- | -------- |
| 見出しへ focus (枠なし) + 読み上げ                       | Angular の docs ("You should avoid situations where focus returns to the `body` element after a route change") | 新しいページの見出しから読み始める                                                                                                                   | 次の Tab が新しいページの先頭から始まる        | 次の Tab を押すまで focus の位置が見えない                                               | **採用** |
| 見出しへ focus、アプリ標準の枠をキーボードのときだけ出す | —                                                                                                              | 採用案と同じ                                                                                                                                         | 採用案と同じ                                   | キーボードで遷移したときは位置が見える。操作できない見出しが操作できる要素と同じ枠を持つ | 却下     |
| 見出しへ focus、枠を常に出す                             | —                                                                                                              | 採用案と同じ                                                                                                                                         | 採用案と同じ                                   | 位置が常に見える。ポインターで遷移しても、操作できない見出しに枠が出る                   | 却下     |
| skip link へ focus                                       | —                                                                                                              | 使い方が割れる (WebAIM の調査 9、下の表)                                                                                                             | 次の Tab で本文へ飛べる                        | skip link が見える                                                                       | 却下     |
| `<body>` へ戻す + 読み上げ                               | SvelteKit (sveltejs/kit#307 "matches the behaviour of server-rendered apps")、Navigation API の既定            | ページの先頭から探し直す。Gatsby 2019 は "resetting focus to the top of the app would be very overwhelming, especially in large applications" とする | 次の Tab がページの先頭から始まる              | focus の位置が見えない                                                                   | 却下     |
| 変わった部分の wrapper へ focus                          | Gatsby、Reach Router                                                                                           | Gatsby 2019 で "very subtle compared to focusing on a heading"                                                                                       | 次の Tab が wrapper の中から始まる             | wrapper の範囲による                                                                     | 却下     |
| focus を移さず読み上げだけ                               | Next.js 16.3.0 の app router、Nuxt の `<NuxtRouteAnnouncer>` (title を読み上げる部品)                          | 読み上げで届く                                                                                                                                       | focus が押したリンクに残るか `<body>` に落ちる | 届かない (Gatsby 2019 "quite useless")                                                   | 却下     |

- `<body>` へ戻す案には、Navigation API の explainer も "screen reader users generally prefer focus to be reset to a heading or wrapper element, instead of the `<body>`" とする
- Next.js の app router は、16.3.0 の stable と 2026-09-28 時点の canary で focus に触れない。`layout-router.tsx` のコメントは "This handler intentionally leaves focus untouched; resetting focus on navigation is deferred." とし、title の読み上げは `app-router-announcer.tsx` が持つ
- skip link を採らないのは、テンプレートにページごとに繰り返すブロック (navigation など) が無く、飛ばす先が無いからである。WCAG 2.4.1 の Understanding は Sufficient Techniques に skip link (G1) のほか、landmark (ARIA11) と見出し (H69) を挙げる。テンプレートは root の `<main>` と各ページの `<h1>` を持つ

WebAIM Screen Reader User Survey #9 (2021 年 5〜6 月、有効回答 1568 件) の、skip link があるときに使う頻度:

| 回答      | 割合  |
| --------- | ----- |
| Always    | 16.8% |
| Often     | 14.4% |
| Sometimes | 28.4% |
| Seldom    | 21.6% |
| Never     | 14.4% |

遷移で focus を動かす実装では、検索条件だけの変化で入力欄の focus が外れる不具合が起きうる。vercel/next.js#96050 ("query-string-only router.push/replace blurs the focused input"、2026-07-22 起票) は、16.3.0-preview.7 の app router が遷移のたびに focus している要素を blur し (`layout-router.tsx` の `InnerScrollHandlerNew`、コメント "Trying to match hard navigations")、検索条件だけの `router.push` でも入力欄が blur されると報告した。issue は 2026-08-03 に COMPLETED で閉じ、メンテナは "This is fixed both in canary and 16.3" と書いている。16.3.0 の stable では blur を外し、focus に触れない。「伝えない遷移」に検索条件だけの変化を入れたので、この ADR の形では起きない。

### 検討した案: 実装の置き場

| 候補                                                                                                                                                                                     | 評価                                                                                                                                                                           | 採否     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `InnerWrap` の中の部品の effect で `router.subscribe("onRendered")`                                                                                                                      | root route の error boundary の外にあり、root のエラー画面に置き換わっても購読が続く。TanStack Router docs「Router Events」の "Use `onRendered` for DOM-dependent work" に合う | **採用** |
| root route のコンポーネントの effect で購読する (TanStack/router#918 のコメントが示す PoC は、root route に置いた部品の `useEffect` で `useRouter().subscribe("onResolved")` を購読する) | root の `errorComponent` の表示中に購読が外れる                                                                                                                                | 却下     |
| `PageHeader` が mount 時に自分へ focus する                                                                                                                                              | 検索条件の変化や再描画と遷移を区別できない                                                                                                                                     | 却下     |

`InnerWrap` には DOM を描かない部品だけを置く (TanStack Router docs `RouterOptions`「`InnerWrap` property」の "Only non-DOM-rendering components like providers should be used")。購読の部品も DOM を描かず `null` を返す。

### 伝えない遷移と、focus を奪わない条件

- 検索条件だけの変化は伝えない。focus を動かすと入力欄から外れ (上の vercel/next.js#96050)、件数は ADR-0027 の通知が伝える
- 最初のページはブラウザが読むので伝えない。Next.js の announcer も "not for the first load because screen readers do that automatically" とする (`app-router-announcer.tsx`、canary ブランチ、2026-09-28 に確認)
- 奪わない条件は Navigation API の explainer の「Focus management」に合わせる: "this focus reset will not take place if the user or developer has manually changed focus while the promise was settling, and that element is still visible and focusable"
- 戻る・進むを通常の遷移と区別しない。Reach Router 1.3.1 (`src/lib/history.js`) は popstate を `action: "POP"` で同じ listener に流す。SvelteKit (`packages/kit/src/runtime/client/client.js` の `finish_navigation`、version-3 ブランチの 30d06f5) は popstate の遷移も同じ関数で focus を扱う。Navigation API の既定も traverse を区別しない

### 読み上げの文言と強さ

| 項目 | 決定と理由                                                                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 文言 | title だけにする。SvelteKit は固定の英語の文言 "Navigated to" を外して title だけを読む形にした (sveltejs/kit#1305、2021-05-02。文言の差し替えは i18n の仕組みが整ってから、とした) |
| 強さ | polite にする。focus の移動で見出しが読まれ、読み上げは補いになる。assertive は読み上げ中の発話を遮る。Nuxt の `<NuxtRouteAnnouncer>` の `politeness` も既定は `polite`             |

### not found の title

公式の推奨形は無い (docs の「Not Found Errors」「Document Head Management」、intent skill、upstream の issue と PR を 2026-09-28 に検索)。TanStack/router#7279 でメンテナは "title is still set via head(), those components will be rendered inside the route that caused them to render" と答えている。

| 候補                          | 評価                                                                                                                                                                                                                                                                                                | 採否     |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `isNotFound(match.error)`     | root が受け持つときも root 以外が受け持つときも true になる (2026-09-28、@tanstack/react-router 1.170.32 で実測)                                                                                                                                                                                    | **採用** |
| `match.status === 'notFound'` | router の changelog (TanStack/router#7950、2026-08-04) は `globalNotFound` を非公開の `_notFound` に改め "Use `match.status === 'notFound'` instead" とする。ただし root が受け持つとき `status` は `'success'` のままで (router-core 1.171.27 の `src/load-client.ts` 1168〜1183 行)、判定できない | 却下     |

- `head()` は not found の境界の route まで走り、深い route の title が勝つ。判定を `pageTitle` にまとめて全 route の `head()` が通すので、境界がどこでも同じ判定になる。2026-09-28 に @tanstack/react-router 1.170.32 で、root が受け持つ、`notFoundComponent` を持つ route 自身が受け持つ、`head()` を持つ親が受け持つ、`head()` を持たない親が受け持つ、の 4 通りで not found の title になることを実測した
- どこにも当たらない URL (手で打った URL など) は扱わず、アプリ名の title のままにする。どの route が受け持っても `_notFound` にしか印が付かず、`match.error` は入らない (router-core 1.171.27 の `src/load-client.ts` 1289〜1299 行)。型の付いた `<Link>` と `navigate` ではアプリの中から到達しない
- 区画ごとの文言 (「〜が見つかりません」) にしない。title と見出しを同じ定義から作る仕組みが要る。区画の文脈は `notFoundComponent` の見出しが伝える

## Consequences

- 各ルートは `head()` で `pageTitle` を通した title を持つ必要がある。持たないと親の route の title になり、同じ親の下のページと遷移の読み上げで区別できない。title を直接書くと、not found の画面でもそのページの名前になる
- 各ページは `<h1>` を持つ必要がある。無いと focus は `<body>` に落ち、`focusPageHeading` (`src/lib/focus-page-heading.ts`) が `console.warn` を出す
- 各ページの見出しを含む本体は、loader が待った query で描く必要がある (欠かせない query を loader で待つのは ADR-0033)。`onRendered` の契機は route の Suspense 境界の外側の layout effect で、route の Suspense 境界 (`pendingComponent` を fallback に持つ) はその内側にある。本体が loader の後に suspend すると、focus は pending 表示の中の最初の `<h1>` (無ければレイアウトの最初の `<h1>`、それも無ければ `<body>`) へ移り、pending 表示の `<h1>` へ移った場合は本体に置き換わると `<body>` へ落ちる (@tanstack/react-router 1.170.32 の `src/Matches.tsx` 97〜101 行と `src/Match.tsx` 106〜112 行・128 行を読んだ推論、未実測)
- 遷移の直後は、Tab を押すまで focus の位置が目では見えない。Gatsby 2019 の拡大鏡の被験者は枠が位置をつかむのに役立つと答えており、この利用者には手がかりが減る。枠の有無を比べたテストは見つかっていない
- 入れない改善: 戻った先で、前に focus していた要素へ focus を戻す。MPA で bfcache から戻ったときと揃う形で (whatwg/html#6696、2021-10-14 マージ。"the focused element stays the same/not reset")、Navigation API の explainer も traverse の例に挙げる。ただし explainer 自身が "the notion of \"the same element\" is not generally stable" とし、要素を識別子で覚える仕組みが要る。ブラウザの実装も揃っていない (下の「調査結果」)
- 見出しの focus と title の読み上げの聞こえ方は、一次資料で決着していない。2026-09-28 に macOS 27.0 の VoiceOver と Chrome 153.0.8010.53 で、2 つのページの間の遷移と戻るを聞き、見出しの読み上げの後に title の読み上げが順に、途切れずに聞こえた。エラー画面へ移ったとき (失敗したルートの title と、focus の移った見出し「エラーが発生しました」の組み合わせ) と、NVDA・JAWS では確かめていない。聞こえ方が悪ければ文言と強さを見直す
- 遷移の後の focus と読み上げは `src/components/route-announcer.test.tsx`、伝えるかの判定は `src/lib/route-announcement.test.ts`、focus の移し方は `src/lib/focus-page-heading.test.tsx`、title は `src/lib/page-title.test.ts` が見る
- ルート遷移は View Transitions を通る (ADR-0040)。`src/components/route-announcer.test.tsx` は本番と同じく `defaultViewTransition: true` の router で、遷移の後の focus と title を確かめる。2026-10-09 に、テストで `document.startViewTransition` を包んで呼び出しを数え、呼ばれて `ready` がすべて resolve したうえで全件が通ることを確かめた (router-core 1.171.34)

## 調査結果

### 遷移の各時点の focus と title

2026-09-28、@tanstack/react-router 1.170.32 (@tanstack/router-core 1.171.27)、vitest browser の Chromium で測った。

| 場面                                  | `onBeforeNavigate` の focus | `onRendered` の focus・title・`<h1>`                               |
| ------------------------------------- | --------------------------- | ------------------------------------------------------------------ |
| 最初の描画 (クライアント)             | 出ない                      | `BODY`、`fromLocation` 無し、`pathChanged` true                    |
| 残るリンクを押す                      | 押したリンク                | 押したリンクのまま。title と `<h1>` は新しい値                     |
| 戻る (popstate)                       | 出る                        | 前の要素のまま                                                     |
| ページ内の消えるリンクを押す          | 押したリンク                | `BODY`                                                             |
| 検索条件だけの変化                    | —                           | `pathChanged` false                                                |
| loader が失敗するルートへ             | 押したリンク                | `BODY`。title はそのルートの `head()`、`<h1>` はエラー画面の見出し |
| root の `errorComponent` への置き換え | —                           | `InnerWrap` の effect は後始末されない                             |

- `onRendered` の時点で title と `<h1>` が新しい値なので、先行例の遅延は入れない。Astro は title を 60ms 後に入れ (`packages/astro/src/transitions/router.ts`、main の 7661f48)、Gatsby は `requestAnimationFrame` で待つ (`packages/gatsby/cache-dir/navigation.js`、master の 1fd967b)
- SSR の最初のページでは、hydration で `onResolved` が出ない。`onRendered` は `InnerWrap` の effect より先に出るので、購読が間に合わない。間に合ったとしても `getLocationChangeInfo(resolvedLocation, resolvedLocation)` で出るので `pathChanged` は false になり、伝えない遷移に当たる (@tanstack/react-router 1.170.32 の `src/Transitioner.tsx` 76〜88 行を読んだ推論、未実測)

### bfcache から戻ったときの focus

- Chrome for Testing 147 + Playwright 1.63 (`--disable-back-forward-cache` を外す) では、`persisted: true` で戻っても focus は `<body>` で、`pagehide` の時点ですでに `<body>` だった。自動操作の環境によるものかは切り分けていない
- wpt.fyi の `back-forward-cache/focus.html` は Edge 154 が 1/1、Chrome・Firefox・Safari は結果なし (2026-09-28)

### `focusVisible` の対応

- MDN: `focusVisible` は "`false` to prevent visible indication that the element is focused"。対応は Chrome 145、Firefox 104、Safari 18.4 (MDN browser-compat-data 8.1.3、2026-09-28)
- SvelteKit も focus の起点を移すとき `element.focus({ preventScroll: true, focusVisible: false })` を呼ぶ (`packages/kit/src/runtime/client/focus.js` 29 行、version-3 ブランチの 30d06f5)。同じファイルの関数のコメントは "Sets the sequential focus navigation starting point to `element` without leaving it focused" とする

## 出典

- WCAG Understanding 2.4.2: https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html
- WCAG Understanding 2.4.1: https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html
- WCAG Understanding 2.4.7: https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
- WebAIM Screen Reader User Survey #9 (「"Skip" Links」の節): https://webaim.org/projects/screenreadersurvey9/
- Gatsby と Fable Tech Labs のユーザーテスト (2019-07-11): https://www.gatsbyjs.com/blog/2019-07-11-user-testing-accessible-client-routing/
- Kitty Giraudel「A11y Advent Day 7: Page Title in SPA」(2020-12-07): https://kittygiraudel.com/2020/12/07/a11y-advent-page-title-in-spa/
- TanStack/router#918: https://github.com/TanStack/router/issues/918
- TanStack/router#918 のコメントが示す PoC の部品: https://github.com/TheBinaryGuy/tsr-live-announcer/blob/main/src/components/route-announcer.tsx
- TanStack Router docs「Router Events」: https://tanstack.com/router/latest/docs/guide/router-events
- TanStack Router docs `RouterOptions`: https://tanstack.com/router/latest/docs/api/router/RouterOptionsType
- TanStack/router#7279: https://github.com/TanStack/router/discussions/7279
- TanStack/router#7950 (changelog): https://github.com/TanStack/router/pull/7950
- Navigation API の explainer「Focus management」: https://github.com/WICG/navigation-api#focus-management
- whatwg/html#6696: https://github.com/whatwg/html/pull/6696
- Angular の accessibility best practices: https://angular.dev/best-practices/a11y
- sveltejs/kit#307: https://github.com/sveltejs/kit/issues/307
- sveltejs/kit#1305: https://github.com/sveltejs/kit/pull/1305
- SvelteKit の `focus.js`: https://github.com/sveltejs/kit/blob/version-3/packages/kit/src/runtime/client/focus.js
- SvelteKit の `client.js`: https://github.com/sveltejs/kit/blob/version-3/packages/kit/src/runtime/client/client.js
- Reach Router の `history.js`: https://github.com/reach/router/blob/master/src/lib/history.js
- vercel/next.js#96050: https://github.com/vercel/next.js/issues/96050
- Next.js 16.3.0-preview.7 の `layout-router.tsx`: https://github.com/vercel/next.js/blob/v16.3.0-preview.7/packages/next/src/client/components/layout-router.tsx
- Next.js 16.3.0 の `layout-router.tsx`: https://github.com/vercel/next.js/blob/v16.3.0/packages/next/src/client/components/layout-router.tsx
- Next.js の `app-router-announcer.tsx` (canary): https://github.com/vercel/next.js/blob/canary/packages/next/src/client/components/app-router-announcer.tsx
- Nuxt の `<NuxtRouteAnnouncer>`: https://nuxt.com/docs/api/components/nuxt-route-announcer
- Astro の `router.ts`: https://github.com/withastro/astro/blob/main/packages/astro/src/transitions/router.ts
- Gatsby の `navigation.js`: https://github.com/gatsbyjs/gatsby/blob/master/packages/gatsby/cache-dir/navigation.js
- MDN `HTMLElement.focus()`: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus
- MDN browser-compat-data (`api/HTMLElement.json` の `focus` の `options_focusVisible_parameter`): https://github.com/mdn/browser-compat-data/blob/main/api/HTMLElement.json
- wpt.fyi の `back-forward-cache/focus.html`: https://wpt.fyi/results/html/browsers/browsing-the-web/back-forward-cache/focus.html
