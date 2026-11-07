import type { ServerOptions } from "vite-plus";

/**
 * dev でブラウザの console と未処理の error を端末へ送る範囲 (Vite の `server.forwardConsole`)。
 * 既定は AI の coding agent を検出したときだけ有効で、人の端末では何も届かないので、明示して渡す。
 * `info` と `debug` は送らない。Vite の client の接続と HMR の行 (`console.debug`) と、
 * React DevTools の案内 (`console.info`) まで端末に出る (ADR-0049)。
 *
 * dev server は `vite.config.ts` の `server` で、Storybook の dev は `.storybook/main.ts` の `viteFinal` で
 * これを渡す。`@storybook/builder-vite` は `vite.config.ts` の `server` を丸ごと差し替える
 */
export const forwardConsole = {
  unhandledErrors: true,
  logLevels: ["error", "warn", "log"],
} satisfies ServerOptions["forwardConsole"];
