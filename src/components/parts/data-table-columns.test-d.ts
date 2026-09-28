import { expectTypeOf } from "vite-plus/test";

import { columnBaseFrom } from "./data-table-columns";

const base = columnBaseFrom({ name: "名前", price: "価格" });

// 見出しの定数に無い id は型で止まる
// @ts-expect-error -- "prcie" は定数のキーに無い
base("prcie");

// id は literal のまま返り、見出しは定数の値の型を保つ
expectTypeOf(base("price")).toEqualTypeOf<{ id: "price"; header: "価格" }>();
