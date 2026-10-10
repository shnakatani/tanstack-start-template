import axe from "axe-core";
import type { Locale } from "react-day-picker";
import { de } from "react-day-picker/locale/de";
import { enUS } from "react-day-picker/locale/en-US";
import { enZA } from "react-day-picker/locale/en-ZA";
import { ja } from "react-day-picker/locale/ja";
import { sq } from "react-day-picker/locale/sq";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { Calendar } from "@/components/ui/calendar";
import { describeA11yResults } from "@/test/a11y/a11y-message";

/**
 * calendar.tsx の registry 乖離 (ADR-0020、docs/registry-deviations.md の calendar.tsx の行) のガード。
 * shadcn add --overwrite で乖離が消えると、このテストが落ちる。
 * DOM のフォーカスと要素の同一性は story の play でも測れるが、乖離のガードは既存の
 * `input-group.test.tsx` と同じくブラウザテストに置き、キーボードは CDP の実イベントで押す。
 */

const SELECTED = new Date(2026, 7, 7);

function renderCalendar(locale?: Partial<Locale>) {
  return render(
    <Calendar mode="single" selected={SELECTED} defaultMonth={SELECTED} locale={locale} />,
  );
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
      .element(screen.getByRole("button", { name: "Friday, August 7", exact: false }))
      .toHaveFocus();

    await userEvent.keyboard("{ArrowRight}");

    await expect
      .element(screen.getByRole("button", { name: "Saturday, August 8", exact: false }))
      .toHaveFocus();
  });

  // WCAG 2.5.3。locale は書き換えの分岐ごとに 1 つ置く (locale なし、序数を外す en-US、2 桁の日の en-ZA、
  // 1 日だけ序数が数字に文字を足す sq、序数を残す de、書き換えない ja)。判定は axe の label-content-name-mismatch に
  // 任せ、どの日付のボタンもこの規則で測られて合格したことまで求める
  it.each([
    ["既定 (locale なし)", undefined],
    ["en-US", enUS],
    ["en-ZA", enZA],
    ["sq", sq],
    ["de", de],
    ["ja", ja],
  ])(
    "%s で、どの日付のボタンも見た目の日の数字を名前の 1 語として含む",
    { tags: ["a11y", "axe"] },
    async (_, locale) => {
      const screen = await renderCalendar(locale);
      const days = screen.getByRole("grid").getByRole("button");
      await expect.element(days.first()).toBeInTheDocument();
      const dayCount = days.elements().length;

      const result = await axe.run(screen.container, { runOnly: ["label-content-name-mismatch"] });
      expect(describeA11yResults(result.violations), "a11y 違反").toEqual([]);
      expect(describeA11yResults(result.incomplete), "axe が判定できなかった項目").toEqual([]);
      expect(result.passes.flatMap((rule) => rule.nodes)).toHaveLength(dayCount);
    },
  );

  // ドイツ語の序数 ("7.") は数字が 1 語として残るので書き換えない。書き換えると綴りが崩れる
  it("ドイツ語では、日付のボタンの名前の序数を残す", async () => {
    const screen = await renderCalendar(de);

    await expect
      .element(screen.getByRole("button", { name: "Freitag, 7. August 2026", exact: false }))
      .toBeInTheDocument();
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
