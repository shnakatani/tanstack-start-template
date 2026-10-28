import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { focusPageHeading } from "@/lib/focus-page-heading";

import { StatusHeading } from "./status-heading";

/** 状態のカタログは `status-heading.stories.tsx` が持つ。ここに残すのは見出しの level と、遷移の後の focus の移し先になること */
describe("StatusHeading", () => {
  it("level 2 の見出しとして描く", async () => {
    const screen = await render(<StatusHeading title="エラーが発生しました" />);

    await expect
      .element(screen.getByRole("heading", { name: "エラーが発生しました", level: 2 }))
      .toBeInTheDocument();
  });

  it("文書順で先の h1 より先に、遷移の後の focus の移し先になる", async () => {
    const screen = await render(
      <>
        <h1>ページ</h1>
        <StatusHeading title="エラーが発生しました" />
      </>,
    );
    focusPageHeading(null);

    await expect
      .element(screen.getByRole("heading", { name: "エラーが発生しました" }))
      .toHaveFocus();
  });
});
