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

import { expectRemoved } from "../assert/absent";
import { disableAnimations, enableAnimations } from "./animations";

/**
 * animate-out を実行時間より長く引き延ばし、「Base UI が animation の完了を待っているか」を
 * 時間の計測なしで判別する。待っていれば popup はこのテストの timeout まで残り、
 * 待っていなければ即 unmount される。
 *
 * `disableAnimations()` が注入する停止用 CSS (layer 無し、`!important`) に勝つため、Tailwind が
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

function readMotionSeconds(element: Element) {
  const style = getComputedStyle(element);
  return {
    transitionDuration: Number.parseFloat(style.transitionDuration),
    transitionDelay: Number.parseFloat(style.transitionDelay),
    animationDuration: Number.parseFloat(style.animationDuration),
    animationDelay: Number.parseFloat(style.animationDelay),
  };
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
  // mount は builtin の matcher で待つ。`findElement()` は呼ばない (docs/guides/testing/waiting-and-assertions.md「待つ口を選ぶ」「assert の予算を宣言する」)
  await expect.element(screen.getByRole("dialog")).toBeInTheDocument();
  return screen;
}

// 既定値は browser-setup.tsx の beforeEach が立てる (docs/guides/testing/user-interactions.md「animation を無効にして走らせる理由」)
describe("animation の既定", () => {
  it("既定では CSS の transition と animation の時間と遅延が inline の指定より優先して 0 秒になる", async () => {
    const screen = await render(
      <div
        data-testid="motion"
        style={{
          transitionProperty: "opacity",
          transitionDuration: "150ms",
          transitionDelay: "150ms",
          animationDuration: "150ms",
          animationDelay: "150ms",
        }}
      />,
    );

    // toHaveStyle は期待値を同じ document の要素で正規化するので、`*` に当たる !important が
    // 期待値側にも当たって何を書いても一致する。値は computed style から秒で読む
    await expect
      .poll(() => readMotionSeconds(screen.getByTestId("motion").element()))
      .toEqual({
        transitionDuration: 0,
        transitionDelay: 0,
        animationDuration: 0,
        animationDelay: 0,
      });
  });

  it("既定では閉じた Dialog が animate-out を待たずに unmount する", async () => {
    stretchExitAnimation();
    const screen = await renderOpenDialog();

    await screen.getByRole("button", { name: "閉じる" }).click();

    await expectRemoved(screen.getByRole("dialog"));
  });

  it("enableAnimations() を呼んだテストでは CSS の時間が指定どおりに戻る", async () => {
    enableAnimations();
    const screen = await render(
      <div
        data-testid="motion"
        style={{
          transitionProperty: "opacity",
          transitionDuration: "150ms",
          animationDuration: "150ms",
        }}
      />,
    );

    await expect
      .poll(() => readMotionSeconds(screen.getByTestId("motion").element()))
      .toMatchObject({ transitionDuration: 0.15, animationDuration: 0.15 });
  });

  it("enableAnimations() の後に disableAnimations() を呼ぶと停止用 CSS が入り直す", async () => {
    // 次のテストの beforeEach が既定へ戻す経路。1 つのテストの中で確かめ、実行順に依存させない
    enableAnimations();
    disableAnimations();
    const screen = await render(
      <div
        data-testid="motion"
        style={{
          transitionProperty: "opacity",
          transitionDuration: "150ms",
          animationDuration: "150ms",
        }}
      />,
    );

    await expect
      .poll(() => readMotionSeconds(screen.getByTestId("motion").element()))
      .toMatchObject({ transitionDuration: 0, animationDuration: 0 });
  });

  it("enableAnimations() を呼んだテストでは animate-out の完了まで popup が残る", async () => {
    enableAnimations();
    stretchExitAnimation();
    const screen = await renderOpenDialog();

    await screen.getByRole("button", { name: "閉じる" }).click();

    // 閉じかけの popup は data-ending-style を持ったまま mount されている
    await expect
      .element(screen.getByRole("dialog", { includeHidden: true }))
      .toHaveAttribute("data-ending-style");
  });
});
