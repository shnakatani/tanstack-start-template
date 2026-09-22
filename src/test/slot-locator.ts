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
    /**
     * lucide のアイコンを名前で掴む (`<CheckIcon>` → `.lucide-check`)。アイコンは role も
     * accessible name も持たないので、見えているかを `toBeVisible` で見るための locator。
     */
    getByIcon(name: string): Locator;
  }
}

locators.extend({
  getBySlot(slot: string) {
    return `[data-slot="${slot}"]`;
  },
  getByIcon(name: string) {
    return `svg.lucide-${name}`;
  },
});
