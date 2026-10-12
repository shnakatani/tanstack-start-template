import { RouterProvider } from "@tanstack/react-router";
import { createRef } from "react";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { createTestRouter } from "@/test/app/create-test-router";
import { expectText } from "@/test/assert/screen-assertions";

import { ButtonLink } from "./button-link";

// to は routeTree の実在パスしか受け付けないため /notes を渡す
/**
 * 状態のカタログは `button-link.stories.tsx` が持つ。ここに残すのは、要素が `a` であること・
 * `data-slot`・`button-group` の子孫セレクタが当たる経路で、args だけで状態が決まる部品なので
 * story に play が無い以上、ここでしか固定できない
 * (docs/guides/storybook.md「カタログと play の範囲」「story とブラウザテストの分担」)。
 *
 * 寸法の絶対値は測らない。寸法は registry の size 目盛りが決め、上流が決める値なので、測ると上流が変えただけで落ちる。
 * 消費側が縮められないことは層の規則 (ADR-0011 / ADR-0022) が止める。`isPending` の前後の幅は 2 回の観測の
 * 比較で、目盛りを pin しない。
 */
describe("ButtonLink", () => {
  // 幅を保つ仕組みは PendingLabel が持つ (pending-label.test.tsx)。ここで見るのは、`isPending` が children を
  // その仕組みへ通すことと、名前が pending 中も保たれること
  it("isPending の間も幅と children からの名前を保つ (ADR-0042)", async () => {
    const router = createTestRouter("/", () => (
      <>
        <ButtonLink to="/notes" variant="outline" size="sm" isPending={false}>
          編集
        </ButtonLink>
        <ButtonLink to="/notes" variant="outline" size="sm" isPending>
          編集
        </ButtonLink>
      </>
    ));
    const screen = await render(<RouterProvider router={router} />);
    const idle = screen.getByRole("link", { name: "編集" }).nth(0);
    const pending = screen.getByRole("link", { name: "編集" }).nth(1);
    // `aria-label` が無いので、不可視の label を部品が `aria-labelledby` で指す。外れると pending 側の名前が空になり、
    // この locator が 2 つ目を見つけられない
    await expect.element(pending.getBySlot("spinner")).toHaveAttribute("aria-hidden", "true");
    const widthIdle = idle.element().getBoundingClientRect().width;

    await expect
      .poll(() => pending.element().getBoundingClientRect().width)
      .toBeCloseTo(widthIdle, 0);
  });

  it("aria-label を渡した isPending のリンクはその名前を持ち、isPending を a の属性に流さない", async () => {
    const router = createTestRouter("/", () => (
      <ButtonLink to="/notes" aria-label="メモを編集" isPending>
        編集
      </ButtonLink>
    ));
    const screen = await render(<RouterProvider router={router} />);

    const link = screen.getByRole("link", { name: "メモを編集" });
    await expect.element(link).toBeInTheDocument();
    await expect.element(link).not.toHaveAttribute("aria-labelledby");
    // createLink は router の option 以外の prop を描く要素へ流す (`link.js` の collectElementProps)。
    // 部品で受け止めないと `ispending` 属性が a に付き、React が unknown prop の warn を出す
    await expect.element(link).not.toHaveAttribute("ispending");
  });

  it("isPending を渡さない呼び出しでは children をそのまま描く", async () => {
    const router = createTestRouter("/", () => <ButtonLink to="/notes">メモ一覧へ</ButtonLink>);
    const screen = await render(<RouterProvider router={router} />);

    const link = screen.getByRole("link", { name: "メモ一覧へ" });
    await expect.element(link).toHaveTextContent("メモ一覧へ");
    await expect.element(link).not.toHaveAttribute("aria-labelledby");
    // 包む span が無く、文字が a の直下にある。利用者が icon と文字を並べたとき buttonVariants の gap が効く
    await expect.poll(() => link.element().childElementCount).toBe(0);
  });

  it("リンクテキストが表示される", async () => {
    const router = createTestRouter("/", () => <ButtonLink to="/notes">メモ一覧へ</ButtonLink>);
    const screen = await render(<RouterProvider router={router} />);

    await expectText(screen, "メモ一覧へ");
  });

  // createLink は Link の ref を部品へ渡す。部品が ref を a へ渡さないと、利用者の ref が a を指さない
  it("ref が描画された a 要素を指す", async () => {
    const ref = createRef<HTMLAnchorElement>();
    const router = createTestRouter("/", () => (
      <ButtonLink ref={ref} to="/notes">
        メモ一覧へ
      </ButtonLink>
    ));
    const screen = await render(<RouterProvider router={router} />);

    await expect.poll(() => ref.current === screen.getByRole("link").query()).toBe(true);
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

  // Router の Link は disabled のとき href を外して aria-disabled を付ける (`link.js` の linkDisabled)。
  // buttonVariants は aria-disabled ではなく data-disabled で薄くするので、部品が同じ状態を写す
  it("disabled のとき href を持たず、data-disabled を持つ", async () => {
    const router = createTestRouter("/", () => (
      <ButtonLink to="/notes" disabled>
        メモ一覧へ
      </ButtonLink>
    ));
    const screen = await render(<RouterProvider router={router} />);

    const link = screen.getByRole("link");
    await expect.element(link).toHaveAttribute("aria-disabled", "true");
    await expect.element(link).toHaveAttribute("data-disabled", "");
    await expect.element(link).not.toHaveAttribute("href");
  });

  it("有効なときは data-disabled を持たない", async () => {
    const router = createTestRouter("/", () => <ButtonLink to="/notes">メモ一覧へ</ButtonLink>);
    const screen = await render(<RouterProvider router={router} />);

    await expect.element(screen.getByRole("link")).toHaveAttribute("href", "/notes");
    await expect.element(screen.getByRole("link")).not.toHaveAttribute("data-disabled");
  });
});
