# セキュリティヘッダ

`routeRules` の `"/**"` で付けるセキュリティヘッダの足し方と、`nitro()` を使わない構成へ移すときの付け直し、その形にした理由とヘッダごとの効き方を持つ。

## how-to

### ヘッダを足す・変える

1. `vite.config.ts` の `nitro()` の `routeRules["/**"].headers` を書き換える
2. `scripts/checks/runtime/security-headers.ts` の `EXPECTED_HEADERS` を同じ値に揃える。定数を共有せず写しで持つ理由は、そのファイルの docstring にある
3. `vp build` のあとに `vp node scripts/checks/runtime/security-headers.ts` を走らせ、全件が `/` の応答に乗ることを見る。`.mise.toml` の `[tasks.verify]` と `.github/workflows/ci.yml` も同じ順で走らせる

| 対象                                               | 起きること                                                                                                                    | 対処                                               |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| CSP を `routeRules` に書く                         | nonce が全レスポンスで同じ値になり、推測できない値という前提が崩れる                                                          | `routeRules` に置かない (「CSP を置かない理由」)   |
| `Strict-Transport-Security` の `includeSubDomains` | 配信するドメインのサブドメインすべてが、`max-age` の間 HTTPS に固定される ([MDN「Strict-Transport-Security」][])              | http でしか配信しないサブドメインがあるなら外す    |
| `nitro()` を外す                                   | `routeRules` ごとヘッダが消える。設定にもビルドにもエラーは出ない (`scripts/checks/runtime/security-headers.ts` の docstring) | 「`nitro()` を使わない構成へ移す」の手順で付け直す |

### `nitro()` を使わない構成へ移す

TanStack Start の公式の手順のうち、Cloudflare Workers と Netlify は `nitro()` を使わない ([TanStack Start docs「Hosting」][]。Cloudflare Workers は `@cloudflare/vite-plugin` と `wrangler.jsonc`、Netlify は `@netlify/vite-plugin-tanstack-start` で組む)。そこへ移すときは次の順で付け直す。

1. ヘッダを付け直す先を決める。候補は `src/start.ts` の `requestMiddleware` で、Start が処理するリクエスト (SSR・server route・server function) に掛かる ([TanStack Start docs「Middleware」][] の Global Request Middleware)。静的な asset の応答は Start を通らない可能性があるが、確かめていない。`requestMiddleware` でレスポンスヘッダを付ける形も、このリポジトリで試していない
2. `scripts/checks/runtime/security-headers.ts` を移した先の起動方法に合わせて書き直す。いまの検査は Nitro のビルド出力 `.output/server/index.mjs` を起動し、`/` (`ORIGIN`) の応答だけを見る
3. `vite.config.ts` から `nitro()` を外し、書き直した検査で全件が `/` の応答に乗ることを見る
4. 静的な asset の URL (ビルド出力の JS や CSS) の応答にも全件が乗ることを確かめる。`/` しか見ない検査は、asset に乗っていなくても落ちない

## explanation

### `routeRules` に置く理由

- `routeRules` の `headers` は、route の pattern に一致したリクエストの応答にヘッダを付ける ([Nitro docs「Routing」][] の Route rules。`routeRules` は redirect、proxy、cache、認証にも使う)。`"/**"` は全 route に一致する
- `routeRules` は Nitro の設定で、preset ごとの設定ではない。`nitro()` を使う限り、preset を替えても書き換えずに済む。`nitro()` を外す構成へ移るときは付け直す (「`nitro()` を使わない構成へ移す」)
- 応答に乗ることは、設定値ではなくビルド成果物を起動して確かめる。設定値の検査で代替できない理由は `scripts/checks/runtime/security-headers.ts` の docstring にある

置き場所の候補は次の 3 つである。評価は、2026-09-30 に docs と `dist` で確かめた事実だけで書く。

| 候補                                                                | 評価                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 採否                                           |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Nitro の `routeRules.headers`                                       | 1 か所に書けば Nitro のサーバが応答に付ける ([Nitro docs「Routing」][])。Cloudflare の preset (`cloudflare-pages`、`cloudflare-pages-static`、`cloudflare-module`) と Netlify の preset (`netlify`、`netlify-edge`、`netlify-static`) は `_headers` へ、Vercel の preset (`vercel`、`vercel-static`) は `config.json` の `routes` へも書き出す (`nitro` 3.0.260610-beta の `dist/_presets.mjs` の `writeCFHeaders`、`writeHeaders`、`generateBuildConfig`)。`nitro()` を外すと消える | **採用**                                       |
| Start の `requestMiddleware` (`src/start.ts`)                       | Start が処理するリクエスト (SSR・server route・server function) に掛かる ([TanStack Start docs「Middleware」][])。Start を通らない応答 (静的な asset など) に掛かるかは確かめていない。`nitro()` を外しても残る                                                                                                                                                                                                                                                                      | 却下。`nitro()` を外すときの移し先の候補にする |
| プラットフォーム側の設定 (`_headers`、Vercel の `config.json` など) | 配信先ごとに書き方が違い、配信先を替えるたびに書き直す。`scripts/checks/runtime/security-headers.ts` は Nitro のサーバを起動して応答を見るので、プラットフォーム側の設定は検査に入らない。`nitro()` を使う間は、Nitro が `routeRules.headers` から同じ設定を書き出す                                                                                                                                                                                                                 | 却下                                           |

### CSP を置かない理由

- nonce を使う CSP は、レスポンスごとに推測できない値へ変える必要がある ([MDN「Content Security Policy (CSP)」][]: "the nonce must be different for every HTTP response, and must not be predictable.")
- `routeRules` の `headers` は `Record<string, string>` の静的な値しか取れない ([Nitro docs「Routing」][] の Route rules reference)。`runtimeConfig` から与える形 (Runtime route rules) も、環境変数で差し替えるだけでリクエストごとには変わらない
- CSP を足すときは、nonce の配線を router の `ssr.nonce` と対で設計する。TanStack Start は `ssr.nonce` を渡すと `HeadContent` が描く `<style>` に nonce を付ける ([TanStack Start docs「CSS Styling」][] の Tradeoffs)
- nonce ではなく hash を使う CSP は静的な値で書けるが、このリポジトリでは比べていない

### ヘッダごとの効き方

値は `vite.config.ts` が持つ。効き方の出典は各ヘッダの MDN のページで、2026-09-30 に確かめた。

| ヘッダ                         | 効き方                                                                                                                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `X-Content-Type-Options`       | `nosniff` で MIME スニッフィングを止める。`script` と `style` の要求では MIME type が合わない応答をブラウザが止め、他の応答も `Content-Type` のまま扱う ([MDN「X-Content-Type-Options」][])        |
| `X-Frame-Options`              | `DENY` で、どの origin の frame にも読み込ませない。clickjacking を防ぐ。CSP を足すときは `frame-ancestors` がより細かく指定できる ([MDN「X-Frame-Options」][])                                    |
| `Referrer-Policy`              | `strict-origin-when-cross-origin` で、別 origin への要求には origin だけを送り、HTTPS から HTTP へは送らない。path とクエリが外部へ漏れない。値はブラウザの既定と同じ ([MDN「Referrer-Policy」][]) |
| `Cross-Origin-Opener-Policy`   | `same-origin` で、別 origin の文書と browsing context group を分ける。`window.open()` の戻り値から global object に届かせない ([MDN「Cross-Origin-Opener-Policy」][])                              |
| `Cross-Origin-Resource-Policy` | `same-origin` で、別 origin からの `no-cors` の読み込みをブラウザが止める ([MDN「Cross-Origin-Resource-Policy」][])                                                                                |
| `Strict-Transport-Security`    | 以後の http のアクセスを HTTPS へ上げ、証明書のエラーを利用者が飛ばせなくする。`includeSubDomains` でサブドメインにも掛かる ([MDN「Strict-Transport-Security」][])                                 |

`Strict-Transport-Security` は、HTTPS で受け取った応答でだけ効く。http の応答に載っても、ブラウザは無視する ([RFC 6797][] の 8.1 節: "If an HTTP response is received over insecure transport, the UA MUST ignore any present STS header field(s).")。`vp dev` と、`scripts/checks/runtime/security-headers.ts` が起動するサーバは http で応答するので、手元のブラウザが HTTPS に固定されることは無い。

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。Nitro は 3.0.260610-beta、TanStack Start は `@tanstack/react-start` 1.168.58 に固定した版を指す。

[Nitro docs「Routing」]: https://github.com/nitrojs/nitro/blob/v3.0.260610-beta/docs/1.docs/5.routing.md
[TanStack Start docs「Hosting」]: https://github.com/TanStack/router/blob/@tanstack/react-start@1.168.58/docs/start/framework/react/guide/hosting.md
[TanStack Start docs「CSS Styling」]: https://github.com/TanStack/router/blob/@tanstack/react-start@1.168.58/docs/start/framework/react/guide/css-styling.md
[TanStack Start docs「Middleware」]: https://github.com/TanStack/router/blob/@tanstack/react-start@1.168.58/docs/start/framework/react/guide/middleware.md
[MDN「Content Security Policy (CSP)」]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP
[MDN「X-Content-Type-Options」]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options
[MDN「X-Frame-Options」]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options
[MDN「Referrer-Policy」]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy
[MDN「Cross-Origin-Opener-Policy」]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy
[MDN「Cross-Origin-Resource-Policy」]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Resource-Policy
[MDN「Strict-Transport-Security」]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security
[RFC 6797]: https://www.rfc-editor.org/rfc/rfc6797
