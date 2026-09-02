import { Collapsible } from "@base-ui/react/collapsible";
import { describe, expect, it, vi } from "vite-plus/test";
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
import { waitForAnimations } from "@/test/wait-for-animations";

function getSidebarAccentColors() {
  const rootStyles = getComputedStyle(document.documentElement);
  expect(rootStyles.getPropertyValue("--sidebar-accent").trim()).not.toBe("");
  expect(rootStyles.getPropertyValue("--sidebar-accent-foreground").trim()).not.toBe("");

  const reference = document.createElement("div");
  reference.style.backgroundColor = "var(--sidebar-accent)";
  reference.style.color = "var(--sidebar-accent-foreground)";
  document.body.append(reference);
  const styles = getComputedStyle(reference);
  const colors = {
    backgroundColor: styles.backgroundColor,
    color: styles.color,
  };
  reference.remove();
  return colors;
}

/**
 * ADR-0006 の許容リストにある sidebar.tsx の乖離 (`sidebarMenuButtonVariants` の開状態
 * selector) を守る。この乖離を使う消費側コンポーネントのテストでも同じ配色は見えるが、
 * 消費側が作り替えられると乖離のガードごと消えるため registry 側にも置く
 * (先例: `input-group.test.tsx`)。
 */
describe("SidebarMenuButton の開状態 (ADR-0006 の乖離)", () => {
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
    const trigger = screen.getByRole("button", { name: "切替", exact: true }).element();

    expect(trigger.matches(":hover")).toBe(false);
    const closedBackgroundColor = getComputedStyle(trigger).backgroundColor;
    const accentColors = getSidebarAccentColors();
    // light テーマでは閉状態の --foreground と開状態の --sidebar-accent-foreground が別値。
    // dark テーマでは同値になるため、前景色の検証は light 前提で書く (styles.css)
    const closedColor = getComputedStyle(trigger).color;

    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "項目", exact: true }).query()).not.toBeNull();
    });
    await waitForAnimations();

    // hover ではなく開状態で配色が変わっていることを見る
    expect(trigger.matches(":hover")).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(getComputedStyle(trigger).backgroundColor).toBe(accentColors.backgroundColor);
    expect(getComputedStyle(trigger).color).toBe(accentColors.color);
    expect(getComputedStyle(trigger).backgroundColor).not.toBe(closedBackgroundColor);
    expect(getComputedStyle(trigger).color).not.toBe(closedColor);
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
    const trigger = screen.getByRole("button", { name: "切替", exact: true }).element();
    const closedBackgroundColor = getComputedStyle(trigger).backgroundColor;
    const closedColor = getComputedStyle(trigger).color;

    expect(trigger.matches(":hover")).toBe(false);
    trigger.focus();
    await vi.waitFor(() => {
      expect(trigger.hasAttribute("data-popup-open")).toBe(true);
    });
    await waitForAnimations();

    expect(trigger.hasAttribute("aria-expanded")).toBe(false);
    expect(getComputedStyle(trigger).backgroundColor).toBe(closedBackgroundColor);
    expect(getComputedStyle(trigger).color).toBe(closedColor);
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
    const trigger = screen.getByRole("button", { name: "切替", exact: true }).element();
    const accentColors = getSidebarAccentColors();

    expect(trigger.matches(":hover")).toBe(false);
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
    });
    await waitForAnimations();

    expect(trigger.hasAttribute("data-popup-open")).toBe(false);
    expect(getComputedStyle(trigger).backgroundColor).toBe(accentColors.backgroundColor);
    expect(getComputedStyle(trigger).color).toBe(accentColors.color);
  });
});

/**
 * ADR-0006 の許容リストにある sidebar.tsx の乖離 (keydown 購読を `useEffectEvent` へ
 * 切り出し、依存を空にする) を守る。切り出しを誤ると stale closure でショートカットが
 * 無言で効かなくなるため、上流の形にも本乖離にも共通の可視挙動で押さえる。
 */
describe("キーボードショートカットでの開閉 (ADR-0006 の乖離)", () => {
  it("Meta+B で開状態が切り替わる", async () => {
    const screen = await render(
      <SidebarProvider defaultOpen>
        <Sidebar>
          <SidebarContent />
        </Sidebar>
      </SidebarProvider>,
    );
    const container = screen.container.querySelector("[data-state]");
    expect(container?.getAttribute("data-state")).toBe("expanded");

    await userEvent.keyboard("{Meta>}b{/Meta}");
    await vi.waitFor(() => {
      expect(container?.getAttribute("data-state")).toBe("collapsed");
    });

    await userEvent.keyboard("{Meta>}b{/Meta}");
    await vi.waitFor(() => {
      expect(container?.getAttribute("data-state")).toBe("expanded");
    });
  });
});
