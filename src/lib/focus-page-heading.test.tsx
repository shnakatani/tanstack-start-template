import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { focusPageHeading, moveFocusToPageHeading, statusHeadingProps } from "./focus-page-heading";

afterEach(() => {
  vi.restoreAllMocks();
});

// focus の移り先は locator の toHaveFocus で見る。body は role で引けないので document.activeElement と比べる
describe("focusPageHeading", () => {
  it("focus していた要素が消えて body にあるとき、h1 へ移し tabindex=-1 を付ける", async () => {
    const screen = await render(<h1>ページ</h1>);
    focusPageHeading(false);
    const heading = screen.getByRole("heading", { name: "ページ" });
    await expect.element(heading).toHaveFocus();
    await expect.element(heading).toHaveAttribute("tabindex", "-1");
  });

  it("activeElement が null (focus を持つ要素が無い) のとき、h1 へ移す", async () => {
    const screen = await render(
      <>
        <button type="button">遷移前に押したボタン</button>
        <h1>ページ</h1>
      </>,
    );
    // 遷移中に focus が移ったと渡し、null が「移っていない」扱いで通らないようにする
    const activeElement = vi.spyOn(document, "activeElement", "get").mockReturnValue(null);
    focusPageHeading(true);
    activeElement.mockRestore();
    await expect.element(screen.getByRole("heading", { name: "ページ" })).toHaveFocus();
  });

  it("遷移前と同じ要素に focus が残っているとき (押したリンクが残る)、h1 へ移す", async () => {
    const screen = await render(
      <>
        <a href="/x">リンク</a>
        <h1>ページ</h1>
      </>,
    );
    const link = document.querySelector("a");
    link?.focus();
    focusPageHeading(false);
    await expect.element(screen.getByRole("heading", { name: "ページ" })).toHaveFocus();
  });

  it("遷移中に別の要素へ focus が移っていたら奪わない", async () => {
    const screen = await render(
      <>
        <a href="/x">リンク</a>
        <input aria-label="入力" />
        <h1>ページ</h1>
      </>,
    );
    const input = screen.getByRole("textbox", { name: "入力" });
    input.element().focus();
    focusPageHeading(true);
    await expect.element(input).toHaveFocus();
  });

  // 隠れているかは移し先で判定する。見える h1 があっても、隠れた印の要素へも h1 へも移さない
  it("状態の見出しが支援技術から隠れているとき、見える h1 があっても移さない", async () => {
    await render(
      <>
        <h1>ページ</h1>
        <div aria-hidden="true">
          <h2 {...statusHeadingProps}>エラーが発生しました</h2>
        </div>
      </>,
    );
    focusPageHeading(false);
    expect(document.activeElement).toBe(document.body);
    expect(document.querySelector("h1")?.hasAttribute("tabindex")).toBe(false);
  });

  it.each([
    ["祖先が aria-hidden", { "aria-hidden": true }],
    ["祖先が inert", { inert: true }],
  ])("見出しが支援技術から隠れているとき (%s)、見出しへ移さない", async (_, hiding) => {
    await render(
      <div {...hiding}>
        <h1>背後のページ</h1>
      </div>,
    );
    focusPageHeading(false);
    expect(document.activeElement).toBe(document.body);
    // 隠れた見出しは role で引けないので querySelector で掴む
    expect(document.querySelector("h1")?.hasAttribute("tabindex")).toBe(false);
  });

  it("aria-modal のダイアログが開いているときは、外側が隠れていなくても見出しへ移さない", async () => {
    const screen = await render(
      <>
        <h1>背後のページ</h1>
        {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- div に role を付けて aria-modal でモーダルを表すダイアログ部品の形を再現する */}
        <div role="dialog" aria-modal="true" aria-label="ダイアログ">
          <button type="button">閉じる</button>
        </div>
      </>,
    );
    focusPageHeading(false);
    await expect.element(screen.getByRole("dialog", { name: "ダイアログ" })).toBeVisible();
    expect(document.activeElement).toBe(document.body);
  });

  it("aria-modal のダイアログが閉じて hidden なら、見出しへ移す", async () => {
    // Base UI の keepMounted のように、閉じたダイアログを hidden で残す形
    const screen = await render(
      <>
        <h1>ページ</h1>
        <div role="alertdialog" aria-modal="true" aria-label="閉じたダイアログ" hidden />
      </>,
    );
    focusPageHeading(false);
    await expect.element(screen.getByRole("heading", { name: "ページ" })).toHaveFocus();
  });

  it("既に tabindex を持つ h1 の値を書き換えない", async () => {
    // JSX の tabIndex={0} は jsx-a11y/no-noninteractive-tabindex に引っかかるため、
    // 描画後に属性を直接付与して「既存の値を持つ h1」を作る
    const screen = await render(<h1>ページ</h1>);
    const heading = screen.getByRole("heading", { name: "ページ" });
    heading.element().setAttribute("tabindex", "0");
    focusPageHeading(false);
    await expect.element(heading).toHaveAttribute("tabindex", "0");
  });

  it("h1 が無いときは body へ移し、警告を残す", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await render(<button type="button">遷移前に押したボタン</button>);
    const button = document.querySelector("button");
    button?.focus();
    focusPageHeading(false);
    expect(document.activeElement).toBe(document.body);
    expect(document.body.hasAttribute("tabindex")).toBe(false);
    expect(warn).toHaveBeenCalledWith("[focusPageHeading] 移し先の見出しが無い", expect.anything());
  });

  it("h1 が無いとき、キーボード操作の後に呼んでも body は :focus-visible にならない", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await render(<button type="button">前の要素</button>);
    const button = document.querySelector("button");
    // Tab でブラウザに「直前の操作はキーボード」と判定させる (下の見出しのケースと同じ)
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(button);
    // focusBody は focus の直後に tabindex を外すので、呼んだ後の body は :focus-visible の判定に
    // かからない。focus を受けた時点 (tabindex がある間) の判定を focus イベントで読む
    const focusVisibleAtFocus: boolean[] = [];
    document.body.addEventListener(
      "focus",
      () => focusVisibleAtFocus.push(document.body.matches(":focus-visible")),
      { once: true },
    );
    focusPageHeading(false);
    expect(document.activeElement).toBe(document.body);
    expect(focusVisibleAtFocus).toEqual([false]);
  });

  it("キーボード操作の後に呼んでも、見出しは :focus-visible にならない", async () => {
    const screen = await render(
      <>
        <button type="button">前の要素</button>
        <h1>ページ</h1>
      </>,
    );
    // Tab を押してブラウザに「直前の操作はキーボード」と判定させる。この状態のまま
    // 素の .focus() を呼ぶとブラウザの既定判定で :focus-visible になる。
    // 遷移中に focus が移らなかったと渡す (早期 return させない)
    await userEvent.keyboard("{Tab}");
    await expect.element(screen.getByRole("button", { name: "前の要素" })).toHaveFocus();
    const heading = screen.getByRole("heading", { name: "ページ" });
    focusPageHeading(false);
    await expect.element(heading).toHaveFocus();
    await expect.poll(() => heading.element().matches(":focus-visible")).toBe(false);
  });

  it("focus でスクロールしない", async () => {
    await render(
      <>
        <div style={{ height: "300vh" }} />
        <h1>ページ</h1>
      </>,
    );
    window.scrollTo(0, 0);
    focusPageHeading(false);
    expect(window.scrollY).toBe(0);
  });

  // 失敗の画面では、ページの名前の h1 の下に失敗の見出しが出る。h1 へ移すと失敗が focus で伝わらない
  it.each([
    ["focusPageHeading", () => focusPageHeading(false)],
    ["moveFocusToPageHeading", moveFocusToPageHeading],
  ])(
    "%s は、状態の見出しの印があれば、文書順で先の h1 より先にそこへ移す",
    async (_, moveFocus) => {
      const screen = await render(
        <>
          <h1>ページ</h1>
          <h2 {...statusHeadingProps}>エラーが発生しました</h2>
        </>,
      );
      moveFocus();
      const statusHeading = screen.getByRole("heading", { name: "エラーが発生しました" });
      await expect.element(statusHeading).toHaveFocus();
      await expect.element(statusHeading).toHaveAttribute("tabindex", "-1");
    },
  );
});
