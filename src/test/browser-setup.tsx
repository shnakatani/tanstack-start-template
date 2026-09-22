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
 * マウス位置の page スコープのリークを毎テスト前に断つ。
 * 同一 page 上で順次実行される後続テストへ hover 状態が残ると、テストが実行順に依存する。
 */
beforeEach(async () => {
  await parkMouse();
});

// animation の既定 (ADR-0018)。Base UI のフラグと reduced motion のエミュレーション。戻し方は animations.ts の JSDoc
beforeEach(disableAnimations);

/**
 * `announce()` (ADR-0017) の書き込み先を全ブラウザテストに用意する。本番は `RootDocument` が
 * 持つが、部品やページ単体の描画はそこを通らない。テストごとに置くと置き忘れが
 * `readAnnouncements` の throw まで出てこないので、setup で 1 回描く。
 * vitest-browser-react の cleanup は次のテストの `beforeEach` で走り (この setup より先に登録される)、
 * この描画の前に前テストの region を外す。
 */
beforeEach(async () => {
  await render(<LiveRegions />);
});
