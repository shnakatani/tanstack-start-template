import type { Row } from "@tanstack/react-table";
import type { ComponentProps, ReactNode } from "react";
import { describe, expectTypeOf, it } from "vite-plus/test";

import type { DataTable } from "./data-table";
import type { DataTableFeatures } from "./data-table-features";

type Fruit = { id: number; name: string };
type Props = ComponentProps<typeof DataTable<Fruit>>;
type Base = Pick<Props, "tableKey" | "caption" | "columns" | "data">;
type GetRowId = (fruit: Fruit) => string;
type GetRowCanExpand = (row: Row<DataTableFeatures, Fruit>) => boolean;
type RenderSubComponent = (props: { row: Row<DataTableFeatures, Fruit> }) => ReactNode;

// 行を開く 2 つの prop は対で渡し、対で渡すときは getRowId も要る (ADR-0043)。
// 検査のされ方は docs/guides/testing/type-tests.md「型テストを置く」
describe("行を開く prop の型契約", () => {
  it("2 つの prop と getRowId をそろえたときだけ通す", () => {
    expectTypeOf<
      Base & {
        getRowId: GetRowId;
        getRowCanExpand: GetRowCanExpand;
        renderSubComponent: RenderSubComponent;
      }
    >().toExtend<Props>();
    expectTypeOf<Base & { getRowId?: GetRowId }>().toExtend<Props>();
  });

  it("片方だけを渡すと通さない", () => {
    // 開いても何も出ない
    expectTypeOf<
      Base & { getRowId: GetRowId; getRowCanExpand: GetRowCanExpand }
    >().not.toExtend<Props>();
    // 開く手段が無い
    expectTypeOf<
      Base & { getRowId: GetRowId; renderSubComponent: RenderSubComponent }
    >().not.toExtend<Props>();
  });

  it("対で渡して getRowId を渡さないと通さない", () => {
    expectTypeOf<
      Base & { getRowCanExpand: GetRowCanExpand; renderSubComponent: RenderSubComponent }
    >().not.toExtend<Props>();
  });
});
