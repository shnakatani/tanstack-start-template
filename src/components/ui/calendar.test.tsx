import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { Calendar } from "@/components/ui/calendar";

/**
 * calendar.tsx の registry 乖離 (ADR-0020、docs/registry-deviations.md の calendar.tsx の行) のガード。
 * shadcn add --overwrite で乖離が消えると、このテストが落ちる。
 * DOM のフォーカスと要素の同一性は story の play でも測れるが、乖離のガードは既存の
 * `input-group.test.tsx` と同じくブラウザテストに置き、キーボードは CDP の実イベントで押す。
 */

const SELECTED = new Date(2026, 7, 7);

function renderCalendar() {
  return render(<Calendar mode="single" selected={SELECTED} defaultMonth={SELECTED} />);
}

describe("Calendar の registry 乖離 (ADR-0020)", () => {
  // CalendarDayButton は ref を作って focused の日へ focus() するが、上流は ref を Button へ
  // 渡していない。渡さないと react-day-picker の focused は動いても DOM のフォーカスが残る
  it("矢印キーで DOM のフォーカスが隣の日のボタンへ移る", async () => {
    const screen = await renderCalendar();

    // Tab の順は 前の月へ → 次の月へ → 月の表で唯一 tabbable な選択中の日
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await expect
      .element(screen.getByRole("button", { name: "Friday, August 7th, 2026, selected" }))
      .toHaveFocus();

    await userEvent.keyboard("{ArrowRight}");

    await expect
      .element(screen.getByRole("button", { name: "Saturday, August 8th, 2026" }))
      .toHaveFocus();
  });

  // 上流は components の Root などを Calendar の描画ごとにインラインの関数で作る。
  // 関数が変わると React は別の型として DOM を作り直し、フォーカス中のボタンも消える。
  // 利用者に見える症状であるフォーカスの喪失で測る。日のボタンは作り直されても
  // CalendarDayButton の effect がフォーカスを戻すので、戻す仕組みの無い月の移動ボタンで見る
  it("親が再描画しても、フォーカス中の月の移動ボタンからフォーカスが外れない", async () => {
    const screen = await renderCalendar();
    const previous = screen.getByRole("button", { name: "Go to the Previous Month" });
    await userEvent.tab();
    await expect.element(previous).toHaveFocus();

    await screen.rerender(<Calendar mode="single" selected={SELECTED} defaultMonth={SELECTED} />);

    await expect.element(previous).toHaveFocus();
  });
});
