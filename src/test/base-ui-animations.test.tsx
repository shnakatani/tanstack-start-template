import { describe, expect, it, onTestFinished } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { expectRemoved } from "./absent";
import { enableBaseUiAnimations } from "./base-ui-animations";
import { findElement } from "./find-element";

/**
 * animate-out を実行時間より長く引き延ばし、「Base UI が animation の完了を待っているか」を
 * 時間の計測なしで判別する。待っていれば popup はこのテストの timeout まで残り、
 * 待っていなければ即 unmount される。
 */
function stretchExitAnimation() {
  const style = document.createElement("style");
  style.textContent = "[data-closed] { animation-duration: 10s !important; }";
  document.head.append(style);
  onTestFinished(() => {
    style.remove();
  });
}

async function renderOpenDialog() {
  const screen = await render(
    <Dialog>
      <DialogTrigger render={<Button>開く</Button>} />
      <DialogContent>
        <DialogTitle>確認</DialogTitle>
        <DialogClose render={<Button>閉じる</Button>} />
      </DialogContent>
    </Dialog>,
  );
  await screen.getByRole("button", { name: "開く" }).click();
  await findElement(screen.getByRole("dialog"));
  return screen;
}

// 既定値は browser-setup.tsx の beforeEach が立てる (ADR-0018)
describe("Base UI の animation", () => {
  it("既定では閉じた Dialog が animate-out を待たずに unmount する", async () => {
    stretchExitAnimation();
    const screen = await renderOpenDialog();

    await screen.getByRole("button", { name: "閉じる" }).click();

    await expectRemoved(screen.getByRole("dialog"));
  });

  it("enableBaseUiAnimations() を呼んだテストでは animate-out の完了まで popup が残る", async () => {
    enableBaseUiAnimations();
    stretchExitAnimation();
    const screen = await renderOpenDialog();

    await screen.getByRole("button", { name: "閉じる" }).click();

    // 閉じかけの popup は data-ending-style を持ったまま mount されている
    await expect
      .element(screen.getByRole("dialog", { includeHidden: true }))
      .toHaveAttribute("data-ending-style");
  });
});
