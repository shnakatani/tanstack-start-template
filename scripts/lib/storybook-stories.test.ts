import { describe, expect, test } from "vite-plus/test";

import { excludeStoriesOutside } from "./storybook-stories";

const STORIES = ["../src/components/**/*.stories.@(ts|tsx)"];
const NOT_ONE_ROOT = "1 つの起点を持つ glob ではない";

describe("excludeStoriesOutside", () => {
  test("stories の起点の直下の story と、起点の下の dir 以外を除く", () => {
    expect(excludeStoriesOutside(STORIES, "src/components/ui")).toEqual([
      "src/components/*.stories.*",
      "src/components/!(ui)/**",
    ]);
  });

  test("dir が stories の起点の直下に無ければ止まる", () => {
    expect(() => excludeStoriesOutside(STORIES, "src/components/ui/forms")).toThrow(
      "src/components/ui/forms が stories の起点 (src/components) の直下に無い",
    );
    expect(() => excludeStoriesOutside(STORIES, "src/features/ui")).toThrow(
      "src/features/ui が stories の起点 (src/components) の直下に無い",
    );
  });

  test("stories が 1 つの起点を持つ glob の配列でなければ止まる", () => {
    expect(() =>
      excludeStoriesOutside([...STORIES, "../src/routes/**/*.stories.tsx"], "src/components/ui"),
    ).toThrow(NOT_ONE_ROOT);
    expect(() =>
      excludeStoriesOutside(["../src/components/*.stories.tsx"], "src/components/ui"),
    ).toThrow(NOT_ONE_ROOT);
    expect(() =>
      excludeStoriesOutside([{ directory: "../src/components" }], "src/components/ui"),
    ).toThrow(NOT_ONE_ROOT);
    expect(() =>
      excludeStoriesOutside(() => Promise.resolve(STORIES), "src/components/ui"),
    ).toThrow(NOT_ONE_ROOT);
  });
});
