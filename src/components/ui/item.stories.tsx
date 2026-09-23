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

import { variantOptions } from "./variant-options.story-helpers";

type ItemVariant = NonNullable<ComponentProps<typeof Item>["variant"]>;
type ItemSize = NonNullable<ComponentProps<typeof Item>["size"]>;
type ItemMediaVariant = NonNullable<ComponentProps<typeof ItemMedia>["variant"]>;

const VARIANT_OPTIONS = variantOptions({
  default: null,
  outline: null,
  muted: null,
} satisfies Record<ItemVariant, null>);

const SIZE_OPTIONS = variantOptions({
  default: null,
  sm: null,
  xs: null,
} satisfies Record<ItemSize, null>);

/**
 * `ItemMedia` の variant は `Item` の `argTypes` に出せないので control では切り替えられない。
 * 網羅は 1 つの story の中で全件を並べて守る。`cva` に variant を足すと、この対応表の
 * `satisfies` がここで落ちる (ADR-0044)
 */
const MEDIA_VARIANT_LABELS = {
  default: "下地なし",
  icon: "アイコン",
  image: "画像",
} satisfies Record<ItemMediaVariant, string>;

/**
 * 並べる variant は対応表から引く。リテラルで並べ直すと、variant を足したときに
 * `MEDIA_VARIANT_LABELS` の `satisfies` は落ちるのにこの配列は古いまま型検査を通り、
 * 「全件を並べて網羅を守る」という上の前提が静かに崩れる
 */
function mediaVariants(): ItemMediaVariant[] {
  const labels: Record<ItemMediaVariant, string> = MEDIA_VARIANT_LABELS;
  // filter は実行時には全件を通す。`Object.keys` が string[] を返すのを型アサーション無しで
  // 絞る手が型述語しかないため置いている (型アサーションは ADR-0009 が禁じている)
  return Object.keys(labels).filter((key): key is ItemMediaVariant => key in labels);
}

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
      {mediaVariants().map((variant) => (
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
 * `render` で `ul` / `li` へ倒すと ARIA も content model も揃う (ADR-0024)
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
