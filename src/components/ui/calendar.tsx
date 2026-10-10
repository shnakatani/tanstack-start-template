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

type FormatLong = NonNullable<Locale["formatLong"]>;

/**
 * 完全な日付の書式の日を、序数 (`do`) から数字 (`d`) にする。en-US と en-CA の書式は日を "30th" と書き、
 * 日付のボタンの名前 ("Sunday, August 30th, 2026") に見た目の "30" が 1 語として入らない
 * (WCAG 2.5.3。ACT 規則 2ee8b8 は単語ごとに比べ、axe-core 4.14.0 の label-content-name-mismatch が違反にする)。
 * 名前は react-day-picker が完全な日付の書式から作るので、書式だけを差し替えれば "Today, " などの文言は残る
 */
function withoutOrdinalDay(formatLong: FormatLong): FormatLong {
  return {
    ...formatLong,
    date: (options) => {
      const pattern = formatLong.date(options);
      return options.width === "full" ? pattern.replace(/\bdo\b/, "d") : pattern;
    },
  };
}

/**
 * DayPicker は渡した locale を既定 (en-US) に重ねるので、実際に効く locale が英語なら序数を外す。
 * 英語の locale に限るのは、序数を数字にすると綴りが崩れる言語があるため (ドイツ語の "30." は点が落ちる。
 * "30" は 1 語として残るので直す必要もない)。日を 2 桁で書く書式 (en-ZA の "07") と、英語以外で語にくっつく
 * 序数 (スコットランド・ゲール語の "2na" など) は直していない。
 * 方針は react-day-picker docs「Advanced Translations」の Tweak locale data (locale を最小限に拡張する) に沿い、
 * 形は DayPicker が既定に重ねる部分の locale (`Partial<Locale>`) にする。locale を渡さないときは `code` を
 * 持たせないので、日付のボタンの `data-day` はブラウザの言語で書かれたまま変わらない
 */
function withoutEnglishOrdinalDay(locale: Partial<Locale> = {}): Partial<Locale> {
  if (!(locale.code ?? defaultLocale.code).startsWith("en")) return locale;
  return {
    ...locale,
    formatLong: withoutOrdinalDay(locale.formatLong ?? defaultLocale.formatLong),
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
      locale={withoutEnglishOrdinalDay(locale)}
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
