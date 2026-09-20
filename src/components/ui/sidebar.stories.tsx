import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { FileTextIcon, HomeIcon, SettingsIcon } from "lucide-react";
import type { ReactNode } from "react";
import { expect, userEvent } from "storybook/test";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const NAV = [
  { title: "ホーム", icon: HomeIcon },
  { title: "メモ", icon: FileTextIcon },
  { title: "設定", icon: SettingsIcon },
];

/**
 * 画面の骨格を担う部品。`SidebarProvider` が開閉の状態を持ち、`SidebarInset` が本文側になる。
 * `defaultOpen` で初期状態を決める
 */
function SidebarExample({
  children,
  collapsible,
}: {
  children?: ReactNode;
  collapsible?: "offcanvas" | "icon" | "none";
}) {
  return (
    <>
      <Sidebar collapsible={collapsible}>
        <SidebarHeader>メモ帳</SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>ナビゲーション</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {children ??
                  NAV.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton tooltip={item.title}>
                        <item.icon aria-hidden />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <SidebarTrigger />
      </SidebarInset>
    </>
  );
}

const meta = {
  component: SidebarProvider,
  args: { defaultOpen: true },
  render: (args) => (
    <SidebarProvider {...args}>
      <SidebarExample />
    </SidebarProvider>
  ),
} satisfies Meta<typeof SidebarProvider>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 開いた状態。ラベルまで見える */
export const Expanded: Story = {};

/**
 * 畳んだ状態。`collapsible` の既定は `offcanvas` なので、帯ごと画面外へ出て何も残らない
 */
export const Collapsed: Story = { args: { defaultOpen: false } };

/**
 * `collapsible="icon"` で畳んだ状態。アイコン列が残り、ラベルは `SidebarMenuButton` の
 * `tooltip` が出す。tooltip は畳んだときだけ描かれる
 */
export const CollapsedToIcons: Story = {
  args: { defaultOpen: false },
  render: (args) => (
    <SidebarProvider {...args}>
      <SidebarExample collapsible="icon" />
    </SidebarProvider>
  ),
};

/** 件数バッジを添えた形 */
export const WithBadge: Story = {
  render: (args) => (
    <SidebarProvider {...args}>
      <SidebarExample>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip="メモ">
            <FileTextIcon aria-hidden />
            <span>メモ</span>
          </SidebarMenuButton>
          <SidebarMenuBadge>12</SidebarMenuBadge>
        </SidebarMenuItem>
      </SidebarExample>
    </SidebarProvider>
  ),
};

/** 読み込み中。`SidebarMenuSkeleton` が行の形をなぞる */
export const Loading: Story = {
  render: (args) => (
    <SidebarProvider {...args}>
      <SidebarExample>
        <SidebarMenuItem>
          <SidebarMenuSkeleton showIcon />
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuSkeleton showIcon />
        </SidebarMenuItem>
      </SidebarExample>
    </SidebarProvider>
  ),
};

/**
 * トリガーで畳むところ。終了状態は Collapsed と同じ見た目なのでカタログには出さない (ADR-0022)
 */
export const Toggled: Story = {
  tags: ["!dev"],
  play: async ({ canvas, canvasElement }) => {
    // Sidebar は landmark を持たない div で、開閉は data-slot="sidebar" の data-state が持つ
    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]');
    await expect(sidebar).toHaveAttribute("data-state", "expanded");
    await userEvent.click(canvas.getByRole("button", { name: "Toggle Sidebar" }));
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  },
};
