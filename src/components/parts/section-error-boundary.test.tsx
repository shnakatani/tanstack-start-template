import { QueryClientProvider, queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { CatchBoundary, notFound } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { createTestQueryClient } from "@/test/app/query-client";
import { expectAbsent, expectRemoved } from "@/test/assert/absent";
import { expectAnnouncements, readAnnouncements } from "@/test/assert/live-announcer";

import { SectionErrorBoundary, sectionErrorAnnouncement } from "./section-error-boundary";

const MESSAGE = "結果を取得できませんでした。";

function Reader({
  resetKey,
  fetchText,
}: {
  resetKey: string;
  fetchText: (key: string) => Promise<string>;
}) {
  const { data } = useSuspenseQuery(
    queryOptions({
      queryKey: ["section-error-boundary", resetKey],
      queryFn: () => fetchText(resetKey),
    }),
  );
  return <p>{data}</p>;
}

/** 区画の条件 (resetKey) をボタンで "b" へ変えられる器 */
function Harness({ fetchText }: { fetchText: (key: string) => Promise<string> }) {
  const [resetKey, setResetKey] = useState("a");
  return (
    <>
      <button type="button" onClick={() => setResetKey("b")}>
        条件を変える
      </button>
      <SectionErrorBoundary resetKey={resetKey} message={MESSAGE}>
        <Suspense fallback={<p>読み込み中</p>}>
          <Reader resetKey={resetKey} fetchText={fetchText} />
        </Suspense>
      </SectionErrorBoundary>
    </>
  );
}

function renderHarness(fetchText: (key: string) => Promise<string>) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <Harness fetchText={fetchText} />
    </QueryClientProvider>,
  );
}

describe("SectionErrorBoundary", () => {
  it("子の取得が失敗すると、区画の中に固定の文言と再試行を出し、失敗を読み上げる", async () => {
    const screen = await renderHarness(() => Promise.reject(new Error("取得の失敗")));

    await expect.element(screen.getByText(MESSAGE, { exact: true })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "再試行" })).toBeVisible();
    await expectAnnouncements([sectionErrorAnnouncement(MESSAGE)]);
    // 区画の外は残る
    await expect.element(screen.getByRole("button", { name: "条件を変える" })).toBeVisible();
  });

  it("再試行で子を描き直して取り直し、focus は区画の外枠に残る", async () => {
    const fetchText = vi
      .fn<(key: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error("取得の失敗"))
      .mockResolvedValueOnce("取り直した中身");
    const screen = await renderHarness(fetchText);
    await expect.element(screen.getByText(MESSAGE, { exact: true })).toBeVisible();

    await screen.getByRole("button", { name: "再試行" }).click();

    await expect.element(screen.getByText("取り直した中身", { exact: true })).toBeVisible();
    // ボタンが消えても focus は body へ落ちない
    await expect.element(screen.getBySlot("section-error-boundary")).toHaveFocus();
    expect(fetchText).toHaveBeenCalledTimes(2);
  });

  it("子が notFound() を投げたら受けずに外へ投げ直し、読み上げない", async () => {
    function ThrowsNotFound(): never {
      throw notFound();
    }
    const screen = await render(
      <CatchBoundary getResetKey={() => "outer"} errorComponent={() => <p>外の境界</p>}>
        <SectionErrorBoundary resetKey="a" message={MESSAGE}>
          <ThrowsNotFound />
        </SectionErrorBoundary>
      </CatchBoundary>,
    );

    await expect.element(screen.getByText("外の境界", { exact: true })).toBeVisible();
    await expectAbsent(screen.getByText(MESSAGE, { exact: true }));
    expect(readAnnouncements()).toEqual([]);
  });

  it("resetKey が変わると境界が戻り、新しい条件で描き直す", async () => {
    const screen = await renderHarness((key) =>
      key === "a" ? Promise.reject(new Error("取得の失敗")) : Promise.resolve("条件 b の中身"),
    );
    await expect.element(screen.getByText(MESSAGE, { exact: true })).toBeVisible();

    await screen.getByRole("button", { name: "条件を変える" }).click();

    await expect.element(screen.getByText("条件 b の中身", { exact: true })).toBeVisible();
    await expectRemoved(screen.getByText(MESSAGE, { exact: true }));
  });
});
