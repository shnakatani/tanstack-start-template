# ADR-0049: ブラウザの console は Vite の `server.forwardConsole` で `error`・`warn`・`log` と未処理の error を端末へ送り、TanStack Devtools の Console Piping を止める

- Status: Accepted
- Date: 2026-11-07

## Context

開発中のブラウザの console の出力と未処理の error を、開発者とエージェントが読む端末にも出したい。dev には、ブラウザの console を端末へ送る経路が 2 つある。

| 経路                                                          | 送るもの                                                                                                                                      | 有効になる条件                                                                                             |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Vite の `server.forwardConsole`                               | 未処理の error と rejection (`unhandledErrors`)、`logLevels` に挙げた `console.*`。`true` は未処理の error と `console.error`・`console.warn` | 既定は AI の coding agent を検出したときだけ `true`                                                        |
| `@tanstack/devtools-vite` の Console Piping (`consolePiping`) | ブラウザ → 端末 (`[Client]` を付ける) と、SSR の server → ブラウザ (`[Server]` を付ける) の両方向。`levels` は両方向で共有する                | 既定で有効。`<html`・`StartClient`・`hydrateRoot`・`createRoot` のどれかを含むファイルに送るコードを入れる |

- Vite docs「Server Options」は `server.forwardConsole` の型を `boolean | { unhandledErrors?: boolean, logLevels?: ('error' | 'warn' | 'info' | 'log' | 'debug')[] }` とし、`logLevels` は "controls which `console.*` calls are forwarded" と書く。`logLevels` は送る level の列挙で、閾値ではない
- Vite+ 1.4.0 が同梱する Vite 8.3.5 の `resolveForwardConsoleOptions` は、object を渡すと `unhandledErrors` を省いたときに `true`、`logLevels` を省いたときに `[]` にする。agent の検出は同梱の `std-env` で、`AI_AGENT`・`CLAUDECODE`・`CLAUDE_CODE` などの環境変数を見る
- Console Piping の `consolePiping` が持つ option は `enabled` と `levels` だけで、片方の向きだけを止める option は無い (`@tanstack/devtools-vite` 0.8.6 の `src/plugin.ts`)
- `@tanstack/devtools-vite` 0.8.6 は、Vite が端末へ送ったブラウザのログを Console Piping がブラウザへ送り返すループを直している (TanStack/devtools#540)

### 端末に出た行数

2026-11-07 に、`vp dev` (Vite+ 1.4.0 が同梱する Vite 8.3.5、`@tanstack/devtools-vite` 0.8.6、`@tanstack/react-start` 1.169.4、nitro 3.0.260903-beta) で `/` を開き、ブラウザで `console.warn`・`console.error`・`console.log` を各 1 回、未処理の throw と reject を各 1 回出した。server の `console.warn` は、ページを開いたあとの 1 回の要求で 1 回だけ出した。「人の端末」は `AI_AGENT`・`CLAUDECODE`・`CLAUDE_CODE` を外して起動した dev を指す。

| 場合                                    | warn | error | log | 未処理の error | 未処理の rejection | server の warn (端末) | server の warn がブラウザに届くか |
| --------------------------------------- | ---- | ----- | --- | -------------- | ------------------ | --------------------- | --------------------------------- |
| Console Piping 有効、既定、人の端末     | 1    | 1     | 1   | 0              | 0                  | 1                     | 届く (`[Server]`)                 |
| Console Piping 有効、既定、agent の端末 | 2    | 2     | 1   | 1              | 1                  | 2                     | 届く (`[Server]`)                 |
| 採用した形、人の端末                    | 1    | 1     | 1   | 1              | 1                  | 1                     | 届かない                          |
| 採用した形、agent の端末                | 1    | 1     | 1   | 1              | 1                  | 1                     | 届かない                          |

- agent の端末で warn と error が 2 回出るのは、Console Piping の `[Client] <message>` と、Vite の `[console.warn] <message>` が両方出るからである。server の warn の 2 行目は、Console Piping がブラウザへ送った `[Server] <message>` を Vite が端末へ送り返した行である
- 採用した形では、ブラウザの `console.log` は `[vite+] (client) [console.log] <message>` で出る。アプリのコードの `console.log` と `console.error` には、Enhanced Logs がブラウザ向けに足した前置き (`LOG Go to Source: http://localhost:<dev の port>/__tsd/open-source?source=<path>:<line>:<column>`) が付き、本文は次の行に `→ <message>` で出る。Console Piping は前置きを外し、`[Client] <path>:<line>:<column> <message>` の 1 行で送る
- 採用した形で、ページを開いたまま部品のファイルを 2 回書き換えた。端末には `hmr update` と `page reload` の行だけが出て、ブラウザの console に出た `[vite] hot updated: <path>` (`console.debug`) は端末に来なかった
- `server.forwardConsole: true` と Console Piping 無効の形は、2026-11-05 の同じ測り方で、人の端末でも agent の端末でも warn・error・未処理の error と rejection が 1 回ずつ、log が 0 回だった (ea95e9d5 で測った)

### Storybook の dev と story のテスト

`@storybook/builder-vite` 10.6.5 (`@storybook/tanstack-react` 10.6.5 が使う) は `vite.config.ts` の設定を読むが、dev server を作るときに `server` を自分の値で丸ごと差し替える (`dist/index.js` の `createViteServer`)。Storybook docs「Vite」は、builder の設定を変える口に `viteFinal` と `mergeConfig` を案内する。

2026-11-07 に Storybook の dev で story を開き、上と同じ 5 つを出した。

| 場合                                 | warn | error | log | 未処理の error | 未処理の rejection |
| ------------------------------------ | ---- | ----- | --- | -------------- | ------------------ |
| `viteFinal` で渡さない、人の端末     | 0    | 0     | 0   | 0              | 0                  |
| `viteFinal` で渡さない、agent の端末 | 1    | 1     | 0   | 1              | 1                  |
| `viteFinal` で渡す、人の端末         | 1    | 1     | 1   | 1              | 1                  |
| `viteFinal` で渡す、agent の端末     | 1    | 1     | 1   | 1              | 1                  |

- `@storybook/addon-vitest` は `viteFinal` の結果を story のテストの config に重ねる。`process.env.VITEST` を見ずに渡すと、story のテストの出力で、Vitest が出す `console.warn` の行に `[vite] (client) [console.warn] <message>` の行が重なった。`process.env.VITEST === "true"` のときに渡さないと、Vitest の行だけになった (2026-11-07、`play` で `console.warn` を出す story で確かめた)
- browser project のテストでは、`vite.config.ts` の `server.forwardConsole` を残したまま `--silent=false` で走らせても、Vitest の行に重なる行は出なかった (2026-11-07)

## Decision

**ブラウザの console は Vite の `server.forwardConsole` に `{ unhandledErrors: true, logLevels: ["error", "warn", "log"] }` を渡して端末へ送り、`@tanstack/devtools-vite` に `consolePiping: { enabled: false }` を渡して Console Piping を止める。Storybook の dev には `.storybook/main.ts` の `viteFinal` で同じ値を渡し、story のテストには渡さない。**

- 値は `tooling/dev/forward-console.ts` に 1 つだけ置き、`vite.config.ts` と `.storybook/main.ts` が import する。2 か所に書くと、片方だけを変えても気付けない
- `server.forwardConsole` を明示するのは、既定のままだと人の端末で働かないからである。Console Piping は未処理の error を送らないので、既定のままでは人の端末に未処理の error が 1 行も出ない (「端末に出た行数」の表)
- `logLevels` に `info` と `debug` を入れないのは、ブラウザの console に出る Vite の client の接続と HMR の行 (`[vite] connecting...`、`[vite] connected.`、`[vite] hot updated: <path>`) が `console.debug`、React DevTools の案内が `console.info` だからである (2026-11-07 にブラウザの console で確かめた)
- 失うのは、SSR の server の console をブラウザの console に出す経路 (`[Server]`) である。server の console は端末に出ているので、端末を読む開発者とエージェントが読めるものは減らない

### 検討した選択肢

| 案                                                                                          | 評価                                                                                                                                                                                                                                                                | 採否     |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `forwardConsole` に `error`・`warn`・`log` と未処理の error を渡し、Console Piping を止める | 人の端末でも agent の端末でも 5 つが 1 回ずつ出る。未処理の error が人の端末にも出る。server → ブラウザのログ (`[Server]`) を失う。アプリのコードの `console.log` の行に Enhanced Logs の前置きが付く                                                               | **採用** |
| 既定のまま (Console Piping 有効、`forwardConsole` を書かない)                               | `@tanstack/devtools-vite` の docs「Vite Plugin」の既定。人の端末では未処理の error が出ず、agent の端末では warn と error が 2 回ずつ出て、server の warn もブラウザから送り返されて 2 回出る。起動した端末で出方が変わる                                           | 却下     |
| `forwardConsole: true` と Console Piping 無効                                               | 人の端末でも agent の端末でも warn・error・未処理の error が 1 回ずつ出る。ブラウザの `console.log` は、人の端末でも agent の端末でも端末に出ない                                                                                                                   | 却下     |
| 採用案で、`logLevels` に `info` と `debug` も入れる                                         | Console Piping と同じ範囲を送れる。`logLevels` は出どころで絞れず、Vite の client の接続と HMR のたびの `console.debug` と、React DevTools の案内の `console.info` まで端末に届く                                                                                   | 却下     |
| 採用案の `forwardConsole` に加えて、Console Piping を server → ブラウザのために残す         | `consolePiping` には片方の向きだけを止める option が無く、`levels` も両方向で共有する。ブラウザの console が端末に 2 回ずつ出る                                                                                                                                     | 却下     |
| 採用案に加えて、Enhanced Logs を切る (`enhancedLogs.enabled: false`)                        | 端末へ送ったアプリの `console.log` と `console.error` の行から前置きが消える。代わりに、ブラウザの console の Go to Source のリンクと、server の `console.log` に付く `LOG <path>:<line>:<column>` も失う。前置きは path と行を持つので、端末で読む手掛かりにもなる | 却下     |

## Consequences

- SSR の server の console は端末にだけ出て、ブラウザの console には出ない
- ブラウザの `console.info`・`console.debug` は端末に出ない。端末で読みたくなったら、`tooling/dev/forward-console.ts` の `logLevels` に足す
- 端末へ送ったアプリのコードの `console.log` と `console.error` は、`LOG Go to Source: <URL>` の行と `→ <message>` の行の 2 行になる。`console.warn` には前置きが付かない (`@tanstack/devtools-bundler-core` の `enhance-logs.ts` は `console.log` と `console.error` だけを書き換える)。リンクは dev の port を指すが、開いたときにエディタが開くかは確かめていない
- Storybook の dev でもブラウザの console が端末に出る。story のテストでは Vitest の出力だけになる
- `@storybook/builder-vite` が `server` を差し替えなくなったら、`viteFinal` の `forwardConsole` は要らなくなる。Storybook を上げたら、`viteFinal` を外して人の端末で「Storybook の dev と story のテスト」の表の測り方を繰り返す

## 出典

- Vite「Server Options」の `server.forwardConsole`: https://vite.dev/config/server-options#server-forwardconsole (2026-11-07 に確認)
- Storybook「Vite」の `viteFinal`: https://storybook.js.org/docs/builders/vite (2026-11-07 に確認)
- TanStack Devtools「Vite Plugin」: https://tanstack.com/devtools/latest/docs/vite-plugin
- `@voidzero-dev/vite-plus-core` 1.4.0 の `dist/vite/node/chunks/node.js` (`resolveForwardConsoleOptions`、`forwardConsolePlugin`、同梱の `std-env`) と `dist/vite/client/client.mjs` (client が出す `console.debug` と `console.info`)
- `@tanstack/devtools-vite` 0.8.6 の同梱 skill `devtools-vite-plugin` と `src/plugin.ts` (`consolePiping`、`console-pipe-transform`)
- `@storybook/builder-vite` 10.6.5 の `dist/index.js` (`commonConfig`・`createViteServer`)
- Console Piping と `forwardConsole` の往復のループの修正: TanStack/devtools#540
