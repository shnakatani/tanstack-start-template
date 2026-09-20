import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { expectNoA11yViolations } from "@/test/a11y";

import { ActionForm, ActionFormSubmit } from "./form";

/**
 * 振る舞いの検証は `form.stories.tsx` の play が持つ (ADR-0022)。ここに残るのは
 * pending 中の描画に対する a11y 検査だけで、story へは移せない。Storybook の a11y は
 * play の完了後に走るため、pending を保ったまま検査させるには決着しない Promise が要り、
 * それは ADR-0022 節 4 が禁じている。
 */
describe("ActionForm", () => {
  it("pending 中の描画に a11y 違反が無い", async () => {
    const pending = Promise.withResolvers<undefined>();
    const screen = await render(
      <ActionForm submitAction={() => pending.promise}>
        <ActionFormSubmit>保存</ActionFormSubmit>
      </ActionForm>,
    );

    const button = screen.getByRole("button", { name: "保存", exact: true });
    await button.click();
    await expect.element(button).toHaveAttribute("aria-busy", "true");

    await expectNoA11yViolations(document.body);
    pending.resolve(undefined);
  });
});
