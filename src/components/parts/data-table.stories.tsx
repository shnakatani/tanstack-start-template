import type { Meta, StoryObj } from "@storybook/tanstack-react";
import type { Row } from "@tanstack/react-table";
import { createColumnHelper, Subscribe } from "@tanstack/react-table";
import { expect, screen, userEvent } from "storybook/test";

import { DataTable } from "./data-table";
import type { DataTableCellContext, DataTableFeatures } from "./data-table-features";

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
  args: { caption: "果物の一覧", columns, data: FRUITS },
} satisfies Meta<typeof DataTable<Fruit>>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { tableKey: "fruits-default" } };

/** data が空のときは列数ぶんの colSpan を持つ案内行を 1 つ描く */
export const Empty: Story = {
  args: { tableKey: "fruits-empty", data: [] },
};

/** rowProps で行ごとに busy を表す。半透明は registry の TableRow が data-busy から当てる */
export const BusyRow: Story = {
  args: {
    tableKey: "fruits-busy-row",
    rowProps: ({ original }) => ({ "data-busy": original.id === 2 }),
  },
};

/** 行を開くボタンの cell。開いた状態は表の state なので、部品の中で Subscribe して読む */
function ToggleCell({ row }: DataTableCellContext<Fruit>) {
  if (!row.getCanExpand()) {
    return null;
  }
  return (
    <Subscribe source={row.table.atoms.expanded} selector={() => row.getIsExpanded()}>
      {(isExpanded) => (
        <button type="button" aria-expanded={isExpanded} onClick={row.getToggleExpandedHandler()}>
          {`${row.original.name}の詳細`}
        </button>
      )}
    </Subscribe>
  );
}

function FruitDetail({ row }: { row: Row<DataTableFeatures, Fruit> }) {
  return `${row.original.name}は${row.original.price}円`;
}

/** 行を開くと、全列をまたぐ詳細の行を本体の行の直後に出す。開けない行 (みかん) にはボタンを出さない */
export const Expandable: Story = {
  args: {
    tableKey: "fruits-expandable",
    columns: helper.columns([
      helper.display({ id: "toggle", header: "詳細", cell: ToggleCell }),
      ...columns,
    ]),
    getRowId: (fruit) => String(fruit.id),
    getRowCanExpand: ({ original }) => original.id !== 2,
    renderSubComponent: FruitDetail,
  },
  play: async () => {
    const toggle = screen.getByRole("button", { name: "りんごの詳細" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(toggle);

    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(screen.getByRole("cell", { name: "りんごは120円" })).toBeInTheDocument();
    await expect(screen.queryByRole("button", { name: "みかんの詳細" })).not.toBeInTheDocument();
  },
};
