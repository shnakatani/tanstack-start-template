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
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

/**
 * popup が開いた side (`data-side`) ごとの、上流の `slide-in-from-*-2` が置く移動の値。
 * side は Base UI が空きで決めるので、値をテストへ固定せず開いた side から引く。
 * 見るのは開いた 1 つの side だけで、他の side の variant の付け忘れはレビューで見る
 */
const SLIDE_BY_SIDE: Record<string, string> = {
  bottom: "--tw-enter-translate-y: calc(2*0.25rem*-1)",
  top: "--tw-enter-translate-y: calc(2*0.25rem)",
  right: "--tw-enter-translate-x: calc(2*0.25rem*-1)",
  "inline-end": "--tw-enter-translate-x: calc(2*0.25rem*-1)",
  left: "--tw-enter-translate-x: calc(2*0.25rem)",
  "inline-start": "--tw-enter-translate-x: calc(2*0.25rem)",
};

/** tw-animate-css の拡縮で開く popup。`slides` は side ごとの移動を持つもの */
const POPUPS = [
  {
    slot: "popover-content",
    element: (
      <Popover open>
        <PopoverTrigger render={<Button>開く</Button>} />
        <PopoverContent>内容</PopoverContent>
      </Popover>
    ),
    slides: true,
  },
  {
    slot: "alert-dialog-content",
    element: (
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>確認</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>
    ),
    slides: false,
  },
  {
    slot: "dropdown-menu-content",
    element: (
      <DropdownMenu open>
        <DropdownMenuTrigger render={<Button>開く</Button>} />
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuItem>項目</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    slides: true,
  },
  {
    slot: "dropdown-menu-sub-content",
    element: (
      <DropdownMenu open>
        <DropdownMenuTrigger render={<Button>開く</Button>} />
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuSub open>
              <DropdownMenuSubTrigger>その他</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuGroup>
                  <DropdownMenuItem>項目</DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    slides: true,
  },
  {
    slot: "select-content",
    element: (
      <Select items={{ draft: "下書き" }} open>
        <SelectTrigger aria-label="状態">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="draft">下書き</SelectItem>
        </SelectContent>
      </Select>
    ),
    slides: true,
  },
  {
    slot: "combobox-content",
    element: (
      <Combobox items={["りんご"]} open>
        <ComboboxInput aria-label="果物" />
        <ComboboxContent>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    ),
    slides: true,
  },
  {
    slot: "tooltip-content",
    element: (
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger render={<Button>補足</Button>} />
          <TooltipContent>説明</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ),
    slides: true,
  },
];

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

  it.each(POPUPS)("$slot は移動と拡縮を外し、フェードを残す", async ({ slot, element, slides }) => {
    await emulateMotion(motion);
    await render(element);
    const popup = page.getBySlot(slot);
    await expect.element(popup).toBeInTheDocument();

    const scale =
      motion === "reduce"
        ? "--tw-enter-scale: 1; --tw-enter-opacity: 0"
        : "--tw-enter-scale: .95; --tw-enter-opacity: 0";
    await expect.element(popup).toHaveStyle(scale);
    if (!slides) {
      return;
    }
    const side = popup.element().getAttribute("data-side") ?? "";
    const slide = SLIDE_BY_SIDE[side];
    if (slide === undefined) {
      throw new Error(`data-side="${side}" の移動の値が SLIDE_BY_SIDE に無い`);
    }
    await expect
      .element(popup)
      .toHaveStyle(
        motion === "reduce" ? "--tw-enter-translate-x: 0; --tw-enter-translate-y: 0" : slide,
      );
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
