import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { Button } from "@/components/ui/button";

/**
 * registry 乖離のガード。Base UI は disabled prop を state へ入れて data-disabled を必ず出すが
 * (@base-ui/react 1.8.0 の internals/getStateAttributesProps.js)、native disabled は
 * focusableWhenDisabled のとき付けない (utils/useFocusableWhenDisabled.js)。registry の
 * disabled: variant は後者の経路に当たらないので data-disabled: を足してある (ADR-0027)。
 * native disabled の見た目は registry 自身の variant で、`Disabled` story が持つ。
 *
 * 見た目は docs/guides/testing.md「クリックを発火する」の形 (opacity と pointer-events の指定) で見る。
 */
describe("Button の disabled の見た目", () => {
  it("focusableWhenDisabled の disabled でも無効表示とポインタ遮断が当たる", async () => {
    const screen = await render(
      <Button focusableWhenDisabled disabled>
        使用不可
      </Button>,
    );
    const offButton = screen.getByRole("button", { name: "使用不可" });

    await expect.element(offButton).not.toHaveAttribute("disabled");
    await expect.element(offButton).toHaveAttribute("aria-disabled", "true");
    await expect.element(offButton).toHaveStyle("opacity: 0.5; pointer-events: none");
  });
});
