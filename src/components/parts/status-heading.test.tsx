import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { focusPageHeading } from "@/lib/focus-page-heading";

import { StatusHeading } from "./status-heading";

/** 状態のカタログは `status-heading.stories.tsx` が持つ。ここに残すのは見出しの level と、遷移の後の focus の移し先になること */
describe("StatusHeading", () => {
  it.each([1, 2] as const)("level %i の見出しとして描く", async (level) => {
    const screen = await render(<StatusHeading title="エラーが発生しました" level={level} />);

    await expect
      .element(screen.getByRole("heading", { name: "エラーが発生しました", level }))
      .toBeInTheDocument();
  });

  it("文書順で先の h1 より先に、遷移の後の focus の移し先になる", async () => {
    const screen = await render(
      <>
        <h1>ページ</h1>
        <StatusHeading title="エラーが発生しました" level={2} />
      </>,
    );
    focusPageHeading(null);

    await expect
      .element(screen.getByRole("heading", { name: "エラーが発生しました" }))
      .toHaveFocus();
  });
});
