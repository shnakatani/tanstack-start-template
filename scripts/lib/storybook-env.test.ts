import { describe, expect, test } from "vite-plus/test";

import { isStorybookRun } from "./storybook-env";

describe("isStorybookRun", () => {
  test("未設定と空文字は偽", () => {
    expect(isStorybookRun(undefined)).toBe(false);
    expect(isStorybookRun("")).toBe(false);
  });

  test('"false" と "0" だけが偽。大文字小文字は問わない', () => {
    expect(isStorybookRun("false")).toBe(false);
    expect(isStorybookRun("FALSE")).toBe(false);
    expect(isStorybookRun("0")).toBe(false);
  });

  test("それ以外の非空文字列は真", () => {
    expect(isStorybookRun("true")).toBe(true);
    expect(isStorybookRun("1")).toBe(true);
    expect(isStorybookRun("yes")).toBe(true);
  });
});
