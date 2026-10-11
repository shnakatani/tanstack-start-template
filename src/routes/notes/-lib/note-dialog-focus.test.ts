import { describe, expect, it } from "vite-plus/test";

import { hasNotesChildMatch } from "./note-dialog-focus";

describe("hasNotesChildMatch", () => {
  it("一覧の route の後ろに子の match があれば true", () => {
    expect(
      hasNotesChildMatch([
        { routeId: "__root__" },
        { routeId: "/notes" },
        { routeId: "/notes/new" },
      ]),
    ).toBe(true);
  });

  it("一覧の route の match が末尾にあり、子の match が無ければ false", () => {
    expect(hasNotesChildMatch([{ routeId: "__root__" }, { routeId: "/notes" }])).toBe(false);
  });

  it("一覧の route の match が無ければ (別のページ)、ほかの match があっても false", () => {
    expect(hasNotesChildMatch([{ routeId: "__root__" }, { routeId: "/" }])).toBe(false);
  });
});
