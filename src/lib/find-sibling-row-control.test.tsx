import { describe, expect, it } from "vite-plus/test";
import type { Locator } from "vite-plus/test/browser/context";
import { render } from "vitest-browser-react";

import type { Screen } from "@/test/assert/screen-assertions";

import { findSiblingRowControl } from "./find-sibling-row-control";

type Actions = "both" | "none" | "disabled" | "aria-disabled";

/** 名前の列と、編集・削除の 2 つのボタンを持つ操作の列を持つ表。`actions` で行ごとの操作の状態を決める */
async function renderTable(rows: { name: string; actions: Actions }[]) {
  return await render(
    <table>
      <thead>
        <tr>
          <th>名前</th>
          <th>
            <button type="button">見出しのボタン</button>
            <button type="button">見出しのボタン 2</button>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ name, actions }) => (
          <tr key={name}>
            <td>{name}</td>
            <td>
              {actions !== "none" && (
                <div>
                  <button type="button">{`${name}を編集`}</button>
                  <button
                    type="button"
                    disabled={actions === "disabled"}
                    aria-disabled={actions === "aria-disabled" ? true : undefined}
                  >{`${name}を削除`}</button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>,
  );
}

function deleteButton(screen: Screen, name: string) {
  return screen.getByRole("button", { name: `${name}を削除` });
}

/** 返った要素へ focus を移す。どの要素が返ったかは、移った先を `toHaveFocus` で見る */
function focusSiblingOf(control: Locator) {
  findSiblingRowControl(control.element())?.focus();
}

describe("findSiblingRowControl", () => {
  it("次の行の、同じ列の同じ位置の操作を返す", async () => {
    const screen = await renderTable([
      { name: "A", actions: "both" },
      { name: "B", actions: "both" },
      { name: "C", actions: "both" },
    ]);

    focusSiblingOf(deleteButton(screen, "B"));

    // 同じセルに編集が先に並ぶので、位置を取り違えると編集へ移る
    await expect.element(deleteButton(screen, "C")).toHaveFocus();
  });

  it("最後の行なら前の行の操作を返す", async () => {
    const screen = await renderTable([
      { name: "A", actions: "both" },
      { name: "B", actions: "both" },
      { name: "C", actions: "both" },
    ]);

    focusSiblingOf(deleteButton(screen, "C"));

    // 前の行は近い順に探す。遠い順だと A へ移る
    await expect.element(deleteButton(screen, "B")).toHaveFocus();
  });

  it("操作が無い行と、無効な操作 (disabled と aria-disabled) の行を飛ばす", async () => {
    const screen = await renderTable([
      { name: "A", actions: "both" },
      { name: "B", actions: "none" },
      { name: "C", actions: "disabled" },
      { name: "D", actions: "aria-disabled" },
      { name: "E", actions: "both" },
    ]);

    focusSiblingOf(deleteButton(screen, "A"));

    await expect.element(deleteButton(screen, "E")).toHaveFocus();
  });

  it("後ろの行に移せる操作が無ければ、前の行から探す", async () => {
    const screen = await renderTable([
      { name: "A", actions: "both" },
      { name: "B", actions: "both" },
      { name: "C", actions: "aria-disabled" },
    ]);

    focusSiblingOf(deleteButton(screen, "B"));

    await expect.element(deleteButton(screen, "A")).toHaveFocus();
  });

  it("ほかの行に移せる操作が無ければ null を返し、見出しの行には移さない", async () => {
    const screen = await renderTable([{ name: "A", actions: "both" }]);
    const control = deleteButton(screen, "A");

    await expect.poll(() => findSiblingRowControl(control.element())).toBeNull();
  });

  it("表の行の中に無い要素なら null を返す", async () => {
    const screen = await render(<button type="button">表の外</button>);
    const control = screen.getByRole("button", { name: "表の外" });

    await expect.poll(() => findSiblingRowControl(control.element())).toBeNull();
  });
});
