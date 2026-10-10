import { cn } from "cn";
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from "lucide-react";
import * as React from "react";
import {
  DayPicker,
  defaultLocale,
  getDefaultClassNames,
  useDayPicker,
  type CustomComponents,
  type DayButton,
  type Locale,
} from "react-day-picker";

import { Button, buttonVariants } from "@/components/ui/button";

const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, index) => index + 1);

/** 文字と数字以外を区切りとして語に分ける。axe-core 4.14.0 の label-content-name-mismatch が語に分ける前に当てる置換と同じ */
function words(text: string): string[] {
  return text
    .replace(/[^\p{L}\p{N}]/gu, " ")
    .split(" ")
    .filter(Boolean);
}

/**
 * 完全な日付の書式の日を、見た目の数字 (`d`) が名前の 1 語として入る形にする。
 * - 序数 (`do`) が数字に文字を足す locale (英語の "30th"、ゲール語の "30mh"、ヒンディー語の "३०") では `d` にする。
 *   句読点だけを足す序数 (ドイツ語の "30."、ウクライナ語の "30-е") は数字が 1 語として残り、外すと綴りが崩れるので残す
 * - 日を 2 桁で書く `dd` (en-ZA の "07") は `d` にする
 * 判定は locale 単位なので、1 日だけが落ちる locale (アルバニア語の "4t") でも全部の日の序数を外す。書き換えた形は、
 * en-ZA ("04") とゲール語 ("4mh") を除き、CLDR の完全な日付と同じく序数も 2 桁の日も使わない。
 * 引用符の中の固定の文字は書き換えない。日の数字に文法上の接尾辞がくっつく locale (韓国語の `d일`、バスク語の `d'a'`) は、
 * その言語として正しい形のまま数字を独立した語にできないので直らない
 */
function rewriteDayAsWord(pattern: string, ordinalKeepsDayAsWord: boolean): string {
  return pattern
    .split(/('(?:[^']|'')*')/)
    .map((part, index) => {
      if (index % 2 === 1) return part;
      const ordinalRewritten = ordinalKeepsDayAsWord ? part : part.replace(/\bdo\b/g, "d");
      return ordinalRewritten.replace(/(?<!d)dd(?!d)/g, "d");
    })
    .join("");
}

/**
 * 日付のボタンの名前 (と非対話の gridcell の名前) に、見た目の日の数字が 1 語として入るようにする。
 * react-day-picker は名前を locale の完全な日付の書式 (`PPPP`) から作り、見た目の数字は `d` で作る。
 * en-US の "Sunday, August 30th, 2026" は見た目の "30" を 1 語として含まず、WCAG 2.5.3 に当たる
 * (ACT 規則 2ee8b8 は単語ごとに比べ、axe-core 4.14.0 の label-content-name-mismatch が違反にする)。
 * 書式だけを差し替えるので、語順、助詞、"Today, " などの文言は locale のまま残る。日付は date-fns で整形する
 * (暦の日付の整形は docs/guides/dates-and-time-zones.md「画面に暦の日付を出す」)。
 * 方針は react-day-picker docs「Advanced Translations」の Tweak locale data (locale を最小限に拡張する) に沿い、
 * 形は DayPicker が既定 (en-US) に重ねる部分の locale (`Partial<Locale>`) にする。locale を渡さないときは `code` を
 * 持たせないので、日付のボタンの `data-day` はブラウザの言語で書かれたまま変わらない
 */
function withDayAsWord(locale: Partial<Locale> = {}): Partial<Locale> {
  const formatLong = locale.formatLong ?? defaultLocale.formatLong;
  const localize = locale.localize ?? defaultLocale.localize;
  const fullPattern = formatLong.date({ width: "full" });
  const ordinalKeepsDayAsWord = DAYS_OF_MONTH.every((day) =>
    words(localize.ordinalNumber(day, { unit: "date" })).includes(String(day)),
  );
  const rewritten = rewriteDayAsWord(fullPattern, ordinalKeepsDayAsWord);
  if (rewritten === fullPattern) return locale;
  return {
    ...locale,
    formatLong: {
      ...formatLong,
      date: (options) => (options.width === "full" ? rewritten : formatLong.date(options)),
    },
  };
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  locale,
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "group/calendar bg-background p-3 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(8)] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className,
      )}
      captionLayout={captionLayout}
      locale={withDayAsWord(locale)}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString(locale?.code, { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("relative flex flex-col gap-4 md:flex-row", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          "flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn("relative rounded-(--cell-radius)", defaultClassNames.dropdown_root),
        dropdown: cn("absolute inset-0 bg-popover opacity-0", defaultClassNames.dropdown),
        caption_label: cn(
          "font-medium select-none",
          captionLayout === "label"
            ? "text-sm"
            : "flex items-center gap-1 rounded-(--cell-radius) text-sm [&>svg]:size-3.5 [&>svg]:text-muted-foreground",
          defaultClassNames.caption_label,
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "flex-1 rounded-(--cell-radius) text-[0.8rem] font-normal text-muted-foreground select-none",
          defaultClassNames.weekday,
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        week_number_header: cn("w-(--cell-size) select-none", defaultClassNames.week_number_header),
        week_number: cn(
          "text-[0.8rem] text-muted-foreground select-none",
          defaultClassNames.week_number,
        ),
        day: cn(
          "group/day relative aspect-square h-full w-full rounded-(--cell-radius) p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-r-(--cell-radius)",
          props.showWeekNumber
            ? "[&:nth-child(2)[data-selected=true]_button]:rounded-l-(--cell-radius)"
            : "[&:first-child[data-selected=true]_button]:rounded-l-(--cell-radius)",
          defaultClassNames.day,
        ),
        range_start: cn(
          "relative isolate z-0 rounded-l-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:right-0 after:w-4 after:bg-muted",
          defaultClassNames.range_start,
        ),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn(
          "relative isolate z-0 rounded-r-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:left-0 after:w-4 after:bg-muted",
          defaultClassNames.range_end,
        ),
        today: cn(
          "rounded-(--cell-radius) bg-muted text-foreground data-[selected=true]:rounded-none",
          defaultClassNames.today,
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside,
        ),
        disabled: cn("text-muted-foreground opacity-50", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: CalendarRoot,
        Chevron: CalendarChevron,
        DayButton: CalendarDayButtonWithLocale,
        WeekNumber: CalendarWeekNumber,
        ...components,
      }}
      {...props}
    />
  );
}

// components の部品は Calendar の外で定義する。描画ごとに作ると React が別の型とみなし、
// 親の再描画のたびに DayPicker の DOM を作り直してフォーカスを失う (docs/registry-deviations.md)
function CalendarRoot({
  className,
  rootRef,
  ...props
}: React.ComponentProps<CustomComponents["Root"]>) {
  return <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />;
}

function CalendarChevron({
  className,
  orientation,
  ...props
}: React.ComponentProps<CustomComponents["Chevron"]>) {
  if (orientation === "left") {
    return <ChevronLeftIcon className={cn("size-4", className)} {...props} />;
  }

  if (orientation === "right") {
    return <ChevronRightIcon className={cn("size-4", className)} {...props} />;
  }

  return <ChevronDownIcon className={cn("size-4", className)} {...props} />;
}

function CalendarDayButtonWithLocale(props: React.ComponentProps<typeof DayButton>) {
  const { dayPickerProps } = useDayPicker();
  return <CalendarDayButton locale={dayPickerProps.locale} {...props} />;
}

function CalendarWeekNumber({
  children,
  ...props
}: React.ComponentProps<CustomComponents["WeekNumber"]>) {
  return (
    <td {...props}>
      <div className="flex size-(--cell-size) items-center justify-center text-center">
        {children}
      </div>
    </td>
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  locale,
  ...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }) {
  const defaultClassNames = getDefaultClassNames();

  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString(locale?.code)}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 border-0 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50 data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-r-(--cell-radius) data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-muted data-[range-middle=true]:text-foreground data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:rounded-l-(--cell-radius) data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground dark:hover:text-foreground [&>span]:text-xs [&>span]:opacity-70",
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
