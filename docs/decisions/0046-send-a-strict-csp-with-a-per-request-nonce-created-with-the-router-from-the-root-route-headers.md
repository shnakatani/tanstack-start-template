# ADR-0046: SSR の HTML の応答には、router を作るときに作る request ごとの nonce で strict CSP を付け、root route の headers で返す

- Status: Accepted
- Date: 2026-10-31

## Context

静的なセキュリティヘッダ 6 つは `vite.config.ts` の `nitro({ routeRules })` が全応答に付ける (`docs/guides/security-headers.md`「`routeRules` に置く理由」)。XSS で差し込まれた script の実行を止める CSP は、この 6 つに含まれない。

nonce を使う CSP には、満たす条件が 2 つある。

| 条件                                                                | 出典                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| nonce を応答ごとに作り直し、推測できない値にする                    | CSP Level 3 の 7.1 節 "the server MUST generate a unique value each time it transmits a policy. The generated value SHOULD be at least 128 bits long (before encoding)"。MDN も "the nonce must be different for every HTTP response" |
| ヘッダの nonce と、HTML のすべての `<script>` の nonce を一致させる | 一致しない script は実行されない。SSR が描く inline script (hydration の `data-tsr-stream-part` など) も対象になる                                                                                                                    |

TanStack Start では、router の `ssr.nonce` が HTML 側の nonce を決める。`HeadContent` と SSR の body の script は、`router.options.ssr.nonce` を `<script>`・`<link>`・`<style>` の `nonce` 属性に付ける (react-router 1.170.46 の `dist/esm/headContentUtils.js`、router-core 1.171.39 の `dist/esm/ssr/bodyScripts.js` と `dist/esm/ssr/hydrationScripts.js`)。
route の `headers` には `ssr` が渡り、ヘッダ側も同じ値を読める (TanStack/router#6359)。TanStack Router docs「RouteOptions type」の `headers` の型には `ssr` がまだ載っていない (`@tanstack/react-start` 1.169.4 の時点)。

TanStack の docs に CSP の配線の案内は無い (nonce に触れるのは TanStack Start docs「CSS Styling」の Tradeoffs だけ)。上流の先行例は TanStack/router の e2e `e2e/react-start/csp` である ([e2e の router][] と [e2e の root route][])。`getRouter()` の中で `createIsomorphicFn().server(...)` が nonce を作って `ssr` に渡し、root route の `headers` が `ssr.nonce` で CSP を返す。

## Decision

**SSR の HTML の応答に、`script-src 'nonce-{nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'` の CSP を付ける。nonce は `src/router.tsx` の `getRouter()` の中で `createIsomorphicFn().server(...)` が request ごとに作って router の `ssr` に渡し、CSP は `src/routes/__root.tsx` の `headers` が `ssr.nonce` で返す。静的な 6 つのヘッダは `routeRules` に残す。**

### ポリシー

| ディレクティブ                                | 効き方                                                                                                                                                                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `script-src 'nonce-{nonce}' 'strict-dynamic'` | nonce を持つ script だけを実行し、それが作った script も実行させる。web.dev「Strict CSP」と OWASP の CSP Cheat Sheet が勧める nonce の strict CSP と同じ形                                                             |
| `object-src 'none'`                           | `<object>` と `<embed>` を読み込ませない。web.dev と OWASP の strict CSP の形に含まれる                                                                                                                                |
| `base-uri 'none'`                             | `<base>` を差し込んで相対 URL の script の読み先を変える攻撃を止める。web.dev と OWASP の strict CSP の形に含まれる                                                                                                    |
| `frame-ancestors 'none'`                      | どの origin の frame にも読み込ませない。CSP が付く応答では `X-Frame-Options` より優先される (OWASP の CSP Cheat Sheet: "`X-Frame-Options` is rendered obsolete by this directive and is ignored by the user agents.") |

- nonce は Web Crypto の `crypto.getRandomValues` で 16 byte (128 bit) を作り、base64 にする。web.dev は "Base64 encoded" と "128+ bits" を求め、CSP Level 3 の `nonce-source` の文法は `base64-value` である。TanStack/router の e2e は同じ 16 byte を hex にしている。hex の文字は `base64-value` の文字に含まれるので、どちらも文法を満たす
- `style-src` は置かない。理由は「検討した選択肢」の `style-src` の行

### nonce を作る場所と CSP を返す場所

| 役割                 | 置き場所                                                                        | 理由                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| nonce を作る         | `getRouter()` の中の `createIsomorphicFn().server(...)` の戻り値を `ssr` に渡す | Start は request ごとに `getRouter()` を呼ぶので (start-server-core 1.169.45 の `dist/esm/createStartHandler.js`)、request ごとに値が変わる。router に SSR の utils が付いたあと (`attachRouterServerSsrUtils`) に `ssr.nonce` を書き換えると、hydration の inline script に nonce が付かない (TanStack/router#8789、router-core 1.171.31 以降の `dist/esm/ssr/ssr-server.js`) |
| クライアントの nonce | 作らない (`.client(...)` を置かない)                                            | クライアントの router は `HeadContent` が描く `<meta property="csp-nonce">` から nonce を読む (router-core 1.171.39 の `dist/esm/load-client.js`)                                                                                                                                                                                                                              |
| CSP を返す           | root route の `headers`                                                         | root はどの URL の match にも入るので、1 か所で全ページに掛かる。`ssr.nonce` をそのまま読める                                                                                                                                                                                                                                                                                  |

### request middleware を使わない理由

request middleware (`src/start.ts` の `requestMiddleware`) は SSR の request にも掛かる (TanStack Start docs「Middleware」の Global Request Middleware)。ただし HTML 側の nonce は router の `ssr.nonce` が決めるので、middleware で nonce を作ると、request の context を通して `getRouter()` へ渡す配線が別に要る (TanStack/router#8789 の回避策の形)。root の `headers` なら `ssr.nonce` を直接読めるので、その配線が要らない。公式の e2e も root の `headers` で返す。middleware で CSP を付ける形は、このリポジトリで試していない。

root の `headers` が CSP を付ける応答は次のとおりである。本番ビルドを起動し、表の「確かめ方」の URL を取得して確かめた (2026-10-31、`@tanstack/react-start` 1.169.4、nitro 3.0.260903-beta)。

| 応答                                                               | CSP      | 確かめ方                                                                                                                     |
| ------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| SSR の 200                                                         | 付く     | `/` を取得                                                                                                                   |
| どの route にも当たらない URL の 404 (root の `notFoundComponent`) | 付く     | 存在しない path を取得                                                                                                       |
| SSR の loader が throw した 500                                    | 付く     | DB のファイルが無い状態で、loader で DB を読む route を取得                                                                  |
| request middleware が返す応答                                      | 付かない | 別 origin の `Origin` を付けて `/_serverFn/<id>` に POST し、CSRF の middleware が返す 403 (`text/plain`) を見た             |
| server route と server function の応答                             | 付かない | 観測していない。root の `headers` は SSR で match を描くときだけ呼ばれる (router-core 1.171.39 の `dist/esm/load-server.js`) |
| 静的な asset                                                       | 付かない | ビルド出力の CSS を取得                                                                                                      |

### 静的な 6 つを `routeRules` に残す理由

- 6 つの値は request ごとに変わらないので、`routeRules` で全応答に付けられる。CSP と違い、Start を通らない静的な asset の応答にも乗る
- `X-Frame-Options` も残す。CSP が付く応答では `frame-ancestors` が優先されるが、CSP が付かない応答 (上の表の「付かない」の行) の frame への読み込みは `X-Frame-Options` だけが止める

### CSP が付かない応答を許す理由

JSON・`text/plain`・CSS・JS の応答は、ブラウザが文書として script を実行しない。`X-Content-Type-Options: nosniff` が `Content-Type` のまま扱わせ、`X-Frame-Options` が frame への読み込みを止める。CSP が止めたいのは HTML の文書の中で実行される script なので、HTML を描く SSR の応答に付けば足りる。

### 検討した選択肢

| 案                                                                                                             | 評価                                                                                                                                                                                                                                                                                                                                                                                                           | 採否     |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| nonce を `getRouter()` で作り、root の `headers` で CSP を返す                                                 | TanStack/router の e2e と同じ配線。200・404・SSR の 500 の HTML に付く                                                                                                                                                                                                                                                                                                                                         | **採用** |
| hash の CSP (`'sha256-…'`)                                                                                     | 静的な値で書けるが、SSR の inline script は同じ URL でも応答ごとに中身が変わる。`/` を 2 回取得すると、`data-tsr-stream-part` の script の中の各 match の `u:` (描画時刻) が違った (2026-10-31、本番ビルド)。web.dev も hash の CSP を静的な HTML とキャッシュする page 向けとしている                                                                                                                         | 却下     |
| `routeRules` に nonce の CSP を書く                                                                            | `routeRules` の `headers` は静的な値しか取れず (Nitro docs「Routing」の Route rules)、nonce が全応答で同じになる                                                                                                                                                                                                                                                                                               | 却下     |
| e2e と同じポリシー (`default-src 'self'; script-src 'self' 'nonce-{nonce}'; style-src 'self' 'nonce-{nonce}'`) | host の allowlist で読み込み先を絞る形で、`'strict-dynamic'` を持たない。web.dev と OWASP は、nonce の付いた script が読み込む script を信頼する `'strict-dynamic'` の形を勧める。`default-src 'self'` は `connect-src`・`img-src`・`frame-src` なども同じ origin に絞るが、それらは XSS の script の実行を止める層ではなく、外部の API や画像を足すたびにポリシーを書き換えることになる。`style-src` は下の行 | 却下     |
| `script-src` に `https:` と `'unsafe-inline'` の fallback を足す (web.dev の古いブラウザ向けの形)              | web.dev は「If you need to support older browser versions」として、`'strict-dynamic'` を持たない古い Safari のために `https:` を足す形を示す。テンプレートのビルドの既定の target は Safari 16.4 以上 (Vite の `baseline-widely-available`、`@voidzero-dev/vite-plus-core` 1.4.0 の `ESBUILD_BASELINE_WIDELY_AVAILABLE_TARGET`) で、`'strict-dynamic'` の無い Safari ではアプリの JS 自体が動かない            | 却下     |
| `style-src 'self' 'nonce-{nonce}'` を足す (e2e と同じ形)                                                       | `vp dev` で 2026-10-31 に足して `securitypolicyviolation` を数えた。SSR が描く `style` 属性 (`src/components/parts/data-table.tsx` と `table-skeleton.tsx` の列幅) が `style-src-attr` で止まり、client 側の遷移で Base UI が差し込む `<style>` (`base-ui-disable-scrollbar`) と、開発時の devtools が差し込む `<style>` が `style-src-elem` で止まった                                                        | 却下     |
| `Content-Security-Policy-Report-Only` で配る                                                                   | 違反を止めず報告だけする。違反はブラウザの `securitypolicyviolation` には出るが、報告先 (`report-to`) が無いとサーバには何も届かない。テンプレートは報告先を持たない                                                                                                                                                                                                                                           | 却下     |
| CSP を付けない                                                                                                 | XSS で差し込まれた script の実行を止める層が無い。採用した案は公式の e2e の形で組め、表示と操作で違反が出なかった (Consequences) ので、付けない理由が残らない                                                                                                                                                                                                                                                  | 却下     |

## Consequences

- `vp run verify:security-headers` が、`/` の 2 回の応答で、CSP がこの ADR の形であること、HTML のすべての `<script>` がヘッダと同じ nonce を持つこと、nonce が応答ごとに違うことを見る (`scripts/checks/runtime/security-headers.ts`、判定は `scripts/lib/csp-nonce.ts`)。期待するポリシーは検査の側に写しで持つので、ポリシーを変えたら両方を直す
- 本番ビルドと `vp dev` で、ページの表示、client 側の遷移、ダイアログの開閉、戻るを通して `securitypolicyviolation` は 0 件だった (2026-10-31、Chrome)。hydration のあとの `<script type="module">` は entry の 1 本だけで、TanStack/router#8550 の重複は起きなかった。entry が `src` 付きの module script で、TanStack/router#8550 が重複させる inline の script を持たないため
- HTML の応答を CDN などでキャッシュすると、同じ nonce が複数の応答で使い回され、CSP Level 3 の 7.1 節の "unique value each time it transmits a policy" を満たさない。HTML をキャッシュする page では nonce の CSP は成り立たない。テンプレートは HTML をキャッシュしない
- nonce は `<meta property="csp-nonce">` として HTML に出る。クライアントの router がここから読むためで、TanStack の仕組みである
- `<script>` を足すときは route の `head.scripts` か `scripts` に書く。`HeadContent` と SSR の body が nonce を付ける。JSX に直接書いた `<script>` には nonce が付かず止まる。nonce を持つ script が読み込む script は `'strict-dynamic'` が実行させるので、外部の script のローダーは 1 本を `head.scripts` に置けば足りる。手順は `docs/guides/security-headers.md`「CSP を変える・広げる」
- Base UI の `Tabs.Indicator` は `renderBeforeHydration` を付けると、`Slider.Thumb` は加えて `inset` の末尾の thumb のときに、inline script を描く (`@base-ui/react` 1.9.0 の `tabs/indicator/TabsIndicator.js` と `slider/thumb/SliderThumb.js`)。Base UI が描く inline の `<script>` と `<style>` は、nonce を `CSPProvider` から受け取る ([Base UI docs「CSP Provider」][])。テンプレートはどちらも使っていない
- 再評価の条件: TanStack/router#8790 が入り、SSR の utils が付いたあとに設定した nonce も hydration の script に届くようになったら、nonce を作る場所の制約が緩む。TanStack/router#8550 が直ったら、route の `head.scripts` に inline script を足すときの注意が要らなくなる

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。TanStack は `@tanstack/react-start` 1.169.4 (commit `6b9fe6d29552270836c511bc9b343d73541f4424`)、Nitro は 3.0.260903-beta に固定した版を指す。Base UI docs の URL は版を持たず、同じ内容が `@base-ui/react` 1.9.0 に同梱の `docs/react/utils/csp-provider.md` にある。上流の docs と issue は 2026-10-31 に確かめた。

[e2e の router]: https://github.com/TanStack/router/blob/6b9fe6d29552270836c511bc9b343d73541f4424/e2e/react-start/csp/src/router.tsx
[e2e の root route]: https://github.com/TanStack/router/blob/6b9fe6d29552270836c511bc9b343d73541f4424/e2e/react-start/csp/src/routes/__root.tsx
[Base UI docs「CSP Provider」]: https://base-ui.com/react/utils/csp-provider

- TanStack/router#6359「fix: make nonce accessible in headers」(route の `headers` に `ssr` を渡す口を足した PR。2026-01-17 に merge): https://github.com/TanStack/router/pull/6359
- TanStack/router#8789 (router を作ったあとに設定した `ssr.nonce` が hydration の script に届かない。open): https://github.com/TanStack/router/issues/8789
- TanStack/router#8790 (TanStack/router#8789 の修正の PR。open): https://github.com/TanStack/router/pull/8790
- TanStack/router#8550 (ヘッダで送った nonce が DOM で隠されるため、inline script の照合が外れて script を重複させる。open): https://github.com/TanStack/router/issues/8550
- TanStack Router docs「RouteOptions type」の `headers` method: https://github.com/TanStack/router/blob/6b9fe6d29552270836c511bc9b343d73541f4424/docs/router/api/router/RouteOptionsType.md
- CSP Level 3「7.1. Nonce Reuse」(nonce を送るたびに作り直し、128 bit 以上にする) と `nonce-source` の文法: https://www.w3.org/TR/CSP3/
- MDN「Content Security Policy (CSP)」("the nonce must be different for every HTTP response, and must not be predictable."): https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP
- web.dev「Mitigate cross-site scripting (XSS) with a strict Content Security Policy (CSP)」(nonce の strict CSP の形、nonce の作り方、hash の CSP が向く page、Report-Only での試し方): https://web.dev/articles/strict-csp
- OWASP「Content Security Policy Cheat Sheet」(strict CSP の形、`frame-ancestors` と `X-Frame-Options`): https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- TanStack Start docs「Middleware」(Global Request Middleware が SSR・server route・server function の request に掛かる): https://github.com/TanStack/router/blob/6b9fe6d29552270836c511bc9b343d73541f4424/docs/start/framework/react/guide/middleware.md
- Nitro docs「Routing」の Route rules (`headers` は静的な値): https://github.com/nitrojs/nitro/blob/v3.0.260903-beta/docs/1.docs/5.routing.md
