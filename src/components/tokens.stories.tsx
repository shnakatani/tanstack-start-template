import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useSyncExternalStore } from "react";
import { expect, within } from "storybook/test";

import { pageTitle } from "@/components/parts/page-title";

import { collectRootCustomProperties } from "./css-rules.story-helpers";
import { createThemeSnapshotStore } from "./theme-snapshot.story-helpers";
import { dropRedundantColorAliases, type ThemeToken } from "./theme-tokens.story-helpers";

/**
 * 解決後の値を伴う全トークンを名前順で集める。`styles.css` が SSOT なので値は写さない
 * (ADR-0022)。`getComputedStyle` は呼ぶたびに root のスタイル解決を起こすので 1 つを使い回す
 */
function readAllTokens(): ThemeToken[] {
  const style = getComputedStyle(document.documentElement);
  const names = collectRootCustomProperties(document.styleSheets, "--", document.documentElement);
  return names.map((name) => ({ name, value: style.getPropertyValue(name).trim() }));
}

interface TokenLists {
  colors: ThemeToken[];
  radius: ThemeToken[];
  fonts: ThemeToken[];
}

function byPrefix(tokens: ThemeToken[], prefix: string): ThemeToken[] {
  return tokens.filter(({ name }) => name.startsWith(prefix));
}

/**
 * テーマごとに 1 回だけ読む。値は CSSOM と getComputedStyle から取るので React の依存に
 * 現れず、購読しないと切り替えても止まる (ADR-0022)。
 *
 * 種別ごとの絞り込みもここで済ませる。render 側で絞ると、CSSOM の走査こそ 1 回でも、
 * `dropRedundantColorAliases` の warn が再 render のたびに出る。走査と警告はテーマが
 * 変わったときだけ起こしたい。
 *
 * 色かどうかはブラウザ自身のパーサに聞く。`CSS.supports` は property と value の組で
 * 解析できるかを返すので、`oklch()` も `color-mix()` も relative color syntax も通る
 */
const tokenStore = createThemeSnapshotStore<TokenLists>(
  () => {
    const all = readAllTokens();
    if (all.length === 0) {
      console.warn("[tokens] root のカスタムプロパティが 1 件も取れない");
    }
    return {
      colors: dropRedundantColorAliases(all.filter(({ value }) => CSS.supports("color", value))),
      radius: byPrefix(all, "--radius"),
      fonts: byPrefix(all, "--font"),
    };
  },
  { colors: [], radius: [], fonts: [] },
);

function useTokenLists(): TokenLists {
  return useSyncExternalStore(
    tokenStore.subscribe,
    tokenStore.getSnapshot,
    tokenStore.getServerSnapshot,
  );
}

function ColorSwatches() {
  const { colors: tokens } = useTokenLists();

  return (
    <ul className="grid grid-cols-2 gap-2 text-sm">
      {tokens.map(({ name, value }) => (
        <li key={name} className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block size-6 shrink-0 rounded border border-border"
            style={{ background: value }}
          />
          <span className="font-mono text-xs">{name}</span>
          <span className="font-mono text-xs text-muted-foreground">{value}</span>
        </li>
      ))}
    </ul>
  );
}

function RadiusTokens() {
  const { radius: tokens } = useTokenLists();
  return (
    <div className="flex flex-wrap gap-4">
      {tokens.map(({ name, value }) => (
        <div key={name} className="flex flex-col items-center gap-2">
          <div
            aria-hidden
            className="size-16 bg-primary"
            style={{ borderRadius: `var(${name})` }}
          />
          <span className="font-mono text-xs">{name}</span>
          <span className="font-mono text-xs text-muted-foreground">{value}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * styling.md の typography 階層。見出しの寸法は pageTitle が持つのでそこから呼ぶ。
 * セクション見出し (text-base font-semibold) は専有の部品が無いため literal のままで、
 * styling.md の表と二重管理になる。表を変えたらここも合わせる
 */
const TYPOGRAPHY_SAMPLES = [
  { label: "ページ見出し", className: pageTitle() },
  { label: "セクション見出し", className: "text-base font-semibold" },
  { label: "本文", className: "text-base" },
  { label: "補足", className: "text-xs" },
] as const;

function TypographyTokens() {
  const { fonts: tokens } = useTokenLists();
  return (
    <div className="flex flex-col gap-4">
      {tokens.map(({ name, value }) => (
        <p key={name} className="font-mono text-xs text-muted-foreground">
          {name}: {value}
        </p>
      ))}
      {TYPOGRAPHY_SAMPLES.map((sample) => (
        <div key={sample.label} className="flex items-baseline gap-4">
          <span className="w-40 font-mono text-xs text-muted-foreground">{sample.label}</span>
          <span className={sample.className}>あのイーハトーヴォのすきとおった風</span>
        </div>
      ))}
    </div>
  );
}

const meta = {} satisfies Meta;

export default meta;

/**
 * 一覧が空でないことを見る。中身は `styles.css` と CSSOM の走査で決まるので、story を
 * 描くだけでは 0 件でも通ってしまう。`warnIfEmpty` の warn はテストを落とさない
 * (2026-09-20 に走査を潰す mutant で実測)。トークン名は `--` で始まる文字列として出る。
 */
async function expectTokensRendered({
  canvasElement,
}: {
  canvasElement: HTMLElement;
}): Promise<void> {
  await expect(within(canvasElement).getAllByText(/^--/).length).toBeGreaterThan(0);
}

export const Colors: StoryObj = { render: () => <ColorSwatches />, play: expectTokensRendered };
export const Radius: StoryObj = { render: () => <RadiusTokens />, play: expectTokensRendered };
export const Typography: StoryObj = {
  render: () => <TypographyTokens />,
  play: expectTokensRendered,
};
