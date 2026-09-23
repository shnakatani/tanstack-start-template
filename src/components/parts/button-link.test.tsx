import { RouterProvider } from "@tanstack/react-router";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { createTestRouter } from "@/test/create-test-router";
import { expectText } from "@/test/page-helpers";

import { ButtonLink } from "./button-link";

// to は routeTree の実在パスしか受け付けないため /notes を渡す
/**
 * 状態のカタログは `button-link.stories.tsx` が持つ (ADR-0053)。ここに残すのは、要素が `a` で
 * あること・`data-slot`・`button-group` の子孫セレクタが当たる経路で、story に play が無い
 * (ADR-0053 の args だけで状態が決まる部品) 以上ここでしか固定できない (ADR-0055 の役割分担)。
 *
 * 寸法は測らない。24px の床は registry の size 目盛りが持つデザインシステムの規範で、
 * 消費側が縮められないことは層の規則 (ADR-0014 / ADR-0032) が止める。値を焼き付けると上流が寸法を変えただけで落ちる。
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
