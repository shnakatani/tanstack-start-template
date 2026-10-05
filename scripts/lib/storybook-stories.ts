import { posix } from "node:path";

/** `.storybook/main.ts` の `stories` 1 つが `../<起点>/**\/<ファイル名の glob>` の形のとき、その起点 */
const STORIES_ROOT_PATTERN = /^\.\.\/(.+?)\/\*\*\/[^/]+$/;

/**
 * `dir` の外の story を除く `test.exclude`。`@storybook/addon-vitest` は `test.include` を無視して
 * `.storybook/main.ts` の `stories` から集めるので、起点の直下の story と、起点の下の `dir` 以外のディレクトリを除く
 * (`docs/guides/testing/configuration.md`「React Compiler を通さない project を足す」)。
 *
 * `stories` が 1 つの起点を持つ glob の配列でないときと、`dir` が起点の直下に無いときは、除外が黙って外れたり
 * 全部を除いたりするので止める
 */
export function excludeStoriesOutside(stories: unknown, dir: string): string[] {
  // `stories` は配列を返す関数でも書けるが、そのときは起点を読めない
  const [entry, ...rest] = Array.isArray(stories) ? Array.from<unknown>(stories) : [];
  const root =
    rest.length === 0 && typeof entry === "string"
      ? STORIES_ROOT_PATTERN.exec(entry)?.[1]
      : undefined;
  if (root === undefined) {
    throw new Error(
      `.storybook/main.ts の stories が 1 つの起点を持つ glob ではない (${JSON.stringify(stories)})。除外の組み方を変える`,
    );
  }
  if (posix.dirname(dir) !== root) {
    throw new Error(`${dir} が stories の起点 (${root}) の直下に無い。除外の組み方を変える`);
  }
  return [`${root}/*.stories.*`, `${root}/!(${posix.basename(dir)})/**`];
}
