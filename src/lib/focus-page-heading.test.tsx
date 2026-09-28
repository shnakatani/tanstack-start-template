import { afterEach, describe, expect, it, vi } from "vite-plus/test";
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
