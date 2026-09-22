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
import { enableAnimations } from "./animations";

/**
 * animate-out を実行時間より長く引き延ばし、「Base UI が animation の完了を待っているか」を
 * 時間の計測なしで判別する。待っていれば popup はこのテストの timeout まで残り、
 * 待っていなければ即 unmount される。
 *
 * `src/styles.css` の reduced-motion ブロック (`@layer base`、`!important`) に勝つため、Tailwind が
 * 最初に宣言する `theme` layer へ入れる。important な宣言は先に宣言された layer が勝ち、layer の
 * 無い宣言は最後の layer 扱いで負ける (CSS Cascade 5 §6.4)。
 */
function stretchExitAnimation() {
  const style = document.createElement("style");
  style.textContent = "@layer theme { [data-closed] { animation-duration: 10s !important; } }";
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
  // mount は builtin の matcher で待つ。`findElement()` は呼ばない (ADR-0013 / ADR-0030)
  await expect.element(screen.getByRole("dialog")).toBeInTheDocument();
  return screen;
}

// 既定値は browser-setup.tsx の beforeEach が立てる (ADR-0018)
describe("animation の既定", () => {
  it("既定では prefers-reduced-motion: reduce が立ち、CSS の transition が 0.01ms になる", async () => {
    // inline の通常宣言より styles.css の reduced-motion ブロック (!important) が勝つ
    const screen = await render(
      <div
        data-testid="motion"
        style={{ transitionProperty: "opacity", transitionDuration: "150ms" }}
      />,
    );

    expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    await expect.element(screen.getByTestId("motion")).toHaveStyle("transition-duration: 0.01ms");
  });

  it("既定では閉じた Dialog が animate-out を待たずに unmount する", async () => {
    stretchExitAnimation();
    const screen = await renderOpenDialog();

    await screen.getByRole("button", { name: "閉じる" }).click();

    await expectRemoved(screen.getByRole("dialog"));
  });

  it("enableAnimations() を await したテストでは animate-out の完了まで popup が残る", async () => {
    await enableAnimations();
    expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(false);
    stretchExitAnimation();
    const screen = await renderOpenDialog();

    await screen.getByRole("button", { name: "閉じる" }).click();

    // 閉じかけの popup は data-ending-style を持ったまま mount されている
    await expect
      .element(screen.getByRole("dialog", { includeHidden: true }))
      .toHaveAttribute("data-ending-style");
  });
});
