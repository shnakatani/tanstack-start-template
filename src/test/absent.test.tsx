import { useEffect, useState } from "react";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { expectAbsent } from "./absent";

function AppearsLater({ delayMs }: { delayMs: number }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);
  return <div>{shown ? <span>あとから出る</span> : null}</div>;
}

describe("expectAbsent", () => {
  it("要素が無ければ通る", async () => {
    const screen = await render(<div>ある</div>);

    await expectAbsent(screen.getByText("ない"));
  });

  it("要素が在れば落ちる。所要はテストの残り予算に依らない", async () => {
    const screen = await render(<div>ある</div>);

    // `expect.element` の既定 timeout はテストの残り予算なので、`{ timeout: 0 }` を
    // 外すと同じ assert が 4 秒以上かけて落ちる。その退行をこの閾値が捕まえる (ADR-0029)
    const startedAt = performance.now();
    await expect(expectAbsent(screen.getByText("ある"))).rejects.toThrow(/toBeInTheDocument/);
    expect(performance.now() - startedAt).toBeLessThan(1_000);
  }, 5_000);

  it("後から現れる要素でも、呼んだ時点で無ければ通る", async () => {
    const screen = await render(<AppearsLater delayMs={300} />);
    const target = screen.getByText("あとから出る");

    await expectAbsent(target);

    // 待たないことの裏返し。同じ locator が後から解決する
    await expect.element(target).toBeInTheDocument();
  });
});
