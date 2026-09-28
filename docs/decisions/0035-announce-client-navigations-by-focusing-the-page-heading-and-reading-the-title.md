# ADR-0035: クライアント遷移は、新しいページの見出しへの focus と title の読み上げで伝える

- Status: Accepted
- Date: 2026-09-28
- 関連: ADR-0026 (読み上げは `announce()` の polite の region に流す)、ADR-0027 (検索条件の変化は件数の通知で伝える)

## Context

クライアント遷移では文書が読み込み直されない。スクリーンリーダーは新しいページを読み始めず、focus は押したリンクに残るか、リンクが消えれば `<body>` に落ちる (下の「調査結果」)。スクリーンリーダー・キーボード・拡大鏡の利用者には、ページが変わったことが届かない。

| 前提                         | 中身                                                                                                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| router が持つもの            | TanStack Router は route announcer も遷移後の focus 管理も持たない。TanStack/router の issue 918 ("Accessibility"、2024-01-04 起票) は 2026-09-28 時点で open                            |
| 規格が求めるもの             | WCAG の Understanding 2.4.2 は "the title of the page should also be changed dynamically" と title の更新を求める。focus の移し先を定める SC は無い                                      |
| 利用者での検証               | 見つかったユーザーテストは Gatsby と Fable Tech Labs の 1 件 (2019-07-11、5 セッション) だけ。スクリーンリーダーの利用者では "Focusing on a heading was found to be the best experience" |
| 拡大鏡の利用者               | 同じテストで、読み上げに頼る試作は "quite useless as they relied on screen reader announcements" だった。読み上げだけでは届かない                                                        |
| 見出しへ移す前提             | Kitty Giraudel (2020-12-07) は、ローディング中やエラーでも関係する `<h1>` が必ずあると保証できるなら、隠した要素を置かずに `<h1>` へ `tabindex="-1"` で focus してよいとする             |
| テンプレートが保証できること | ページの見出しは `PageHeader` (`src/components/parts/page-header.tsx`) が `<h1>` で描き、エラー画面と not found の画面も見出しを持つ                                                     |

## Decision

| 項目               | 決定                                                                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 伝え方             | 見出しへの focus 移動と、title の読み上げを併用する                                                                                                                              |
| focus の移し先     | ページの `<h1>`。`tabindex="-1"` を付けて `focus({ preventScroll: true, focusVisible: false })` を呼ぶ。`<h1>` が無ければ `<body>`                                               |
| focus の枠         | 見出しには出さない (`focusVisible: false`)。2026-09-28 に実アプリで、キーボードで遷移すると見出しにブラウザ既定の `outline: auto` が出て、アプリ標準の枠と食い違うことを観測した |
| 伝える遷移         | path が変わる遷移 (`pathChanged`)。戻る・進むも同じに扱う。ルートの `errorComponent` へ移る遷移も同じに扱う                                                                      |
| 伝えない遷移       | 検索条件だけの変化 (`pathChanged` が false)、最初のページ (`fromLocation` が無い)                                                                                                |
| focus を奪わない   | `onBeforeNavigate` の時点の `document.activeElement` を覚え、`onRendered` の時点で focus が `<body>` か覚えた要素のままのときだけ移す                                            |
| 読み上げ           | `document.title` をそのまま、`announce()` (ADR-0026) の polite で流す。文言は足さない                                                                                            |
| title              | 各ルートの `head()` で `pageTitle(ctx, <ページ名>)` (`src/lib/page-title.ts`) を通して持つ。形は `<ページ名> — <APP_NAME>`、ページ名が無ければ `<APP_NAME>`                      |
| not found の title | `head()` に渡る `matches` のどれかが `isNotFound(match.error)` なら `ページが見つかりません — <APP_NAME>`                                                                        |
| 実装の置き場       | `createRouter` の `InnerWrap` に渡すコンポーネント (`src/components/route-announcer.tsx`) の effect で `router.subscribe` を購読する                                             |

### 検討した案: 伝え方と focus の移し先

| 案                              | 採用例                                                                                                         | 評価                                                                                                                                                                                                          | 採否     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 見出しへ focus + 読み上げ       | Angular の docs ("You should avoid situations where focus returns to the `body` element after a route change") | スクリーンリーダーの利用者は新しいページの見出しから読み始め、拡大鏡とキーボードの利用者には focus の位置で届く                                                                                               | **採用** |
| `<body>` へ戻す + 読み上げ      | SvelteKit (issue 307 "matches the behaviour of server-rendered apps")、Navigation API の既定                   | スクリーンリーダーの利用者はページの先頭から探し直す。Navigation API の explainer も "screen reader users generally prefer focus to be reset to a heading or wrapper element, instead of the `<body>`" とする | 却下     |
| 変わった部分の wrapper へ focus | Gatsby、Reach Router                                                                                           | 2019 年のテストで "very subtle compared to focusing on a heading"                                                                                                                                             | 却下     |
| focus を移さず読み上げだけ      | Next.js、Nuxt (`<NuxtRouteAnnouncer>`)                                                                         | 拡大鏡とキーボードの利用者に伝わらない                                                                                                                                                                        | 却下     |

focus を移す実装では、検索条件だけの変化で入力欄の focus が外れる不具合が起きうる。Next.js の issue 96050 ("query-string-only router.push/replace blurs the focused input"、2026-07-22) がその例である。「伝えない遷移」に検索条件だけの変化を入れたので、この形では起きない。

### 検討した案: 実装の置き場

| 案                                                                                   | 評価                                                                                                                                                             | 採否     |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `InnerWrap` の effect で `router.subscribe("onRendered")`                            | root route の error boundary の外にあり、root のエラー画面に置き換わっても購読が続く。公式の「Router Events」の "Use `onRendered` for DOM-dependent work" に合う | **採用** |
| root route のコンポーネントで `useLocation` + `useEffect` (issue 918 で紹介された形) | root の `errorComponent` の表示中に購読が外れる。遷移ではなく表示の結果を契機にしている                                                                          | 却下     |
| `PageHeader` が mount 時に自分へ focus する                                          | 検索条件の変化や再描画と遷移を区別できない                                                                                                                       | 却下     |

### 伝えない遷移と、focus を奪わない条件

- 検索条件だけの変化は伝えない。focus を動かすと入力欄から外れ (上の Next.js の issue 96050)、件数は ADR-0027 の通知が伝える
- 最初のページはブラウザが読むので伝えない。Next.js の announcer も "not for the first load because screen readers do that automatically" とする (`app-router-announcer.tsx` のコメント)
- 奪わない条件は Navigation API の explainer に合わせる: "this focus reset will not take place if the user or developer has manually changed focus while the promise was settling, and that element is still visible and focusable"
- 戻る・進むを通常の遷移と区別しない。調べた router (Reach Router と Gatsby のフォーク、SvelteKit の `client.js`、Angular の `NavigationEnd`、Navigation API の既定) はどれも区別しない。Angular はソースを読んだ推論で、実測していない

### 読み上げの文言と強さ

| 項目 | 決定と理由                                                                                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 文言 | title だけにする。SvelteKit は固定の英語の文言 "Navigated to" を外して title だけを読む形にした (PR 1305、2021-05-02。文言の差し替えは i18n の仕組みが整ってから、とした) |
| 強さ | polite にする。focus の移動で見出しが読まれ、読み上げは補いになる。assertive は読み上げ中の発話を遮る。Nuxt の `<NuxtRouteAnnouncer>` の `politeness` も既定は `polite`   |

### not found の title

公式の推奨形は無い (docs の「Not Found Errors」「Document Head Management」、intent skill、upstream の issue と PR を 2026-09-28 に検索)。TanStack/router の discussion 7279 でメンテナは "title is still set via head(), those components will be rendered inside the route that caused them to render" と答えている。

| 判定の案                      | 評価                                                                                                                                                                                                                                                        | 採否     |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `isNotFound(match.error)`     | root が受け持つときも root 以外が受け持つときも true になる (2026-09-28 実測)                                                                                                                                                                               | **採用** |
| `match.status === 'notFound'` | router の changelog (PR 7950、2026-08-04) は `globalNotFound` を非公開の `_notFound` に改め "Use `match.status === 'notFound'` instead" とする。ただし root が受け持つとき `status` は `'success'` のままで (router-core の `load-client.ts`)、判定できない | 却下     |

- `head()` は not found の境界の route まで走り、深い route の title が勝つ。判定を `pageTitle` にまとめて全 route の `head()` が通すので、境界がどこでも同じ判定になる。2026-09-28 に、root が受け持つ、`notFoundComponent` を持つ route 自身が受け持つ、`head()` を持つ親が受け持つ、`head()` を持たない親が受け持つ、の 4 通りで not found の title になることを実測した
- どこにも当たらない URL (手で打った URL など) は扱わず、アプリ名の title のままにする。どの route が受け持っても `_notFound` にしか印が付かない (`load-client.ts`)。型の付いた `<Link>` と `navigate` ではアプリの中から到達しない
- 区画ごとの文言 (「〜が見つかりません」) にしない。title と見出しを同じ定義から作る仕組みが要る。区画の文脈は `notFoundComponent` の見出しが伝える

## Consequences

- 各ルートは `head()` で `pageTitle` を通した title を持つ必要がある。持たないと親の route の title になり、同じ親の下のページと遷移の読み上げで区別できない。title を直接書くと、not found の画面でもそのページの名前になる
- 各ページは `<h1>` を持つ必要がある。無いと focus は `<body>` に落ち、`focusPageHeading` (`src/lib/focus-page-heading.ts`) が `console.warn` を出す
- 入れない改善: 戻った先で、前に focus していた要素へ focus を戻す。MPA で bfcache から戻ったときと揃う形で (whatwg/html の PR 6696、2021-10-14 マージ。"the focused element stays the same/not reset")、Navigation API の explainer も traverse の例に挙げる。ただし explainer 自身が "the notion of \"the same element\" is not generally stable" とし、要素を識別子で覚える仕組みが要る。ブラウザの実装も揃っていない (下の「調査結果」)
- 見出しに focus の枠を出さないことが拡大鏡の利用者に与える影響は調べていない。Gatsby 2019 の拡大鏡の結果は読み上げに頼る案の評価で、枠の有無は比べていない
- 見出しの focus と title の読み上げが二重に聞こえるかは一次資料で決着していない。VoiceOver での聞こえ方は手動で確かめる。エラー画面へ移ったときは、失敗したルートの title と、focus の移った見出し「エラーが発生しました」の組み合わせで伝わるかも確かめる。聞こえ方が悪ければ文言と強さを見直す
- 遷移の後の focus と読み上げは `src/components/route-announcer.test.tsx`、伝えるかの判定は `src/lib/route-announcement.test.ts`、focus の移し方は `src/lib/focus-page-heading.test.tsx`、title は `src/lib/page-title.test.ts` が見る
- 再評価の条件: View Transitions を入れるとき。`onRendered` は `startViewTransition` の update callback の中で出る (ソースを読んだ推論、未実測) ので、その時点の title と `<h1>` を確かめ直す

## 調査結果

### 遷移の各時点の focus と title

2026-09-28、`@tanstack/react-router` 1.170.32、vitest browser の Chromium で測った。

| 場面                                  | `onBeforeNavigate` の focus | `onRendered` の focus・title・`<h1>`                               |
| ------------------------------------- | --------------------------- | ------------------------------------------------------------------ |
| 最初の描画 (クライアント)             | 出ない                      | `BODY`、`fromLocation` 無し、`pathChanged` true                    |
| 残るリンクを押す                      | 押したリンク                | 押したリンクのまま。title と `<h1>` は新しい値                     |
| 戻る (popstate)                       | 出る                        | 前の要素のまま                                                     |
| ページ内の消えるリンクを押す          | 押したリンク                | `BODY`                                                             |
| 検索条件だけの変化                    | —                           | `pathChanged` false                                                |
| loader が失敗するルートへ             | 押したリンク                | `BODY`。title はそのルートの `head()`、`<h1>` はエラー画面の見出し |
| root の `errorComponent` への置き換え | —                           | `InnerWrap` の effect は後始末されない                             |

- `onRendered` の時点で title と `<h1>` が新しい値なので、先行例の遅延 (Astro の 60ms、Gatsby の rAF) は入れない
- SSR の最初のページでは、hydration で `onResolved` が出ず、`onRendered` が `pathChanged` false で出る (router-core 1.171.27 の `Transitioner` のソースを読んだ推論、未実測)。どちらにしても伝えない遷移に当たる

### bfcache から戻ったときの focus

- Chrome for Testing 147 + Playwright 1.63 (`--disable-back-forward-cache` を外す) では、`persisted: true` で戻っても focus は `<body>` で、`pagehide` の時点ですでに `<body>` だった。自動操作の環境によるものかは切り分けていない
- wpt.fyi の `back-forward-cache/focus.html` は Edge 154 が 1/1、Chrome・Firefox・Safari は結果なし (2026-09-28)

### `focusVisible` の対応

- MDN: `focusVisible` は "`false` to prevent visible indication that the element is focused"。対応は Chrome 145、Firefox 104、Safari 18.4 (MDN browser-compat-data 8.1.3、2026-09-28)
- SvelteKit も focus の起点を `<body>` へ移すとき `focus({ preventScroll: true, focusVisible: false })` を呼ぶ (`packages/kit/src/runtime/client/client.js`、2026-09-28 の main)
- 見出しは操作できる要素ではなく、WCAG 2.4.7 の対象外。Gatsby 2019 のテストは "focus outlines on inoperable elements can be confusing" と報告する

## 出典

- WCAG Understanding 2.4.2: https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html
- Gatsby と Fable Tech Labs のユーザーテスト (2019-07-11): https://www.gatsbyjs.com/blog/2019-07-11-user-testing-accessible-client-routing/
- Kitty Giraudel「A11y Advent Day 7: Page Title in SPA」(2020-12-07): https://kittygiraudel.com/2020/12/07/a11y-advent-page-title-in-spa/
- TanStack Router の issue 918: https://github.com/TanStack/router/issues/918
- TanStack Router の discussion 7279: https://github.com/TanStack/router/discussions/7279
- TanStack Router の PR 7950 (changelog): https://github.com/TanStack/router/pull/7950
- Navigation API の explainer: https://github.com/WICG/navigation-api
- whatwg/html の PR 6696: https://github.com/whatwg/html/pull/6696
- Angular の accessibility best practices: https://angular.dev/best-practices/a11y
- SvelteKit の issue 307: https://github.com/sveltejs/kit/issues/307
- SvelteKit の PR 1305: https://github.com/sveltejs/kit/pull/1305
- Next.js の issue 96050: https://github.com/vercel/next.js/issues/96050
- Nuxt の `<NuxtRouteAnnouncer>`: https://nuxt.com/docs/api/components/nuxt-route-announcer
- MDN `HTMLElement.focus()`: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus
