import { bg } from "react-day-picker/locale/bg";
import { de } from "react-day-picker/locale/de";
import { enCA } from "react-day-picker/locale/en-CA";
import { enUS } from "react-day-picker/locale/en-US";
import { enZA } from "react-day-picker/locale/en-ZA";
import { gd } from "react-day-picker/locale/gd";
import { hi } from "react-day-picker/locale/hi";
import { ja } from "react-day-picker/locale/ja";
import { sq } from "react-day-picker/locale/sq";
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
      .element(screen.getByRole("button", { name: "Friday, August 7", exact: false }))
      .toHaveFocus();

    await userEvent.keyboard("{ArrowRight}");

    await expect
      .element(screen.getByRole("button", { name: "Saturday, August 8", exact: false }))
      .toHaveFocus();
  });

  // 上流は locale の完全な日付の書式で名前を作り、序数 ("30th"、"30mh") や 2 桁の日 ("07") で見た目の数字が
  // 名前の 1 語として入らない locale がある (WCAG 2.5.3)。語の分け方は axe-core 4.14.0 の
  // label-content-name-mismatch と同じく Intl.Segmenter で、日本語の名前も語に分けて比べる
  it.each([
    ["既定 (locale なし)", undefined],
    ["en-US", enUS],
    ["en-CA", enCA],
    ["en-ZA", enZA],
    ["bg", bg],
    ["gd", gd],
    ["sq", sq],
    ["hi", hi],
    ["de", de],
    ["ja", ja],
  ])("%s で、どの日付のボタンも見た目の日の数字を名前の 1 語として含む", async (_, locale) => {
    const screen = await render(
      <Calendar mode="single" selected={SELECTED} defaultMonth={SELECTED} locale={locale} />,
    );
    const days = screen.getByRole("grid").getByRole("button");
    await expect.element(days.first()).toBeInTheDocument();

    const segmenter = new Intl.Segmenter(locale?.code ?? "en-US", { granularity: "word" });
    for (const day of days.elements()) {
      const words = [...segmenter.segment(day.getAttribute("aria-label") ?? "")]
        .filter((segment) => segment.isWordLike)
        .map((segment) => segment.segment);
      expect(words, day.getAttribute("aria-label") ?? "").toContain(day.textContent);
    }
  });

  // ドイツ語の序数 ("7.") は数字が 1 語として残るので書き換えない。書き換えると綴りが崩れる
  it("ドイツ語では、日付のボタンの名前の序数を残す", async () => {
    const screen = await render(
      <Calendar mode="single" selected={SELECTED} defaultMonth={SELECTED} locale={de} />,
    );

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
