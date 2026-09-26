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
    getBySlot(slot: string, attributes?: Record<string, string>): Locator;
    /**
     * lucide のアイコンを名前で掴む (`<CheckIcon>` → `.lucide-check`)。アイコンは role も
     * accessible name も持たないので、見えているかを `toBeVisible` で見るための locator。
     */
    getByIcon(name: string): Locator;
  }
}

locators.extend({
  getBySlot(slot: string, attributes: Record<string, string> = {}) {
    // 同じ slot が向きや状態で複数出るとき (`data-orientation` / `data-state`) に絞る
    const extra = Object.entries(attributes)
      .map(([name, value]) => `[${name}="${value}"]`)
      .join("");
    return `[data-slot="${slot}"]${extra}`;
  },
  getByIcon(name: string) {
    return `svg.lucide-${name}`;
  },
});
