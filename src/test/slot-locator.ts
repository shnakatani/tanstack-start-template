import { locators } from "vite-plus/test/browser";
import type { Locator } from "vite-plus/test/browser/context";

declare module "vitest/browser" {
  interface LocatorSelectors {
    /**
     * `data-slot` で部品の内部パート (registry の `data-slot="scroll-area-viewport"` など) を
     * 掴む。`querySelector` へ落ちると retry と strict を失うので、公式が勧める
     * `locators.extend` で locator にする (vitest browser の locators docs)。
     * 掴む先が accessibility tree に出る要素なら `getByRole` を先に使う。
     */
    getBySlot(slot: string): Locator;
  }
}

locators.extend({
  getBySlot(slot: string) {
    return `[data-slot="${slot}"]`;
  },
});
