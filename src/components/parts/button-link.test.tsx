import { RouterProvider } from "@tanstack/react-router";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { createTestRouter } from "@/test/create-test-router";

import { ButtonLink } from "./button-link";

// 検証対象はリンクの描画と寸法。to は routeTree の実在パスしか受け付けないため /notes を渡す
describe("ButtonLink", () => {
  it("リンクテキストが表示される", async () => {
    const router = createTestRouter("/", () => <ButtonLink to="/notes">メモ一覧へ</ButtonLink>);
    const screen = await render(<RouterProvider router={router} />);

    expect(screen.getByText("メモ一覧へ").query()).not.toBeNull();
  });

  it("リンクが a 要素としてレンダリングされる", async () => {
    const router = createTestRouter("/", () => <ButtonLink to="/notes">メモ一覧へ</ButtonLink>);
    const screen = await render(<RouterProvider router={router} />);

    expect(screen.getByRole("link").query()).not.toBeNull();
  });

  // registry の子孫セレクタ (button-group.tsx の `[data-slot=button]` 等) が
  // Button と同じ意匠のリンクも対象に含められるようにする
  it("registry の Button と同じ data-slot を持つ", async () => {
    const router = createTestRouter("/", () => <ButtonLink to="/notes">メモ一覧へ</ButtonLink>);
    const screen = await render(<RouterProvider router={router} />);

    expect(screen.getByRole("link").element().getAttribute("data-slot")).toBe("button");
  });

  // Empty 状態の CTA が使う組み合わせ。テキストリンクの意匠のまま WCAG 2.2 AA 2.5.8 の
  // 24px 床を満たすことが採用理由なので、床を回帰として固定する (ADR-0007)
  it("variant=link size=sm は 24px の床を満たす", async () => {
    const router = createTestRouter("/", () => (
      <ButtonLink variant="link" size="sm" to="/notes">
        新規登録する
      </ButtonLink>
    ));
    const screen = await render(<RouterProvider router={router} />);

    expect(
      screen.getByRole("link").element().getBoundingClientRect().height,
    ).toBeGreaterThanOrEqual(24);
  });

  // registry の link variant は下線つきのテキストリンクとして描く (Empty 状態の CTA の意匠)
  it("variant=link は下線を持つ", async () => {
    const router = createTestRouter("/", () => (
      <ButtonLink variant="link" size="sm" to="/notes">
        新規登録する
      </ButtonLink>
    ));
    const screen = await render(<RouterProvider router={router} />);

    expect(screen.getByRole("link").element().getAttribute("class")).toContain(
      "underline-offset-4",
    );
  });
});
