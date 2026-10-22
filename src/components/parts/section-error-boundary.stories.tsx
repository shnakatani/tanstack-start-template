import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { QueryClientProvider, queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { type ComponentProps, Suspense, useRef, useState } from "react";
import { expect, userEvent } from "storybook/test";

import { silenceConsoleError } from "@/components/action/catch-boundary.story-helpers";
import { LiveRegions } from "@/components/live-regions";
import { createTestQueryClient } from "@/test/app/query-client";

import { SectionErrorBoundary } from "./section-error-boundary";

const MESSAGE = "検索結果を取得できませんでした。";

/** 1 回目の取得だけ失敗する子。再試行で中身に戻る */
function FlakyReader({ fetchText }: { fetchText: () => Promise<string> }) {
  const { data } = useSuspenseQuery(
    queryOptions({ queryKey: ["section-error-boundary-story"], queryFn: fetchText }),
  );
  return <p>{data}</p>;
}

/**
 * 取得の回数を境界の外で持つ。子の中に持つと、1 回目の取得で suspend して commit されない子の state は
 * 捨てられ、再試行で描き直した子も 1 回目として数えて失敗してしまう
 */
function FlakyScene(props: ComponentProps<typeof SectionErrorBoundary>) {
  const attempts = useRef(0);
  function fetchText() {
    attempts.current += 1;
    return attempts.current === 1
      ? Promise.reject(new Error("story の失敗"))
      : Promise.resolve("取り直した中身");
  }
  return (
    <SectionErrorBoundary {...props}>
      <Suspense fallback={<p>読み込み中</p>}>
        <FlakyReader fetchText={fetchText} />
      </Suspense>
    </SectionErrorBoundary>
  );
}

const meta = {
  component: SectionErrorBoundary,
  args: { resetKey: "story", message: MESSAGE, children: null },
  decorators: [
    (Story) => {
      // story ごとに作り直す。retry を切った client で、1 回目の失敗をそのまま境界へ届ける
      const [client] = useState(() => createTestQueryClient());
      return (
        <QueryClientProvider client={client}>
          <Story />
          {/* announce の書き込み先 */}
          <LiveRegions />
        </QueryClientProvider>
      );
    },
  ],
  render: (args) => <FlakyScene {...args} />,
} satisfies Meta<typeof SectionErrorBoundary>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 区画の取得が失敗した状態。再試行で取り直して中身に戻る */
export const FailedThenRetried: Story = {
  // React が境界へ渡す前に出す console.error を黙らせる (src/components/action/form.stories.tsx と同じ渡し方)
  beforeEach: silenceConsoleError,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(MESSAGE)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "再試行" }));
    await expect(await canvas.findByText("取り直した中身")).toBeVisible();
  },
};
