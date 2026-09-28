import { expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { PendingContent } from "./pending";

it("読み込み中であることを status の文言で示し、aria-busy を載せない", async () => {
  const screen = await render(<PendingContent />);

  const status = screen.getByRole("status", { name: "読み込み中" });
  await expect.element(status).toHaveTextContent("読み込み中");
  // aria-busy を載せると JAWS が status ごと読み飛ばす
  await expect.element(status).not.toHaveAttribute("aria-busy");
});
