import { posix } from "node:path";

import type { StorybookConfig } from "@storybook/tanstack-react";

/** `.storybook/main.ts` の `stories` 1 つが `../<起点>/**\/<ファイル名の glob>` の形のとき、その起点とファイル名の glob */
const STORIES_PATTERN = /^\.\.\/(.+?)\/\*\*\/([^/]+)$/;

/**
 * `dir` の外の story を除く `test.exclude`。`@storybook/addon-vitest` は `test.include` を無視して
 * `.storybook/main.ts` の `stories` から集めるので、起点の直下の story と、起点の下の `dir` 以外のディレクトリを除く
 * (`docs/guides/testing/configuration.md`「React Compiler を通さない project を足す」)。
 *
 * `stories` が `../<起点>/**\/<ファイル名の glob>` の 1 つだけの配列でないときと、`dir` が起点の直下に無いときは、
 * 除外が黙って外れたり全部を除いたりするので止める
 */
export function excludeStoriesOutside(stories: StorybookConfig["stories"], dir: string): string[] {
  // `stories` は配列を返す関数でも書けるが、そのときは起点を読めない
  const [entry, ...rest] = Array.isArray(stories) ? stories : [];
  const match = rest.length === 0 && typeof entry === "string" ? STORIES_PATTERN.exec(entry) : null;
  const [, root, fileGlob] = match ?? [];
  if (root === undefined || fileGlob === undefined) {
    const shown = typeof stories === "function" ? "関数" : JSON.stringify(stories);
    throw new Error(
      `.storybook/main.ts の stories が 1 つの起点を持つ glob ではない (${shown})。除外の組み方を変える`,
    );
  }
  if (posix.dirname(dir) !== root) {
    throw new Error(`${dir} が stories の起点 (${root}) の直下に無い。除外の組み方を変える`);
  }
  return [`${root}/${fileGlob}`, `${root}/!(${posix.basename(dir)})/**`];
}
