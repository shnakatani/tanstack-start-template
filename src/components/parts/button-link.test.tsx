import { RouterProvider } from "@tanstack/react-router";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { createTestRouter } from "@/test/create-test-router";
import { expectText } from "@/test/page-helpers";

import { ButtonLink } from "./button-link";

// to は routeTree の実在パスしか受け付けないため /notes を渡す
/**
 * 状態のカタログは `button-link.stories.tsx` が持つ。ここに残すのは、要素が `a` であること・
 * `data-slot`・`button-group` の子孫セレクタが当たる経路で、args だけで状態が決まる部品なので
 * story に play が無い以上、ここでしか固定できない
 * (docs/guides/storybook.md「カタログと play の範囲」「story とブラウザテストの分担」)。
 *
 * 寸法は測らない。寸法は registry の size 目盛りが決め、上流が決める値なので、測ると上流が変えただけで落ちる。
 * 消費側が縮められないことは層の規則 (ADR-0016 / ADR-0031) が止める。
 */
describe("ButtonLink", () => {
  it("リンクテキストが表示される", async () => {
    const router = createTestRouter("/", () => <ButtonLink to="/notes">メモ一覧へ</ButtonLink>);
    const screen = await render(<RouterProvider router={router} />);

    await expectText(screen, "メモ一覧へ");
  });

  it("リンクが a 要素としてレンダリングされる", async () => {
    const router = createTestRouter("/", () => <ButtonLink to="/notes">メモ一覧へ</ButtonLink>);
    const screen = await render(<RouterProvider router={router} />);

    await expect.element(screen.getByRole("link")).toBeInTheDocument();
  });

  // registry の子孫セレクタ (button-group.tsx の `[data-slot=button]` 等) が
  // Button と同じ意匠のリンクも対象に含められるようにする
  it("registry の Button と同じ data-slot を持つ", async () => {
    const router = createTestRouter("/", () => <ButtonLink to="/notes">メモ一覧へ</ButtonLink>);
    const screen = await render(<RouterProvider router={router} />);

    await expect.element(screen.getByRole("link")).toHaveAttribute("data-slot", "button");
  });

  // registry の link variant は下線つきのテキストリンクとして描く (Empty 状態の CTA の意匠)
  it("variant=link は下線を持つ", async () => {
    const router = createTestRouter("/", () => (
      <ButtonLink variant="link" size="sm" to="/notes">
        新規登録する
      </ButtonLink>
    ));
    const screen = await render(<RouterProvider router={router} />);

    await expect.element(screen.getByRole("link")).toHaveClass("underline-offset-4");
  });
});
