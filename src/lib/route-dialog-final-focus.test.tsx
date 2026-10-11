import { describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { createRouteDialogFinalFocus } from "./route-dialog-final-focus";

// 戻し先は同一性で比べるので、要素は querySelector で掴む
describe("createRouteDialogFinalFocus", () => {
  it("作った時点ではなく、返した関数が呼ばれた時点で isDialogShown と findReturnTarget を呼ぶ", async () => {
    await render(<a href="/items">開いた元のリンク</a>);
    const link = document.querySelector("a");
    expect.assert(link !== null);
    let dialogShown = true;
    const isDialogShown = vi.fn(() => dialogShown);
    const findReturnTarget = vi.fn(() => link);

    const finalFocus = createRouteDialogFinalFocus({ isDialogShown, findReturnTarget });
    expect(isDialogShown).not.toHaveBeenCalled();
    expect(findReturnTarget).not.toHaveBeenCalled();

    // 作った後でダイアログの route が外れた (戻るで離れた)。作った時点の値で判定すると「替わった」になり false を返す
    dialogShown = false;
    expect(finalFocus(false)).toBe(link);
    expect(isDialogShown).toHaveBeenCalledOnce();
    expect(findReturnTarget).toHaveBeenCalledOnce();
  });

  it("閉じたときに戻し先が無ければ、ページの見出しへ移し、Base UI へは false を返す", async () => {
    const screen = await render(<h1>ページ</h1>);

    const finalFocus = createRouteDialogFinalFocus({
      isDialogShown: () => true,
      findReturnTarget: () => null,
    });

    expect(finalFocus(true)).toBe(false);
    await expect.element(screen.getByRole("heading", { name: "ページ" })).toHaveFocus();
  });

  it("開いたまま別のダイアログに替わったら、戻し先があっても focus に触れず false を返す", async () => {
    await render(
      <>
        <h1>ページ</h1>
        <a href="/items">開いた元のリンク</a>
      </>,
    );
    const link = document.querySelector("a");
    expect.assert(link !== null);

    const finalFocus = createRouteDialogFinalFocus({
      isDialogShown: () => true,
      findReturnTarget: () => link,
    });

    expect(finalFocus(false)).toBe(false);
    expect(document.activeElement).toBe(document.body);
  });
});
