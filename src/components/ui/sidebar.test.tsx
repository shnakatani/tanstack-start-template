import { Collapsible } from "@base-ui/react/collapsible";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/context";
import { render } from "vitest-browser-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { resolveColorToken } from "@/test/resolve-color-token";

/**
 * ADR-0024 の許容リストにある sidebar.tsx の乖離 (`sidebarMenuButtonVariants` の開状態
 * selector) を守る。この乖離を使う消費側コンポーネントのテストでも同じ配色は見えるが、
 * 消費側が作り替えられると乖離のガードごと消えるため registry 側にも置く
 * (先例: `input-group.test.tsx`)。
 *
 * 配色は `toHaveStyle` を token の解決値で見る。閉状態は背景が透明で前景は継承した
 * `--foreground` (light では accent の前景と別値。dark は同値。styles.css)。開くのは pointer
 * ではなくキーボードで、hover の配色と混同しない (マウスは browser-setup の parkMouse が
 * 退避済み。ADR-0035)。
 */
// トークンが未定義なら resolveColorToken が投げる。ここで存在を見張り直さない
const closedStyle = () =>
  `background-color: rgba(0, 0, 0, 0); color: ${resolveColorToken("--foreground")}`;
const accentStyle = () =>
  `background-color: ${resolveColorToken("--sidebar-accent")}; color: ${resolveColorToken("--sidebar-accent-foreground")}`;

describe("SidebarMenuButton の開状態 (ADR-0024 の乖離)", () => {
  it("popup の trigger にすると、開いている間だけ accent の配色になる", async () => {
    const screen = await render(
      <SidebarProvider open>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton />}>切替</DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>項目</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarProvider>,
    );
    const trigger = screen.getByRole("button", { name: "切替", exact: true });
    await expect.element(trigger).toHaveStyle(closedStyle());

    await userEvent.tab();
    await expect.element(trigger).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect
      .element(screen.getByRole("menuitem", { name: "項目", exact: true }))
      .toBeInTheDocument();

    await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
    await expect.element(trigger).toHaveStyle(accentStyle());
  });

  it("Tooltip の trigger では tooltip 開状態の data-popup-open で accent にならない", async () => {
    const screen = await render(
      <SidebarProvider open>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="ツールチップ">切替</SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarProvider>,
    );
    const trigger = screen.getByRole("button", { name: "切替", exact: true });
    await expect.element(trigger).toHaveStyle(closedStyle());

    // focus で tooltip が開く
    await userEvent.tab();
    await expect.element(trigger).toHaveAttribute("data-popup-open");

    await expect.element(trigger).not.toHaveAttribute("aria-expanded");
    await expect.element(trigger).toHaveStyle(closedStyle());
  });

  it("Collapsible の trigger では aria-expanded の開状態で accent になる", async () => {
    const screen = await render(
      <SidebarProvider open>
        <SidebarMenu>
          <SidebarMenuItem>
            <Collapsible.Root>
              <Collapsible.Trigger render={<SidebarMenuButton />}>切替</Collapsible.Trigger>
              <Collapsible.Panel>項目</Collapsible.Panel>
            </Collapsible.Root>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarProvider>,
    );
    const trigger = screen.getByRole("button", { name: "切替", exact: true });
    await expect.element(trigger).toHaveStyle(closedStyle());

    await userEvent.tab();
    await expect.element(trigger).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true");

    await expect.element(trigger).not.toHaveAttribute("data-popup-open");
    await expect.element(trigger).toHaveStyle(accentStyle());
  });
});

/**
 * ADR-0024 の許容リストにある sidebar.tsx の乖離 (keydown 購読を `useEffectEvent` へ
 * 切り出し、依存を空にする) を守る。切り出しを誤ると stale closure でショートカットが
 * 無言で効かなくなるため、上流の形にも本乖離にも共通の可視挙動で押さえる。
 * 開閉は desktop の器が持つ `data-state` で見る (getBySlot の属性で状態ごとに掴む)。
 */
describe("キーボードショートカットでの開閉 (ADR-0024 の乖離)", () => {
  it("Meta+B で開状態が切り替わる", async () => {
    const screen = await render(
      <SidebarProvider defaultOpen>
        <Sidebar>
          <SidebarContent />
        </Sidebar>
      </SidebarProvider>,
    );
    const sidebar = (state: "expanded" | "collapsed") =>
      screen.getBySlot("sidebar", { "data-state": state });
    await expect.element(sidebar("expanded")).toBeInTheDocument();

    await userEvent.keyboard("{Meta>}b{/Meta}");
    await expect.element(sidebar("collapsed")).toBeInTheDocument();

    await userEvent.keyboard("{Meta>}b{/Meta}");
    await expect.element(sidebar("expanded")).toBeInTheDocument();
  });
});
