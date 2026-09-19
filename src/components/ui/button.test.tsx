import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { Button } from "@/components/ui/button";

describe("Button の disabled の見た目", () => {
  // Base UI は disabled prop を state へ入れて data-disabled を必ず出すが
  // (@base-ui/react 1.8.0 の internals/getStateAttributesProps.js)、native disabled は
  // focusableWhenDisabled のとき付けない (utils/useFocusableWhenDisabled.js)。registry の
  // disabled: variant は後者の経路に当たらないので data-disabled: へ寄せてある (ADR-0006)
  it("focusableWhenDisabled の disabled でも通常時と違う見た目になる", async () => {
    const screen = await render(
      <>
        <Button focusableWhenDisabled>通常</Button>
        <Button focusableWhenDisabled disabled>
          使用不可
        </Button>
      </>,
    );

    const plain = screen.getByRole("button", { name: "通常" }).element();
    const off = screen.getByRole("button", { name: "使用不可" }).element();

    expect(off.getAttribute("disabled")).toBeNull();
    expect(off.getAttribute("aria-disabled")).toBe("true");
    expect(Number(getComputedStyle(off).opacity)).toBeLessThan(
      Number(getComputedStyle(plain).opacity),
    );
    expect(getComputedStyle(off).pointerEvents).toBe("none");
  });

  it("native disabled でも通常時と違う見た目になる", async () => {
    const screen = await render(
      <>
        <Button>通常</Button>
        <Button disabled>使用不可</Button>
      </>,
    );

    const plain = screen.getByRole("button", { name: "通常" }).element();
    const off = screen.getByRole("button", { name: "使用不可" }).element();

    expect(off.getAttribute("disabled")).not.toBeNull();
    expect(Number(getComputedStyle(off).opacity)).toBeLessThan(
      Number(getComputedStyle(plain).opacity),
    );
    expect(getComputedStyle(off).pointerEvents).toBe("none");
  });
});
