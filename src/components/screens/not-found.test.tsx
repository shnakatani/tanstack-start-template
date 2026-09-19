import { RouterProvider } from "@tanstack/react-router";
import { expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { createTestRouter } from "@/test/create-test-router";

import { NotFoundContent } from "./not-found";

// ButtonLink は createLink 由来で router context を要求するため、テスト router に載せる
it("見つからなかったことと復帰導線を示す", async () => {
  const screen = await render(
    <RouterProvider
      router={createTestRouter("/", () => (
        <NotFoundContent />
      ))}
    />,
  );

  expect(
    screen.getByRole("heading", { name: "ページが見つかりません", level: 1 }).query(),
  ).not.toBeNull();
  expect(screen.getByRole("link", { name: "ホームへ戻る" }).query()).not.toBeNull();
});
