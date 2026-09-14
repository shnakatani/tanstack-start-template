/**
 * ブラウザテスト全体に Tailwind の実 CSS を注入する setup。
 *
 * `src/styles.css` は本番では `src/routes/__root.tsx` が `?url` で読み込むため、
 * コンポーネント単体 render のブラウザテストには届かない。ここで直接 import し、
 * `vitest.browser.config.ts` の `@tailwindcss/vite` plugin にユーティリティクラスを
 * 実 CSS へ解決させることで、getBoundingClientRect / getComputedStyle による
 * レイアウト挙動の検証を可能にする。
 */
import { afterEach, beforeEach } from "vite-plus/test";
import { cdp } from "vite-plus/test/browser/context";
import { render } from "vitest-browser-react";

import "@/styles.css";
import { LiveRegions } from "@/components/live-regions";
import { disableBaseUiAnimations } from "@/test/base-ui-animations";
import { parkMouse } from "@/test/park-mouse";

/**
 * マウス位置の page スコープのリークを毎テスト前に断つ。
 * 同一 page 上で順次実行される後続テストへ hover 状態が残ると、テストが実行順に依存する。
 */
beforeEach(async () => {
  await parkMouse();
});

// Base UI の animation の既定 (ADR-0018)。理由と戻し方は base-ui-animations.ts の JSDoc
beforeEach(disableBaseUiAnimations);

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

/**
 * エミュレーション設定を毎テスト後に解除する。
 *
 * `Emulation.setTouchEmulationEnabled` は page 単位の設定で、同一 page 上で順次実行される
 * 後続ファイルへリークする (後続で `any-pointer: coarse` が true になり、この軸で分岐する
 * テストがファイル実行順に依存する)。`maxTouchPoints: 0` を併せて渡すと Protocol error。
 *
 * `Emulation.setEmulatedMedia` も同じ page スコープの override でリークするため、
 * `features: []` で戻す (未リセットだと `prefers-reduced-motion: reduce` を立てたファイル以降が
 * 全て reduced motion 環境で走り、ファイル実行順に依存した flaky を作る)。
 */
// 直列 await にすると前段の失敗で後段のリセットが飛び、リークが以降ずっと残る
afterEach(async () => {
  await Promise.all([
    cdp().send("Emulation.setTouchEmulationEnabled", { enabled: false }),
    cdp().send("Emulation.setEmulatedMedia", { features: [] }),
  ]);
});
