import type { Meta, StoryObj } from "@storybook/tanstack-react";

/**
 * 既定の story が描かない tint の組み合わせを実テキストとして描き、`parameters.a11y.test` の
 * axe に判定させる (ADR-0024 の節 5)。値を JS で計算しない。ブラウザは sRGB 外の `oklch()` を
 * clip し alpha を下地と合成するため、計算した比は描画と一致しない (ADR-0022 の節 6-1)。
 *
 * hover を実際に当てる形は採らない。`transition-colors` が効いている間は下地と混ざった途中の
 * 色が出ており、axe がそこを測ると最終的な配色には存在しない比が報告される。a11y helper が
 * 測定前にポインタを退避させるのはこのためで、hover を当てたまま測る経路は用意していない。
 * 代わりに hover で現れる utility を、prefix を外した形で静的に描く。
 *
 * light と dark は project が分かれており (`vitest.config.ts`)、同じ story が両方で走る。
 * 片方でしか現れない不透明度も両方で描かれるが、余分に通るだけで害はない。
 *
 * 1 つの面に複数の文字色が乗る組み合わせ (`bg-muted/50`) は、文字色ごとに 1 行を置く。
 * 面だけを描いても、その上に何が乗るかで通るか割るかが変わる。
 *
 * 一覧は手で保つ。対象を数え直すコマンド:
 *
 * ```
 * grep -rhoE '(bg|hover:bg|dark:bg|dark:hover:bg|aria-expanded:bg|focus:bg)-[a-z-]+/[0-9]+' \
 *   src/components/ui src/components/parts src/components/action --include='*.tsx' \
 *   | grep -v stories | sort | uniq -c
 * ```
 */
const meta = {
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;

/** `--background` の上。button / badge の tint がここに出る */
export const OnBackground: StoryObj = {
  render: () => (
    <div className="bg-background flex flex-col gap-2 p-4">
      <p className="bg-destructive-surface/10 text-destructive rounded px-3 py-2 text-sm">
        破壊の既定 bg-destructive-surface/10
      </p>
      <p className="bg-destructive-surface/20 text-destructive rounded px-3 py-2 text-sm">
        破壊の hover bg-destructive-surface/20
      </p>
      <p className="bg-destructive-surface/30 text-destructive rounded px-3 py-2 text-sm">
        破壊の hover (dark) bg-destructive-surface/30
      </p>
      <p className="bg-primary/80 text-primary-foreground rounded px-3 py-2 text-sm">
        主操作の hover bg-primary/80
      </p>
      <p className="bg-primary/5 text-primary rounded px-3 py-2 text-sm">
        破線ボタンの hover bg-primary/5
      </p>
      <p className="bg-primary/10 text-primary rounded px-3 py-2 text-sm">
        破線ボタンの hover (dark) bg-primary/10
      </p>
      <p className="bg-muted/50 text-muted-foreground rounded px-3 py-2 text-sm">
        淡色行の hover bg-muted/50 + text-muted-foreground
      </p>
      <p className="bg-muted/50 text-foreground rounded px-3 py-2 text-sm">
        淡色行の hover bg-muted/50 + text-foreground
      </p>
      <p className="bg-secondary/80 text-secondary-foreground rounded px-3 py-2 text-sm">
        副操作の hover bg-secondary/80
      </p>
      <p className="bg-input/30 text-foreground rounded px-3 py-2 text-sm">
        入力欄の面 (dark) bg-input/30
      </p>
      <p className="bg-input/50 text-foreground rounded px-3 py-2 text-sm">
        入力欄の hover (dark) bg-input/50
      </p>
    </div>
  ),
};

/** `--card` / `--popover` の上。dropdown-menu の破壊項目がここに出る */
export const OnCard: StoryObj = {
  render: () => (
    <div className="bg-card flex flex-col gap-2 rounded-lg p-4">
      <p className="bg-destructive-surface/10 text-destructive rounded px-3 py-2 text-sm">
        メニューの破壊項目 bg-destructive-surface/10
      </p>
      <p className="bg-destructive-surface/20 text-destructive rounded px-3 py-2 text-sm">
        メニューの破壊項目 bg-destructive-surface/20
      </p>
      <p className="bg-destructive-surface/30 text-destructive rounded px-3 py-2 text-sm">
        メニューの破壊項目 bg-destructive-surface/30
      </p>
    </div>
  ),
};
