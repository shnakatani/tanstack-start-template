import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { StatusHeading } from "./status-heading";

/** 状態のカタログは `status-heading.stories.tsx` が持つ。ここに残すのは見出しの level */
describe("StatusHeading", () => {
  it("level 2 の見出しとして描く", async () => {
    const screen = await render(<StatusHeading title="エラーが発生しました" />);

    await expect
      .element(screen.getByRole("heading", { name: "エラーが発生しました", level: 2 }))
      .toBeInTheDocument();
  });
});
