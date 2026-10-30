# セキュリティヘッダ

`routeRules` の `"/**"` で付けるセキュリティヘッダと、root route の `headers` で返す CSP の変え方、`nitro()` を使わない構成へ移すときの付け直し、その形にした理由とヘッダごとの効き方を持つ。

| 決定                                                                                                                    | ADR      |
| ----------------------------------------------------------------------------------------------------------------------- | -------- |
| SSR の HTML の応答には、router を作るときに作る request ごとの nonce で strict CSP を付け、root route の headers で返す | ADR-0046 |

## how-to

### ヘッダを足す・変える

1. `vite.config.ts` の `nitro()` の `routeRules["/**"].headers` を書き換える
2. `scripts/checks/runtime/security-headers.ts` の `EXPECTED_HEADERS` を同じ値に揃える。定数を共有せず写しで持つ理由は、そのファイルの docstring にある
3. `vp run verify:build` のあとに `vp run verify:security-headers` を走らせ、全件が `/` の応答と、route の無い path の 404 の応答に乗ることを見る。404 も見る理由は、そのファイルの docstring にある

| 対象                                               | 起きること                                                                                                                    | 対処                                                      |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| CSP を `routeRules` に書く                         | nonce が全レスポンスで同じ値になり、推測できない値という前提が崩れる                                                          | root route の `headers` で返す (「CSP を変える・広げる」) |
| `Strict-Transport-Security` の `includeSubDomains` | 配信するドメインのサブドメインすべてが、`max-age` の間 HTTPS に固定される ([MDN「Strict-Transport-Security」][])              | http でしか配信しないサブドメインがあるなら外す           |
| `nitro()` を外す                                   | `routeRules` ごとヘッダが消える。設定にもビルドにもエラーは出ない (`scripts/checks/runtime/security-headers.ts` の docstring) | 「`nitro()` を使わない構成へ移す」の手順で付け直す        |

### CSP を変える・広げる

CSP は `src/routes/__root.tsx` の `headers` が、router の `ssr.nonce` を使って SSR の HTML の応答に付ける (ADR-0046)。ディレクティブを変えるときは次の順で進める。

1. `src/routes/__root.tsx` の `headers` が返すディレクティブを書き換える
2. `scripts/checks/runtime/security-headers.ts` の `EXPECTED_CSP` を同じ値に揃える。nonce の位置は `{nonce}` のまま残す
3. `vp run verify:build` のあとに `vp run verify:security-headers` を走らせる
4. ブラウザで、ページの表示・client 側の遷移・ダイアログの開閉・戻るを通し、`securitypolicyviolation` が 0 件であることを見る (「違反を集める」)

`<script>` を足すときは、置き場所で nonce が付くかが決まる。

| 足す script                                                            | 置き場所                                                                                                                                | 付かないと起きること                                         |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 外部の script (解析・計測のローダーなど)                               | route の `head.scripts` か `scripts` に `src` で書く。`HeadContent` と SSR の body が nonce を付ける                                    | JSX に直接書いた `<script>` は nonce を持たず、実行されない  |
| その script が読み込む script                                          | 足さなくてよい。nonce を持つ script が作った script は `'strict-dynamic'` が実行させる ([web.dev「Strict CSP」][])                      | -                                                            |
| inline の script                                                       | route の `head.scripts` に `children` で書く。nonce は付くが、hydration のあとに同じ script が重複して足されうる (TanStack/router#8550) | -                                                            |
| Base UI の `Tabs.Indicator`・`Slider.Thumb` の `renderBeforeHydration` | Base UI の `CSPProvider` に nonce を渡す ([Base UI docs「CSP Provider」][])。このテンプレートでは試していない                           | Base UI が描く inline script が nonce を持たず、実行されない |

- inline のイベントハンドラ (`onclick="…"` の属性) と `javascript:` の URL は、nonce の CSP では実行されない。React の `onClick` は属性を描かないので当たらない
- HTML の応答をキャッシュする page では、nonce が応答をまたいで使い回され、CSP が成り立たない (ADR-0046)。HTML をキャッシュするなら、その page の CSP を設計し直す

### ポリシーを広げる前に Report-Only で試す

`style-src` のように、いま止めていない種類の資源を止めるディレクティブを足すときは、先に `Content-Security-Policy-Report-Only` で配って違反を数える。Report-Only は違反を止めない ([web.dev「Strict CSP」][])。違反は `securitypolicyviolation` の event に `disposition: "report"` で出る (`vp dev` で 2026-10-31 に確かめた)。

1. root route の `headers` の戻り値に、いまの `Content-Security-Policy` と並べて `Content-Security-Policy-Report-Only` を足し、試すディレクティブを書く。nonce を使うなら同じ `ssr.nonce` を入れる
2. 「違反を集める」の手順で、ページを一通り操作して違反を集める。テンプレートには報告先 (`report-to`) が無いので、ブラウザの event で見る
3. 違反を、コードを直すか、ディレクティブを広げるかで解消する
4. 違反が 0 件になったら、Report-Only の行を `Content-Security-Policy` に入れ、「CSP を変える・広げる」の手順で検査を揃える

`style-src` を足すと、このテンプレートでは次が止まる (`vp dev` で 2026-10-31 に観測)。

| 止まるもの                                                                                     | ディレクティブ   | 解消の道筋                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SSR が描く `style` 属性 (`src/components/parts/data-table.tsx` と `table-skeleton.tsx` の列幅) | `style-src-attr` | `style-src-attr` に `'unsafe-inline'` を置いて属性だけを緩めるか、列幅を `style` 属性で描かない形に変える ([Base UI docs「CSP Provider」][] の Inline style attributes) |
| client 側の遷移で Base UI が差し込む `<style>` (`base-ui-disable-scrollbar`)                   | `style-src-elem` | Base UI の `CSPProvider` に nonce を渡すか、`disableStyleElements` で消す ([Base UI docs「CSP Provider」][])                                                            |
| 開発時の devtools が差し込む `<style>`                                                         | `style-src-elem` | 本番ビルドでは差し込まれなかった (2026-10-31)。`vp dev` で試すときは、devtools の分を数えから外す                                                                       |

### 違反を集める

CSP の違反は、`securitypolicyviolation` の event をページの script より先に登録して集める。event はディレクティブと止めた資源を持つので、ページごと・ディレクティブごとに数えられる。ページの script より先に走らせる口 (Playwright の `page.addInitScript`、chrome-devtools の MCP の `navigate_page` の `initScript`) に次を渡し、操作のあとに `window.__cspViolations` を読む。

```js
window.__cspViolations = [];
document.addEventListener(
  "securitypolicyviolation",
  (e) => {
    window.__cspViolations.push({
      directive: e.effectiveDirective,
      disposition: e.disposition,
      blocked: e.blockedURI,
      source: e.sourceFile,
    });
  },
  true,
);
```

- 読み込んだあとに登録すると、hydration の間の違反を取りこぼす
- 集め方が効いているかは、`<img src="data:," onerror="1">` を差し込んで `script-src-attr` の違反が 1 件出ることで確かめる

### `nitro()` を使わない構成へ移す

TanStack Start の公式の手順のうち、Cloudflare Workers と Netlify は `nitro()` を使わない ([TanStack Start docs「Hosting」][]。Cloudflare Workers は `@cloudflare/vite-plugin` と `wrangler.jsonc`、Netlify は `@netlify/vite-plugin-tanstack-start` で組む)。そこへ移すときは次の順で付け直す。

1. ヘッダを付け直す先を決める。候補は `src/start.ts` の `requestMiddleware` で、Start が処理するリクエスト (SSR・server route・server function) に掛かる ([TanStack Start docs「Middleware」][] の Global Request Middleware)。静的な asset の応答は Start を通らない可能性があるが、確かめていない。`requestMiddleware` でレスポンスヘッダを付ける形も、このリポジトリで試していない
2. `scripts/checks/runtime/security-headers.ts` を移した先の起動方法に合わせて書き直す。いまの検査は Nitro のビルド出力 `.output/server/index.mjs` を起動し、`/` の応答と、route の無い path の 404 の応答 (`CHECKED_RESPONSES`) だけを見る。CSP は root route の `headers` が返すので、`nitro()` を外しても付き続ける
3. `vite.config.ts` から `nitro()` を外し、書き直した検査で全件が `/` と 404 の応答に乗ることを見る
4. 静的な asset の URL (ビルド出力の JS や CSS) の応答にも全件が乗ることを確かめる。`/` と 404 しか見ない検査は、asset に乗っていなくても落ちない

## explanation

### `routeRules` に置く理由

- `routeRules` の `headers` は、route の pattern に一致したリクエストの応答にヘッダを付ける ([Nitro docs「Routing」][] の Route rules。`routeRules` は redirect、proxy、cache、認証にも使う)。`"/**"` は全 route に一致する
- エラーの応答 (404、SSR の 500) にも乗る。h3 は 400 以上の応答に、用意したヘッダのうち `event.res.errHeaders` だけを合わせ ([h3 docs「Sending Response」][])、Nitro が取り込む h3 の `headers` の rule は、そこにも書く (`nitro` 3.0.260903-beta、2026-10-31 に実測)
- route rules が届かない応答には乗らない。h3 は percent-encoding の壊れた URL を、routing と middleware より前に 400 で弾く ([h3 の `src/h3.ts`][] の `allowMalformedURL`)。この応答は検査しない
- `routeRules` は Nitro の設定で、preset ごとの設定ではない。`nitro()` を使う限り、preset を替えても書き換えずに済む。`nitro()` を外す構成へ移るときは付け直す (「`nitro()` を使わない構成へ移す」)
- 応答に乗ることは、設定値ではなくビルド成果物を起動して確かめる。設定値の検査で代替できない理由は `scripts/checks/runtime/security-headers.ts` の docstring にある

置き場所の候補は次の 3 つである。評価は、2026-09-30 に docs と `dist` で確かめた事実だけで書く。

| 候補                                                                | 評価                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 採否                                           |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Nitro の `routeRules.headers`                                       | 1 か所に書けば Nitro のサーバが応答に付ける ([Nitro docs「Routing」][])。Cloudflare の preset (`cloudflare-pages`、`cloudflare-pages-static`、`cloudflare-module`) と Netlify の preset (`netlify`、`netlify-edge`、`netlify-static`) は `_headers` へ、Vercel の preset (`vercel`、`vercel-static`) は `config.json` の `routes` へも書き出す (`nitro` 3.0.260903-beta の `dist/_presets.mjs` の `writeCFHeaders`、`writeHeaders`、`generateBuildConfig`)。`nitro()` を外すと消える | **採用**                                       |
| Start の `requestMiddleware` (`src/start.ts`)                       | Start が処理するリクエスト (SSR・server route・server function) に掛かる ([TanStack Start docs「Middleware」][])。Start を通らない応答 (静的な asset など) に掛かるかは確かめていない。`nitro()` を外しても残る                                                                                                                                                                                                                                                                      | 却下。`nitro()` を外すときの移し先の候補にする |
| プラットフォーム側の設定 (`_headers`、Vercel の `config.json` など) | 配信先ごとに書き方が違い、配信先を替えるたびに書き直す。`scripts/checks/runtime/security-headers.ts` は Nitro のサーバを起動して応答を見るので、プラットフォーム側の設定は検査に入らない。`nitro()` を使う間は、Nitro が `routeRules.headers` から同じ設定を書き出す                                                                                                                                                                                                                 | 却下                                           |

### CSP を `routeRules` ではなく root route の `headers` で返す理由

決定と却下した案は ADR-0046 が持つ。ここでは、その前提になる仕組みを書く。

- nonce を使う CSP は、レスポンスごとに推測できない値へ変える必要がある ([MDN「Content Security Policy (CSP)」][]: "the nonce must be different for every HTTP response, and must not be predictable.")
- `routeRules` の `headers` は `Record<string, string>` の静的な値しか取れない ([Nitro docs「Routing」][] の Route rules reference)。`runtimeConfig` から与える形 (Runtime route rules) も、環境変数で差し替えるだけでリクエストごとには変わらない
- HTML の `<script>`・`<link>`・`<style>` の nonce は、router の `ssr.nonce` が決める。`HeadContent` と SSR の body の script がこの値を付ける ([TanStack Start docs「CSS Styling」][] の Tradeoffs も、`HeadContent` が `<style>` に付けると書く)。route の `headers` は同じ `ssr` を受け取るので、ヘッダと HTML の nonce が揃う

### ヘッダごとの効き方

値は `vite.config.ts` が持つ。効き方の出典は各ヘッダの MDN のページで、2026-09-30 に確かめた。

| ヘッダ                         | 効き方                                                                                                                                                                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `X-Content-Type-Options`       | `nosniff` で MIME スニッフィングを止める。`script` と `style` の要求では MIME type が合わない応答をブラウザが止め、他の応答も `Content-Type` のまま扱う ([MDN「X-Content-Type-Options」][])                                                        |
| `X-Frame-Options`              | `DENY` で、どの origin の frame にも読み込ませない。clickjacking を防ぐ ([MDN「X-Frame-Options」][])。CSP が付く HTML の応答では CSP の `frame-ancestors` が優先され、CSP が付かない応答 (JSON や静的な asset) ではこのヘッダだけが効く (ADR-0046) |
| `Referrer-Policy`              | `strict-origin-when-cross-origin` で、別 origin への要求には origin だけを送り、HTTPS から HTTP へは送らない。path とクエリが外部へ漏れない。値はブラウザの既定と同じ ([MDN「Referrer-Policy」][])                                                 |
| `Cross-Origin-Opener-Policy`   | `same-origin` で、別 origin の文書と browsing context group を分ける。`window.open()` の戻り値から global object に届かせない ([MDN「Cross-Origin-Opener-Policy」][])                                                                              |
| `Cross-Origin-Resource-Policy` | `same-origin` で、別 origin からの `no-cors` の読み込みをブラウザが止める ([MDN「Cross-Origin-Resource-Policy」][])                                                                                                                                |
| `Strict-Transport-Security`    | 以後の http のアクセスを HTTPS へ上げ、証明書のエラーを利用者が飛ばせなくする。`includeSubDomains` でサブドメインにも掛かる ([MDN「Strict-Transport-Security」][])                                                                                 |

`Strict-Transport-Security` は、HTTPS で受け取った応答でだけ効く。http の応答に載っても、ブラウザは無視する ([RFC 6797][] の 8.1 節: "If an HTTP response is received over insecure transport, the UA MUST ignore any present STS header field(s).")。`vp dev` と、`scripts/checks/runtime/security-headers.ts` が起動するサーバは http で応答するので、手元のブラウザが HTTPS に固定されることは無い。

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。Nitro は 3.0.260903-beta、TanStack Start は `@tanstack/react-start` 1.168.58、Base UI は 1.9.0 に固定した版を指す。web.dev と Base UI docs は 2026-10-31 に確かめた。

[Nitro docs「Routing」]: https://github.com/nitrojs/nitro/blob/v3.0.260903-beta/docs/1.docs/5.routing.md
[h3 docs「Sending Response」]: https://github.com/h3js/h3/blob/v2.0.2/docs/1.guide/1.basics/5.response.md
[h3 の `src/h3.ts`]: https://github.com/h3js/h3/blob/v2.0.2/src/h3.ts
[TanStack Start docs「Hosting」]: https://github.com/TanStack/router/blob/@tanstack/react-start@1.168.58/docs/start/framework/react/guide/hosting.md
[TanStack Start docs「CSS Styling」]: https://github.com/TanStack/router/blob/@tanstack/react-start@1.168.58/docs/start/framework/react/guide/css-styling.md
[TanStack Start docs「Middleware」]: https://github.com/TanStack/router/blob/@tanstack/react-start@1.168.58/docs/start/framework/react/guide/middleware.md
[MDN「Content Security Policy (CSP)」]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP
[web.dev「Strict CSP」]: https://web.dev/articles/strict-csp
[Base UI docs「CSP Provider」]: https://base-ui.com/react/utils/csp-provider
[MDN「X-Content-Type-Options」]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options
[MDN「X-Frame-Options」]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options
[MDN「Referrer-Policy」]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy
[MDN「Cross-Origin-Opener-Policy」]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy
[MDN「Cross-Origin-Resource-Policy」]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Resource-Policy
[MDN「Strict-Transport-Security」]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security
[RFC 6797]: https://www.rfc-editor.org/rfc/rfc6797
