import type { Preview } from "@storybook/tanstack-react";

import { checkA11yIncomplete } from "../../src/test/a11y-story";

/**
 * `incomplete` を合否へ入れる。`addon-a11y` は `violations` の件数だけで合否を決めるので
 * (同 addon の `hasViolations`)、これが無いと `color-contrast` が背景を決められなくなったときに
 * 検査が緑のまま何も見なくなる (ADR-0056)。
 *
 * 見るのは addon が `reporting` へ積んだ結果そのもので、axe は回し直さない。理由と、何を落として
 * 何を外すかは `src/test/a11y-story.ts` の `checkA11yIncomplete` が持つ。
 */
export const afterEach = ((context) => {
  const message = checkA11yIncomplete(context);
  if (message !== null) throw new Error(message);
}) satisfies NonNullable<Preview["afterEach"]>;
