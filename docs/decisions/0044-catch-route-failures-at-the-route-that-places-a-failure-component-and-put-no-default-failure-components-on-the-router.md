# ADR-0044: route の失敗は部品を置いた route が受け、router には既定の失敗の部品を置かない

- Status: Accepted
- Date: 2026-10-28
- 関連: ADR-0029 (router の既定の pending 表示は残す)、ADR-0035 (失敗の画面の見出しと遷移の後の focus)、ADR-0038 (server で描く errorComponent の文言)、ADR-0041 (ダイアログの route の失敗と not found)

## Context

TanStack Router では、失敗を受ける部品を route ごとに置き、router にその既定を置ける。

| 失敗                                                       | 受ける部品の決まり方                                                                                                                                                          | 出典                                                                                                                                                                               |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| route の読み込み (loader・beforeLoad) の失敗、描画中の例外 | route の `errorComponent`、無ければ router の `defaultErrorComponent` を持つ route が境界 (`CatchBoundary`) を張る。どちらも無い route は境界を張らず、失敗は親の境界へ上がる | TanStack Router API「RouteOptions type」の `errorComponent` ("Defaults to `routerOptions.defaultErrorComponent`")、`@tanstack/react-router` 1.170.41 の `Match.tsx` の `MatchView` |
| どの route にも当たらない URL                              | router が投げ、`notFoundMode` が受ける route を決める ("Depending on the `notFoundMode` option, the router will handle these automatic errors differently")                   | TanStack Router docs「Not Found Errors」                                                                                                                                           |
| リソースが無いときに投げる `notFound()`                    | "will be handled by the same route or nearest parent route that has either a `notFoundComponent` route option or the `defaultNotFoundComponent` router option configured."    | 同上の「Throwing your own notFound errors」                                                                                                                                        |

TanStack Router API「RouterOptions type」は `defaultErrorComponent` を "Defaults to `ErrorComponent`" とするが、`@tanstack/react-router` 1.170.41 のコードでは、`errorComponent` も `defaultErrorComponent` も無い route は境界を張らない。組み込みの `ErrorComponent` を描くのは、`Matches.tsx` の外側の `CatchBoundary` と、`Match.tsx` の `MatchInner` の server の分岐だけである (2026-10-28 にコードで確認)。

router に既定の部品を置くと、次のことが起きる。

- `defaultErrorComponent` があると、どの route もその部品で境界を張るので、失敗はその route の位置で受けられる。layout や祖先の route に `errorComponent` を置いても、子の失敗はそこまで上がらない (`Match.tsx` の `MatchView`)
- 既定のエラーの部品は、どの位置に描かれても同じ形で、自分の上にページの `<h1>` があるかを知らない。ページ自身の読み込みの失敗ではページ名の見出しの行が消え、失敗の `<h1>` だけが出る
- `defaultNotFoundComponent` があり、`notFoundComponent` を持つ route が無いと、子の loader の `notFound()` は既定の部品がページの中に描き、ページの `<h1>` が残る (下の「調査結果」の「`notFound()` を投げる場所と部品の構成」)
- 既定の `notFoundMode` (`fuzzy`) は、`notFoundComponent` を持つ最も深い route、無ければ子を持つ最も深い route を境界にする (router-core 1.171.34 の `router.ts` の `findGlobalNotFoundRouteId`)。ページの下の存在しない URL (`/<ページ>/<未定義>`) は、ページが自分の `notFoundComponent` を持つとき、またはどの route も `notFoundComponent` を持たないとき、ページの `<Outlet />` の中に not found の `<h1>` が出て、`<h1>` が 2 つ並ぶ。root だけが `notFoundComponent` を持つなら、`fuzzy` でも root が境界になる

## Decision

**router に `defaultErrorComponent` と `defaultNotFoundComponent` を置かず、`notFoundMode` を `"root"` にする。失敗を受ける部品は、受けたい位置の route が自分で置く。部品を置いていない route の失敗は近い祖先の部品が受け、無ければ root が受ける。**

| 失敗                                                               | 受ける部品                                                                                                             | 位置と見出し                                                                                                      |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| どの route にも当たらない URL (ページの下の存在しない URL を含む)  | root の `notFoundComponent`                                                                                            | root の component の `<Outlet />` の位置 (`<main>` の中) で画面全体を占める。失敗の見出しは `<h1>`                |
| root の失敗 (beforeLoad など) と、どの祖先の部品も受けなかった失敗 | root の `errorComponent`                                                                                               | root の component を置き換え、画面全体を占める。失敗の見出しは `<h1>`                                             |
| ページの読み込みの失敗、ページの描画中の例外                       | ページの route が自分の `errorComponent` に置く、ページの位置のエラーの部品 (`src/components/screens/route-error.tsx`) | ページを置き換える。ページ名の `<h1>` の行を描き、失敗の見出しを `<h2>` にする                                    |
| ページの loader と beforeLoad が投げた `notFound()`                | ページの位置の not found の部品は置かない。`notFoundComponent` を持つ祖先、無ければ root が受ける                      | root の not found。root の component の `<Outlet />` の位置                                                       |
| 描画中 (component) に投げた `notFound()`                           | 投げない。`notFound()` は loader か beforeLoad で投げる                                                                | 部品の置き方によって、受ける route が無いか、root の not found が root の component ごと置き換える (Consequences) |
| ダイアログの route の失敗と not found                              | ダイアログの形の部品 (ADR-0041)                                                                                        | 開く元のページの上のダイアログ                                                                                    |
| 部品を置いていない route の失敗                                    | 近い祖先の部品。無ければ root                                                                                          | 受けた祖先の部品の位置。SSR では Consequences の挙動がある                                                        |

- `defaultNotFoundComponent` を置かない理由は、root が `notFoundComponent` を持ち、`notFoundMode` が `"root"` なので、not found の最後の受け手を root が担うことである。TanStack Router docs「Not Found Errors」は、root の `notFoundComponent` か `defaultNotFoundComponent` のどちらかを置くよう勧める ("It's highly recommended to either attach at least one `notFoundComponent` to the root route or configure a router-wide `defaultNotFoundComponent` to handle not-found errors.")
- ページの位置のエラーの部品は、受けたい route が自分で置き、ページの route の options を組む関数 (`src/lib/page-title.ts`、ADR-0035) に束ねない
- ページ名 (`staticData.pageName`) の無い route にページの位置のエラーの部品を置くと、見出しの行の部品が throw し、その throw は祖先 (無ければ root) のエラーの部品が受ける。置き間違いは黙って通らない
- `notFound()` は loader か beforeLoad で投げ、描画中 (component) には投げない。TanStack Router docs「Not Found Errors」の「Throwing Not Found Errors in Components」は "You can also throw not-found errors in components. However, it is recommended to throw not-found errors in loader methods instead of components in order to correctly type loader data and prevent flickering." とする。`TanStack/router#5311` (Solid) でメンテナは "you cannot throw this from the component. just from a router life cycle method." と答えている
- ページの位置の not found の部品を作るときは、エラーの部品と同じ形 (ページ名の `<h1>` の行と `<h2>` の失敗の見出し) にする。テンプレートには置かない。使う route が無い部品は、壊れても気づけない
- root の `errorComponent` は root の component を置き換えて描かれるので、文書の骨格 (`<html>`) を自分で描く。root の `notFoundComponent` は骨格を描かない。どの route にも当たらない URL と loader・beforeLoad の `notFound()` で root が境界になると、router-core 1.171.34 の `load-client.ts` の `reduceLane` が root の match を `status: "success"` のまま `_notFound` の印を付け、`@tanstack/react-router` 1.170.41 の `Match.tsx` の `Outlet` が root の component の `<Outlet />` の位置に root の `notFoundComponent` を描く。描画中の `notFound()` はこの経路を通らない (Consequences)
- 失敗の見出しの形と遷移の後の focus は ADR-0035「失敗の画面の見出しと focus」が決める
- router の `defaultPendingComponent` は残す。root の `Outlet` の Suspense の fallback は route の options から決められない (ADR-0029)

### 失敗の受け手の決め方

| 案                                                                                                                 | 評価                                                                                                                                                                                                                                                                                                                                                                                                                                  | 採否     |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 既定の部品を外し、部品を置いた route で受ける                                                                      | 部品の形は置いた位置で決まり、上に `<h1>` があるかを実行時に判定しない。祖先に置いた部品が子の失敗を受ける。React Router ("When an error is thrown, the "closest error boundary" will be rendered."、React Router docs「Error Boundaries」の「4. Nested error boundaries」) と Next.js ("`error.js` wraps a route segment and its nested children in a React Error Boundary."、Next.js docs「error.js」) も、近い境界が受ける形をとる | **採用** |
| 既定の部品を残し、共有の失敗の部品が `useMatches()` の並びと `pageName`・`status` から上の `<h1>` の有無を推し量る | 自分の `<Outlet />` の中の not found と、描画中の `notFound()` を自分の `notFoundComponent` が受けた画面は、どちらも自分の match が success の同じ並びになり、分けられない。2026-10-23 の試作で、`<h1>` の無い画面ができた                                                                                                                                                                                                            | 却下     |
| 既定の部品を残し、ページが子の route を context で包んだ `<Outlet />` で描いて、上に `<h1>` があることを伝える     | 判定は確実になるが、「`<h1>` を描くページは包んだ `<Outlet />` で子を描く」という規範が増え、破っても型も lint も止めない。部品を置く位置で形を分ければ要らない                                                                                                                                                                                                                                                                       | 却下     |
| ページの位置のエラーの部品を、ページの route の options を組む関数に束ねる                                         | 受ける必要の無いページまで受け、祖先へ上がる道が塞がる                                                                                                                                                                                                                                                                                                                                                                                | 却下     |

失敗の画面の見出しの形 (ページ名の `<h1>` を残すか、失敗を `<h1>` にするか) の比較は、ADR-0035「失敗の画面の見出しと focus」が持つ。

### not found の 2 種類と `notFoundMode`

not found の分け方は、TanStack Router docs「Not Found Errors」の "There are 2 uses for not-found errors in TanStack Router" に倣う。どの route にも当たらない URL は router が投げ、`notFoundMode` が受け手を決める。リソースが無いときの `notFound()` は開発者が投げ、`notFoundMode` に関わらず近い `notFoundComponent` の route が受ける。loader の `notFound()` は、下の「調査結果」の client の表で、自分の `notFoundComponent` を持つページでは `"root"` と `fuzzy` で同じだった。beforeLoad の `notFound()` は測っていない。docs「Throwing your own notFound errors」の注記は beforeLoad の受け手を "based on the router's mode and matching rules" とするが、router-core 1.171.34 の `load-client.ts` の `getNotFoundBoundary` は `notFoundMode` を読まない (2026-10-28 のコードの読み)。

| 案                     | 評価                                                                                                                                                                                                                                                                                                                                                                                                                       | 採否     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `notFoundMode: "root"` | どの route にも当たらない URL を、ページの下の URL も含めて、ページが自分の `notFoundComponent` を持っても root の `notFoundComponent` で受ける ("all not-found errors will be handled by the root route's `notFoundComponent`"、docs「Not Found Errors」の「notFoundMode: 'root'」)                                                                                                                                       | **採用** |
| 既定の `fuzzy` のまま  | 親のレイアウトを残す側 ("The router will intelligently find the closest matching suitable route and display the `notFoundComponent`")。root だけが `notFoundComponent` を持つ間は root が受けるが、ページが自分の `notFoundComponent` を置くと (その部品の形は Decision が決める)、ページの下の存在しない URL はそのページの not found がページの `<Outlet />` の中に描き、上にページの `<h1>` が残って `<h1>` が 2 つ並ぶ | 却下     |

## Consequences

- SSR される route が server で失敗し、その route が `errorComponent` を持たないと、server は祖先へ遡らず、失敗した route の位置に組み込みの `ErrorComponent` (英語の "Something went wrong!") を描く。client は hydration で、近い祖先の `errorComponent` に描き直す。`Match.tsx` の `MatchInner` は、server では route にも router にも部品が無ければ組み込みの部品をその場で描き、client では `match.error` を throw して近い境界に任せる。server の HTML と hydration の後の描き直しは、2026-10-18 に `@tanstack/react-router` 1.170.41 の dev server と `renderToString` で測った。2026-10-28 の下の「調査結果」の server の表は server の HTML だけを測り、同じだった。production の build では測っていない
- `ssr: false` の配下では、server が loader と描画を走らせないので起きない (TanStack Start docs「Selective SSR」)。子の route が自分の `errorComponent` を持てば起きない。上流の挙動が変わったら、この項目と上の項目を外す
- ページの下の存在しない URL (`/<ページ>/<未定義>`) の title は、ページ名ではなくアプリ名になる。root が境界になり、`head()` は root までしか走らない (ADR-0035「not found の title」)
- 描画中に投げた `notFound()` は、測った 3 つの部品の構成のどれでも正しく受けられなかった (2026-10-28、Vitest の browser mode、本物の router、`@tanstack/react-router` 1.170.41。下の「調査結果」の「`notFound()` を投げる場所と部品の構成」)。router に既定の部品を置いた構成でも同じである

| 投げた route (自身を含む) から上へ見て、最初に失敗の部品を持つ route                 | 結果                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `errorComponent` だけを持つ (router の既定の `errorComponent` が付いた route を含む) | どの route にも受けられない。アプリ全体が組み込みの英語の画面 ("Something went wrong!") になり、"The following error wasn't caught by any route!" の warn が出る。route の境界は投げ直す前に `notFound()` に自分の routeId を付け、root の `notFoundComponent` は自分の routeId でない not found を受けない (`Match.tsx` の `MatchView`) |
| root                                                                                 | root の `notFoundComponent` が root の component を置き換えて出る。本番の root では component が文書の骨格を描くので、骨格ごと無くなる (`Match.tsx` の `MatchView` の読み。本番の root では測っていない)                                                                                                                                 |
| root 以外で `notFoundComponent` を持つ                                               | その route の not found が、その route の component を置き換えて出る (下の「調査結果」の client の表の、両方の部品を持つページ)                                                                                                                                                                                                          |

- route の wrapper のテストで route tree の root を差し替えるときは、root に本番の root と同じ失敗の部品を持たせ、`errorComponent` には `HeadContent` を添え、router に `notFoundMode: "root"` を渡す。部品が無いと、どの route も受けない失敗が root の外へ抜け、組み込みの `ErrorComponent` と "wasn't caught by any route" の warn が出る。`HeadContent` が無いと、root が受けた失敗で title が反映されない (`docs/guides/testing/real-router.md`「route の wrapper をテストする」)
- 既定の部品が無いことと `notFoundMode` は `src/router.test.ts` が、本番の root の route が `notFoundComponent` と `errorComponent` を持つことは `src/routes/root-document.test.ts` が見る。祖先の部品が受けることと、祖先が無ければ root が受けることは `src/components/screens/route-error.test.tsx` がテストの route tree で見る

## 調査結果

### client (2026-10-28、Vitest の browser mode、本物の router、`@tanstack/react-router` 1.170.41)

構成: root と、`<Outlet />` を描くページの route だけが `errorComponent` と `notFoundComponent` を持つ。router の既定の部品は無い。子の route は部品を持たない。

| 場面                                                                    | `notFoundMode: "root"`                                           | `fuzzy`                                                        |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| 子の loader の `notFound()`                                             | ページの not found がページを置き換える (ページの `<h1>` は無い) | 同じ                                                           |
| 子の loader のエラー                                                    | ページのエラーがページを置き換える                               | 同じ                                                           |
| 子の描画中の `notFound()`                                               | ページの not found がページを置き換える                          | 同じ                                                           |
| 子の描画中のエラー                                                      | ページのエラーがページを置き換える                               | 同じ                                                           |
| ページの下の存在しない URL                                              | root の not found                                                | ページの not found がページの中に出る (ページの `<h1>` が残る) |
| ページ自身の loader の `notFound()` (自分の `notFoundComponent` を持つ) | 自分の not found がページを置き換える                            | 同じ                                                           |
| ページ自身の描画中の `notFound()` (同上)                                | 自分の not found がページを置き換える                            | 同じ                                                           |

### `notFound()` を投げる場所と部品の構成 (2026-10-28、Vitest の browser mode、本物の router、`@tanstack/react-router` 1.170.41)

route tree: root (component は root のレイアウトの印と `<Outlet />` を描き、`errorComponent` を持つ) → ページ `/p` (`<h1>` と `<Outlet />` を描く) → 子 `/p/render` (component が `notFound()` を投げる) と `/p/loader` (loader が `notFound()` を投げる)。

| 構成                                                                                                                                                             | 子の loader の `notFound()`                                                            | 子の描画中の `notFound()`                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| router に `defaultErrorComponent` と `defaultNotFoundComponent`、`notFoundMode` は既定 (`fuzzy`)、root は `notFoundComponent` を持たない、ページは部品を持たない | 既定の not found の部品がページの中に出る (ページの `<h1>` と root のレイアウトが残る) | どの route にも受けられない。アプリ全体が組み込みの "Something went wrong!" になり、"The following error wasn't caught by any route!" の warn が出る |
| 既定の部品は無い、`notFoundMode: "root"`、root は両方の部品を持つ、ページは `errorComponent` だけを持つ                                                          | root の not found が root のレイアウトの中に出る                                       | どの route にも受けられない。組み込みの "Something went wrong!" と warn                                                                              |
| 既定の部品は無い、`notFoundMode: "root"`、root は両方の部品を持つ、ページは部品を持たない                                                                        | root の not found が root のレイアウトの中に出る                                       | root の `notFoundComponent` が root の component を置き換えて出る (root のレイアウトが無い)                                                          |

ページ自身の component が描画中に投げた `notFound()` も、ページが `errorComponent` だけを持つ構成で、どの route にも受けられなかった。

### server (2026-10-28、`router.load()` のあとの `renderToString`。Start を通していない)

構成: root が両方の部品を持ち、ページの route は `errorComponent` だけを持つ。`notFoundMode: "root"`、既定の部品は無い。

| 場面                                                                        | server の HTML                                                       |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| ページ自身の loader の失敗                                                  | ページのエラーの部品                                                 |
| 部品を持たない子の loader の失敗                                            | ページの中、子の位置に組み込みの英語の画面 ("Something went wrong!") |
| 子の loader の `notFound()` (ページは `notFoundComponent` を持たない)       | root の not found                                                    |
| ページ自身の loader の `notFound()` (自分の `notFoundComponent` を持たない) | root の not found                                                    |
| ページの下の存在しない URL、どこにも当たらない URL                          | root の not found                                                    |

## 出典

- TanStack Router docs「Not Found Errors」(「Throwing your own notFound errors」と「Throwing Not Found Errors in Components」を含む): https://tanstack.com/router/latest/docs/framework/react/guide/not-found-errors
- `TanStack/router#5311` (Solid、2025-09-30 に closed。component から投げた `notFound()` へのメンテナの回答): https://github.com/TanStack/router/issues/5311
- `@tanstack/react-router` 1.170.41 の `Match.tsx` の `MatchView` (境界を張る条件、境界の `onCatch` と `CatchNotFound` の投げ直し): https://github.com/TanStack/router/blob/57e126e99dbd86f735ead2ba98ba5e98ef0cc668/packages/react-router/src/Match.tsx#L80-L192
- `@tanstack/react-router` 1.170.41 の `Match.tsx` の `MatchInner` の `status` が `"error"` の分岐 (server では祖先を見ずに描く): https://github.com/TanStack/router/blob/57e126e99dbd86f735ead2ba98ba5e98ef0cc668/packages/react-router/src/Match.tsx#L241-L261
- `@tanstack/react-router` 1.170.41 の `Match.tsx` の `Outlet` (root の `_notFound` で `notFoundComponent` を描く): https://github.com/TanStack/router/blob/57e126e99dbd86f735ead2ba98ba5e98ef0cc668/packages/react-router/src/Match.tsx#L313-L319
- `@tanstack/react-router` 1.170.41 の `Matches.tsx` の外側の `CatchBoundary` (組み込みの `ErrorComponent` と warn): https://github.com/TanStack/router/blob/57e126e99dbd86f735ead2ba98ba5e98ef0cc668/packages/react-router/src/Matches.tsx#L104-L121
- router-core 1.171.34 の `load-client.ts` の `reduceLane` (境界の match の `status` と `_notFound`): https://github.com/TanStack/router/blob/57e126e99dbd86f735ead2ba98ba5e98ef0cc668/packages/router-core/src/load-client.ts#L1183-L1206
- router-core 1.171.34 の `load-client.ts` の `getNotFoundBoundary` (`notFoundMode` を読まない): https://github.com/TanStack/router/blob/57e126e99dbd86f735ead2ba98ba5e98ef0cc668/packages/router-core/src/load-client.ts#L969-L1002
- router-core 1.171.34 の `router.ts` の `findGlobalNotFoundRouteId`: https://github.com/TanStack/router/blob/57e126e99dbd86f735ead2ba98ba5e98ef0cc668/packages/router-core/src/router.ts#L3025-L3043
- TanStack Router API「RouterOptions type」(`defaultErrorComponent`、`defaultNotFoundComponent`、`notFoundMode`): https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType
- TanStack Router API「RouteOptions type」(`errorComponent`、`notFoundComponent`): https://tanstack.com/router/latest/docs/framework/react/api/router/RouteOptionsType
- TanStack Start docs「Selective SSR」: https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr
- React Router docs「Error Boundaries」: https://reactrouter.com/how-to/error-boundary
- Next.js docs「error.js」: https://nextjs.org/docs/app/api-reference/file-conventions/error
