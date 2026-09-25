import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { createColumnHelper } from "@tanstack/react-table";

import { DataTable } from "./data-table";
import type { DataTableFeatures } from "./data-table-features";

type Fruit = { id: number; name: string; price: number };

const helper = createColumnHelper<DataTableFeatures, Fruit>();
const columns = helper.columns([
  helper.accessor("name", { header: "名前" }),
  helper.accessor("price", { header: "価格" }),
]);
const FRUITS: Fruit[] = [
  { id: 1, name: "りんご", price: 120 },
  { id: 2, name: "みかん", price: 80 },
];

const meta = {
  component: DataTable<Fruit>,
  args: { columns, data: FRUITS },
} satisfies Meta<typeof DataTable<Fruit>>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { tableKey: "fruits-default" } };

/** data が空のときは列数ぶんの colSpan を持つ案内行を 1 つ描く */
export const Empty: Story = {
  args: { tableKey: "fruits-empty", data: [] },
};

/** rowProps で行ごとに busy を表す。半透明は DataTable が aria-busy から当てる */
export const BusyRow: Story = {
  args: {
    tableKey: "fruits-busy-row",
    rowProps: ({ original }) => ({ "aria-busy": original.id === 2 }),
  },
};
