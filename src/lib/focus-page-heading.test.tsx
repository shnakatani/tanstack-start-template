import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { focusPageHeading } from "./focus-page-heading";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("focusPageHeading", () => {
  it("focus していた要素が消えて body にあるとき、h1 へ移し tabindex=-1 を付ける", async () => {
    await render(<h1>ページ</h1>);
    const heading = document.querySelector("h1");
    focusPageHeading(null);
    expect(document.activeElement).toBe(heading);
    expect(heading?.getAttribute("tabindex")).toBe("-1");
  });

  it("activeElement が null (focus を持つ要素が無い) のとき、h1 へ移す", async () => {
    await render(
      <>
        <button type="button">遷移前に押したボタン</button>
        <h1>ページ</h1>
      </>,
    );
    // 遷移前の要素を渡し、null が「遷移前の要素に残っている」扱いで通らないようにする
    const button = document.querySelector("button");
    const activeElement = vi.spyOn(document, "activeElement", "get").mockReturnValue(null);
    focusPageHeading(button);
    activeElement.mockRestore();
    expect(document.activeElement).toBe(document.querySelector("h1"));
  });

  it("遷移前と同じ要素に focus が残っているとき (押したリンクが残る)、h1 へ移す", async () => {
    await render(
      <>
        <a href="/x">リンク</a>
        <h1>ページ</h1>
      </>,
    );
    const link = document.querySelector("a");
    link?.focus();
    focusPageHeading(link);
    expect(document.activeElement).toBe(document.querySelector("h1"));
  });

  it("遷移中に別の要素へ focus が移っていたら奪わない", async () => {
    await render(
      <>
        <a href="/x">リンク</a>
        <input aria-label="入力" />
        <h1>ページ</h1>
      </>,
    );
    const link = document.querySelector("a");
    const input = document.querySelector("input");
    input?.focus();
    focusPageHeading(link);
    expect(document.activeElement).toBe(input);
  });

  it("既に tabindex を持つ h1 の値を書き換えない", async () => {
    // JSX の tabIndex={0} は jsx-a11y/no-noninteractive-tabindex に引っかかるため、
    // 描画後に属性を直接付与して「既存の値を持つ h1」を作る
    await render(<h1>ページ</h1>);
    document.querySelector("h1")?.setAttribute("tabindex", "0");
    focusPageHeading(null);
    expect(document.querySelector("h1")?.getAttribute("tabindex")).toBe("0");
  });

  it("h1 が無いときは body へ移し、警告を残す", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await render(<button type="button">遷移前に押したボタン</button>);
    const button = document.querySelector("button");
    button?.focus();
    focusPageHeading(button);
    expect(document.activeElement).toBe(document.body);
    expect(document.body.hasAttribute("tabindex")).toBe(false);
    expect(warn).toHaveBeenCalledWith("[focusPageHeading] h1 が無い", expect.anything());
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
    focusPageHeading(button);
    expect(document.activeElement).toBe(document.body);
    expect(focusVisibleAtFocus).toEqual([false]);
  });

  it("キーボード操作の後に呼んでも、見出しは :focus-visible にならない", async () => {
    await render(
      <>
        <button type="button">前の要素</button>
        <h1>ページ</h1>
      </>,
    );
    const button = document.querySelector("button");
    // Tab を押してブラウザに「直前の操作はキーボード」と判定させる。この状態のまま
    // 素の .focus() を呼ぶとブラウザの既定判定で :focus-visible になる。
    // 遷移前と同じ要素 (button) に focus が残っているケースを再現するため、
    // focusedBeforeNavigation にも同じ要素を渡す (早期 return させない)
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(button);
    const heading = document.querySelector("h1");
    focusPageHeading(button);
    expect(document.activeElement).toBe(heading);
    expect(heading?.matches(":focus-visible")).toBe(false);
  });

  it("focus でスクロールしない", async () => {
    await render(
      <>
        <div style={{ height: "300vh" }} />
        <h1>ページ</h1>
      </>,
    );
    window.scrollTo(0, 0);
    focusPageHeading(null);
    expect(window.scrollY).toBe(0);
  });
});
