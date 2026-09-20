import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { FileTextIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

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
type ItemMediaVariant = NonNullable<ComponentProps<typeof ItemMedia>["variant"]>;

/** control の選択肢の出処。`cva` の増減が両方向でここの型エラーになる (`directory-structure.md`「コンポーネント配置」) */
const VARIANT_OPTIONS = Object.keys({
  default: null,
  outline: null,
  muted: null,
} satisfies Record<ItemVariant, null>);

const SIZE_OPTIONS = Object.keys({
  default: null,
  sm: null,
  xs: null,
} satisfies Record<ItemSize, null>);

/**
 * `ItemMedia` の variant は `Item` の `argTypes` に出せないので control では切り替えられない。
 * 網羅は 1 つの story の中で全件を並べて守る。`cva` に variant を足すと、この対応表の
 * `satisfies` がここで落ちる (ADR-0022)
 */
const MEDIA_VARIANT_LABELS = {
  default: "下地なし",
  icon: "アイコン",
  image: "画像",
} satisfies Record<ItemMediaVariant, string>;

const MEDIA_VARIANTS: (keyof typeof MEDIA_VARIANT_LABELS)[] = ["default", "icon", "image"];

function ItemBody({ media, actions }: { media?: ReactNode; actions?: ReactNode }) {
  return (
    <>
      {media}
      <ItemContent>
        <ItemTitle>買い物リスト</ItemTitle>
        <ItemDescription>3 件の項目</ItemDescription>
      </ItemContent>
      {actions}
    </>
  );
}

const meta = {
  component: Item,
  argTypes: {
    variant: { control: "inline-radio", options: VARIANT_OPTIONS },
    size: { control: "inline-radio", options: SIZE_OPTIONS },
  },
  render: (args) => (
    <Item {...args}>
      <ItemBody />
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

/** 操作を添えた形。`ItemActions` が右端を受け持つ */
export const WithActions: Story = {
  args: { variant: "outline" },
  render: (args) => (
    <Item {...args}>
      <ItemBody
        actions={
          <ItemActions>
            <Button size="sm" variant="ghost">
              開く
            </Button>
          </ItemActions>
        }
      />
    </Item>
  ),
};

/** `ItemMedia` の 3 通り。型から引くので、`cva` に足すとここが型エラーになる */
export const MediaVariants: Story = {
  render: (args) => (
    <div className="flex w-full flex-col gap-4">
      {MEDIA_VARIANTS.map((variant) => (
        <Item key={variant} {...args} variant="outline">
          <ItemMedia variant={variant}>
            <FileTextIcon aria-hidden />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{MEDIA_VARIANT_LABELS[variant]}</ItemTitle>
          </ItemContent>
        </Item>
      ))}
    </div>
  ),
};

/**
 * 並べる形。`ItemGroup` の既定は `role="list"` の div だが、その形だと子に
 * `role="listitem"` が要り、`<li>` は ul/ol/menu の中でしか置けないので HTML が破綻する。
 * `render` で `ul` / `li` へ倒すと ARIA も content model も揃う (`base-ui.md`「ItemGroup」)
 */
export const Grouped: Story = {
  render: () => (
    <ItemGroup render={<ul />}>
      <Item render={<li />}>
        <ItemContent>
          <ItemTitle>買い物リスト</ItemTitle>
        </ItemContent>
      </Item>
      <ItemSeparator render={<li />} />
      <Item render={<li />}>
        <ItemContent>
          <ItemTitle>読みたい本</ItemTitle>
        </ItemContent>
      </Item>
    </ItemGroup>
  ),
};
