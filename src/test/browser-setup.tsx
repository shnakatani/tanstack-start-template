/**
 * ブラウザテスト全体に Tailwind の実 CSS を注入する setup。
 *
 * `src/styles.css` は本番では `src/routes/__root.tsx` が `?url` で読み込むため、
 * コンポーネント単体 render のブラウザテストには届かない。ここで直接 import し、
 * `vitest.browser.config.ts` の `@tailwindcss/vite` plugin にユーティリティクラスを
 * 実 CSS へ解決させることで、getBoundingClientRect / getComputedStyle による
 * レイアウト挙動の検証を可能にする。
 */
import { beforeEach } from "vite-plus/test";
import { render } from "vitest-browser-react";

import "@/styles.css";
import { LiveRegions } from "@/components/live-regions";
import { disableAnimations } from "@/test/animations";
import { parkMouse } from "@/test/park-mouse";
import "@/test/slot-locator";

/**
 * page スコープに残る状態を毎テスト前に既定へ戻す。1 つの session が複数ファイルを順に走らせ、
 * 前のテストの状態が次へ残るため。
 *
 * - マウス位置: 前テストの click 位置に hover 状態が残ると、配色の検証が実行順に依存する
 * - animation: Base UI のフラグと reduced motion のエミュレーション (docs/guides/testing/user-interactions.md「animation を無効にして走らせる理由」)。戻し方は animations.ts
 *
 * 2 つは独立した CDP 呼び出しなので並行に送る。
 */
beforeEach(async () => {
  await Promise.all([parkMouse(), disableAnimations()]);
});

/**
 * `announce()` (ADR-0026) の書き込み先を全ブラウザテストに用意する。本番は `RootDocument` が
 * 持つが、部品やページ単体の描画はそこを通らない。テストごとに置くと置き忘れが
 * `readAnnouncements` の throw まで出てこないので、setup で 1 回描く。
 * vitest-browser-react の cleanup は次のテストの `beforeEach` で走り (この setup より先に登録される)、
 * この描画の前に前テストの region を外す。
 */
beforeEach(async () => {
  await render(<LiveRegions />);
});
