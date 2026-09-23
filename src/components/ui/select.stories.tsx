import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, screen, userEvent } from "storybook/test";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPTIONS = [
  { value: "draft", label: "下書き" },
  { value: "published", label: "公開中" },
  { value: "archived", label: "アーカイブ" },
];

/**
 * `items` を渡さないとトリガーに生の value が出る (Base UI の Select docs「Formatting the value」)。
 * ここは registry の意匠の見本で、フォームの中では `FormSelectField` (parts) を通す
 */
function SelectExample({ defaultValue }: { defaultValue?: string }) {
  return (
    <Select items={OPTIONS} defaultValue={defaultValue}>
      <SelectTrigger aria-label="状態">
        <SelectValue placeholder="状態を選択" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

/** 開くところまで。選択は既存のブラウザテストが持つ (ADR-0046) */
async function open(): Promise<void> {
  await userEvent.click(screen.getByRole("combobox", { name: "状態" }));
  await screen.findByRole("listbox");
}

const meta = {
  component: Select,
  render: () => <SelectExample />,
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 未選択。placeholder が見えている */
export const Placeholder: Story = {
  play: async () => {
    await expect(screen.getByText("状態を選択")).toBeInTheDocument();
  },
};

/** 選択済み。`items` の対応表からラベルが引かれる */
export const Selected: Story = {
  render: () => <SelectExample defaultValue="published" />,
  play: async () => {
    await expect(screen.getByRole("combobox", { name: "状態" })).toHaveTextContent("公開中");
  },
};

/** 開いた状態。候補は portal へ出るので `screen` から取る */
export const Opened: Story = {
  play: async () => {
    await open();
    await expect(screen.getByRole("option", { name: "下書き" })).toBeInTheDocument();
  },
};

/** 見出しと区切りで候補を分けた形 */
export const Grouped: Story = {
  render: () => (
    <Select items={OPTIONS} defaultValue="draft">
      <SelectTrigger aria-label="状態">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>作業中</SelectLabel>
          <SelectItem value="draft">下書き</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>公開済み</SelectLabel>
          <SelectItem value="published">公開中</SelectItem>
          <SelectItem value="archived">アーカイブ</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
  play: async () => {
    await open();
    await expect(screen.getByText("作業中")).toBeInTheDocument();
  },
};
