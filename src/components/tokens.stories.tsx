import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { pageTitle } from "@/components/parts/page-title";

import { isColor } from "./css-color.story-helpers";
import { collectRootCustomProperties } from "./css-rules.story-helpers";
import { dropRedundantColorAliases, type ThemeToken } from "./theme-tokens.story-helpers";

/** 名前順のトークン名。`styles.css` が SSOT なので値は写さない (ADR-0022) */
function readTokenNames(prefix: string): string[] {
  return collectRootCustomProperties(document.styleSheets, prefix, document.documentElement);
}

/**
 * 解決後の値を読む。`getComputedStyle` は呼ぶたびに root のスタイル解決を起こすので、
 * 一覧を組み立てる間は 1 つを使い回す
 */
function rootStyle(): CSSStyleDeclaration {
  return getComputedStyle(document.documentElement);
}

function resolvedWith(style: CSSStyleDeclaration, name: string): string {
  return style.getPropertyValue(name).trim();
}

/** 対象トークンが 0 件で終わる回帰を検出する。空の表を silent に描かせない */
function warnIfEmpty(names: string[], story: string): void {
  if (names.length === 0) {
    console.warn("[tokens] トークンが 0 件", { story });
  }
}

/** 解決後の値を伴う色トークンを名前順で集める */
function readColorTokens(): ThemeToken[] {
  const style = rootStyle();
  return dropRedundantColorAliases(
    readTokenNames("--")
      .map((name) => ({ name, value: resolvedWith(style, name) }))
      .filter(({ value }) => isColor(value)),
  );
}

function ColorSwatches() {
  const tokens = readColorTokens();
  warnIfEmpty(
    tokens.map(({ name }) => name),
    "Tokens/Colors",
  );

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
  const style = rootStyle();
  const names = readTokenNames("--radius");
  warnIfEmpty(names, "Tokens/Radius");
  return (
    <div className="flex flex-wrap gap-4">
      {names.map((name) => (
        <div key={name} className="flex flex-col items-center gap-2">
          <div
            aria-hidden
            className="size-16 bg-primary"
            style={{ borderRadius: `var(${name})` }}
          />
          <span className="font-mono text-xs">{name}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {resolvedWith(style, name)}
          </span>
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
  const style = rootStyle();
  const names = readTokenNames("--font");
  warnIfEmpty(names, "Tokens/Typography");
  return (
    <div className="flex flex-col gap-4">
      {names.map((name) => (
        <p key={name} className="font-mono text-xs text-muted-foreground">
          {name}: {resolvedWith(style, name)}
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

const meta = {
  title: "Tokens",
} satisfies Meta;

export default meta;

export const Colors: StoryObj = { render: () => <ColorSwatches /> };
export const Radius: StoryObj = { render: () => <RadiusTokens /> };
export const Typography: StoryObj = { render: () => <TypographyTokens /> };
