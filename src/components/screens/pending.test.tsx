import { expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { PendingContent } from "./pending";

it("読み込み中であることを busy な status として示す", async () => {
  const screen = await render(<PendingContent />);

  const status = screen.getByRole("status", { name: "読み込み中" });
  await expect.element(status).toBeInTheDocument();
  await expect.element(status).toHaveAttribute("aria-busy", "true");
});
