import { describe, expect, it, onTestFinished } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { cdp } from "vite-plus/test/browser/context";
import { render } from "vitest-browser-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { createToastManager, Toaster } from "@/components/ui/toast";

type Motion = "no-preference" | "reduce";

/**
 * `prefers-reduced-motion` をこのテストの間だけ立てる。エミュレーションは page スコープで
 * 次のテストへ残るので、終わったら空値で解除する。
 */
async function emulateMotion(value: Motion) {
  await cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value }],
  });
  onTestFinished(async () => {
    await cdp().send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "" }],
    });
  });
}

/**
 * 部品ごとに付けた reduced motion の variant の値 (ADR-0030)。動きを足したら
 * docs/guides/accessibility.md「動きを reduced motion に合わせる」の手順でここに足す。
 * 同じ値を no-preference (対照) と reduce で読む。対照が上流の値のまま変わらないことで、
 * reduce の値が media query で切り替わっていることを確かめる。
 * tw-animate-css は変数を `@property` で登録しており、未指定は initial-value (移動 0、拡縮 1) で読める。
 */
const EXPECTED = {
  "no-preference": {
    dialog: "--tw-enter-scale: .95; --tw-enter-opacity: 0",
    popover: "--tw-enter-scale: .95; --tw-enter-opacity: 0",
    sheet: "translate: 2.5rem; opacity: 0",
    accordion: "animation-name: accordion-down",
    sidebarGap: "transition-property: width",
    sidebarContainer: "transition-property: left, right, width",
    sidebarGroupLabel: "transition-property: margin, opacity",
    sidebarMenuButton: "transition-property: width, height, padding",
    sidebarRail: "transition-property: all",
    button: "transition-property: all",
    toast: "transition-property: transform, opacity, height",
  },
  reduce: {
    dialog: "--tw-enter-scale: 1; --tw-enter-opacity: 0",
    popover: "--tw-enter-scale: 1; --tw-enter-translate-y: 0; --tw-enter-opacity: 0",
    sheet: "translate: none; opacity: 0",
    accordion: "animation-name: none",
    sidebarGap: "transition-property: none",
    sidebarContainer: "transition-property: none",
    sidebarGroupLabel: "transition-property: opacity",
    sidebarMenuButton: "transition-property: none",
    sidebarRail: "transition-property: background-color",
    button:
      "transition-property: color, background-color, border-color, outline-color, opacity, box-shadow",
    toast: "transition-property: opacity",
  },
} as const satisfies Record<Motion, Record<string, string>>;

describe.each<Motion>(["no-preference", "reduce"])("prefers-reduced-motion: %s", (motion) => {
  const expected = EXPECTED[motion];

  it("Dialog は拡縮を外し、フェードを残す", async () => {
    await emulateMotion(motion);
    const screen = await render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>確認</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    await expect.element(screen.getByRole("dialog")).toHaveStyle(expected.dialog);
  });

  it("Popover は移動と拡縮を外し、フェードを残す", async () => {
    await emulateMotion(motion);
    await render(
      <Popover open>
        <PopoverTrigger render={<Button>開く</Button>} />
        <PopoverContent>内容</PopoverContent>
      </Popover>,
    );

    await expect.element(page.getBySlot("popover-content")).toHaveStyle(expected.popover);
  });

  it("Sheet は出入りの移動を外し、フェードを残す", async () => {
    await emulateMotion(motion);
    const screen = await render(
      <Sheet open>
        <SheetContent side="right">
          <SheetTitle>設定</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    await expect.element(screen.getByRole("dialog")).toBeInTheDocument();
    const content = page.getBySlot("sheet-content");
    // 開始状態は mount の 1 フレームだけ立つので、属性を立てて規則を直接読む
    content.element().setAttribute("data-starting-style", "");

    await expect.element(content).toHaveStyle(expected.sheet);
  });

  it("Accordion は高さの animation を外す", async () => {
    await emulateMotion(motion);
    const screen = await render(
      <Accordion>
        <AccordionItem value="a">
          <AccordionTrigger>見出し</AccordionTrigger>
          <AccordionContent>本文</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    // 初期表示で開いている panel には Base UI が animation-name: none を当てるので、操作で開く
    await screen.getByRole("button", { name: "見出し" }).click();

    await expect.element(page.getBySlot("accordion-content")).toHaveStyle(expected.accordion);
  });

  it("Sidebar は開閉の幅・位置・大きさの transition を外し、ラベルのフェードと rail の色の変化を残す", async () => {
    await emulateMotion(motion);
    await render(
      <SidebarProvider open>
        <Sidebar collapsible="icon">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>グループ</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton>項目</SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarRail />
        </Sidebar>
      </SidebarProvider>,
    );

    await expect.element(page.getBySlot("sidebar-gap")).toHaveStyle(expected.sidebarGap);
    await expect
      .element(page.getBySlot("sidebar-container"))
      .toHaveStyle(expected.sidebarContainer);
    await expect
      .element(page.getBySlot("sidebar-group-label"))
      .toHaveStyle(expected.sidebarGroupLabel);
    await expect
      .element(page.getBySlot("sidebar-menu-button"))
      .toHaveStyle(expected.sidebarMenuButton);
    await expect.element(page.getBySlot("sidebar-rail")).toHaveStyle(expected.sidebarRail);
  });

  it("Button は押下のずれを transition させず、色と影の transition を残す", async () => {
    await emulateMotion(motion);
    const screen = await render(<Button>保存</Button>);

    await expect.element(screen.getByRole("button")).toHaveStyle(expected.button);
  });

  it("Toast は出入りと積み直しの移動を transition させない", async () => {
    await emulateMotion(motion);
    const manager = createToastManager();
    await render(<Toaster toastManager={manager} />);
    manager.add({ title: "保存しました" });

    await expect.element(page.getBySlot("toast")).toHaveStyle(expected.toast);
  });
});
