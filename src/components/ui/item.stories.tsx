import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { FileTextIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";

type ItemVariant = NonNullable<ComponentProps<typeof Item>["variant"]>;
type ItemSize = NonNullable<ComponentProps<typeof Item>["size"]>;

/** control の選択肢の出処。`cva` に足した側がここで型エラーになる (ADR-0022) */
const VARIANT_MEMBERS = {
  default: null,
  outline: null,
  muted: null,
} satisfies Record<ItemVariant, null>;

const SIZE_MEMBERS = {
  default: null,
  sm: null,
  xs: null,
} satisfies Record<ItemSize, null>;

const meta = {
  component: Item,
  argTypes: {
    variant: { control: "inline-radio", options: Object.keys(VARIANT_MEMBERS) },
    size: { control: "inline-radio", options: Object.keys(SIZE_MEMBERS) },
  },
  render: (args) => (
    <Item {...args}>
      <ItemContent>
        <ItemTitle>買い物リスト</ItemTitle>
        <ItemDescription>3 件の項目</ItemDescription>
      </ItemContent>
    </Item>
  ),
} satisfies Meta<typeof Item>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 既定。背景も枠も持たない */
export const Default: Story = {};

/** 枠を持つ形。単体で置くときに輪郭が要る場合 */
export const Outline: Story = { args: { variant: "outline" } };

/** 下地を敷く形 */
export const Muted: Story = { args: { variant: "muted" } };

/** 密度を上げた形 */
export const Small: Story = { args: { size: "sm" } };

/** アイコンと操作を添えた形 */
export const WithMediaAndActions: Story = {
  render: () => (
    <Item variant="outline">
      <ItemMedia variant="icon">
        <FileTextIcon aria-hidden />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>買い物リスト</ItemTitle>
        <ItemDescription>3 件の項目</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button size="sm" variant="ghost">
          開く
        </Button>
      </ItemActions>
    </Item>
  ),
};

/**
 * 並べる形。`ItemGroup` は `role="list"` を持つが `Item` は listitem にならないので、
 * 消費側で渡す。渡さないと axe の `aria-required-children` で落ちる (`base-ui.md`)。
 * `ItemSeparator` はこの中に置けない (同上)
 */
export const Grouped: Story = {
  render: () => (
    <ItemGroup>
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Item は div を描き render prop も持たないため li にできない */}
      <Item role="listitem">
        <ItemContent>
          <ItemTitle>買い物リスト</ItemTitle>
        </ItemContent>
      </Item>
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- 同上 */}
      <Item role="listitem">
        <ItemContent>
          <ItemTitle>読みたい本</ItemTitle>
        </ItemContent>
      </Item>
    </ItemGroup>
  ),
};

/** 区切りを挟む形。`ItemGroup` の外で使う */
export const WithSeparator: Story = {
  render: () => (
    <div className="flex w-full flex-col">
      <Item>
        <ItemContent>
          <ItemTitle>買い物リスト</ItemTitle>
        </ItemContent>
      </Item>
      <ItemSeparator />
      <Item>
        <ItemContent>
          <ItemTitle>読みたい本</ItemTitle>
        </ItemContent>
      </Item>
    </div>
  ),
};
