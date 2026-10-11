import { describe, expect, it } from "vite-plus/test";

import { isNoteDialogRouteShown } from "./note-dialog-focus";

describe("isNoteDialogRouteShown", () => {
  it.each(["/notes/new", "/notes/$noteId/edit"])("%s が表示されていれば true", (routeId) => {
    expect(
      isNoteDialogRouteShown([{ routeId: "__root__" }, { routeId: "/notes" }, { routeId }]),
    ).toBe(true);
  });

  it("一覧だけが表示されていれば false", () => {
    expect(isNoteDialogRouteShown([{ routeId: "__root__" }, { routeId: "/notes" }])).toBe(false);
  });

  it("一覧を離れて別のページが表示されていれば false", () => {
    expect(isNoteDialogRouteShown([{ routeId: "__root__" }, { routeId: "/" }])).toBe(false);
  });
});
