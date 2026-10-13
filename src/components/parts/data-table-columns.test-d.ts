import { expectTypeOf } from "vite-plus/test";

import { columnBaseFrom } from "./data-table-columns";

const base = columnBaseFrom({
  name: { header: "名前", size: 200 },
  price: { header: "価格", size: 120 },
});

// 見出しの定数に無い id は型で止まる
// @ts-expect-error -- "prcie" は定数のキーに無い
base("prcie");

// id は literal のまま返る
expectTypeOf(base("price")).toEqualTypeOf<{ id: "price"; header: string; size: number }>();
