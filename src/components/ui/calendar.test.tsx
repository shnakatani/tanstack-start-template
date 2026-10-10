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
      .element(screen.getByRole("button", { name: "Friday, August 7, 2026, selected" }))
      .toHaveFocus();

    await userEvent.keyboard("{ArrowRight}");

    await expect
      .element(screen.getByRole("button", { name: "Saturday, August 8, 2026" }))
      .toHaveFocus();
  });

  // 上流は locale を渡さないとき、日付のボタンの名前に序数を使う ("Sunday, August 30th, 2026")。
  // 見た目の "30" が名前の 1 語として入らず、WCAG 2.5.3 に当たる
  it("locale を渡さないとき、日付のボタンの名前に見た目の日の数字が 1 語として入る", async () => {
    const screen = await renderCalendar();

    await expect
      .element(screen.getByRole("button", { name: "Sunday, August 30, 2026" }))
      .toHaveTextContent("30");
  });

  // 上流は components の Root などを Calendar の描画中に定義する。
  // 関数が変わると React は別の型として DOM を作り直し、フォーカス中のボタンも消える。
  // 利用者に見える症状であるフォーカスの喪失で測る。日のボタンは作り直されても
  // CalendarDayButton の effect がフォーカスを戻すので、戻す仕組みの無い月の移動ボタンで見る。
  // Compiler は描画中の定義を関数の外出しとメモ化で隠すので、乖離が消えたことを検出するのは
  // browser-no-compiler の project である (docs/guides/testing/configuration.md「テストでも React Compiler を通す理由」)
  it("親が再描画しても、フォーカス中の月の移動ボタンからフォーカスが外れない", async () => {
    const screen = await renderCalendar();
    const previous = screen.getByRole("button", { name: "Go to the Previous Month" });
    await userEvent.tab();
    await expect.element(previous).toHaveFocus();

    await screen.rerender(<Calendar mode="single" selected={SELECTED} defaultMonth={SELECTED} />);

    await expect.element(previous).toHaveFocus();
  });
});
