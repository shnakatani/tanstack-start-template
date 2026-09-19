import { cva, type VariantProps } from "class-variance-authority";

/**
 * ページ見出しの外見 (`styling.md` の typography 階層)。
 *
 * `PageHeader` の `<h1>` と `FullScreenCardTitle` の `CardTitle` が同じ寸法を持つ必要があるが、
 * 器 (header の中か Card の中か) が違うので部品は分かれる。外見だけをここが持ち、両方が消費する。
 * それぞれが class を書くと、片方だけ変えても何も落ちないまま 2 つのページ見出しがずれる。
 *
 * `cva` にするのは、tone を足したときの追記漏れを `VariantProps` が型で落とすため。手組みの
 * `Record` でも型は効くが、variant を読める仕組みがプロジェクトに 2 つできる (`@shadcn/lint` が
 * 読めるのは `cva` と `tv`)。
 */
export const pageTitle = cva("text-lg font-semibold", {
  variants: {
    /** 意味色の出し分け。破壊的な文脈にだけ destructive を使う */
    tone: {
      default: "",
      destructive: "text-destructive",
    },
  },
  defaultVariants: {
    tone: "default",
  },
});

export type PageTitleTone = NonNullable<VariantProps<typeof pageTitle>["tone"]>;
