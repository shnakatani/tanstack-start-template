import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { parse, wcagContrast } from "culori";
import { Fragment, useSyncExternalStore, type ReactNode } from "react";

import { pageTitle } from "@/components/parts/page-title";

import {
  dropRedundantColorAliases,
  foregroundPairs,
  type ThemeToken,
} from "./theme-tokens.story-helpers";

/**
 * `<html>` の class 属性 (light/dark) の変化を購読する。withThemeByClassName の
 * テーマ切り替えは document.documentElement の class を直接書き換えるだけで React の
 * state/props を経由しないため、購読しないと ColorTokens は初回 mount 時に解決した色の
 * まま止まる (実測: dark で読み込んでも --background が light の値のまま固定された)。
 * 外部ストアへの購読は useEffect 内 setState の代替 4 (implementation.md)
 */
function useHtmlClass(): string {
  return useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => observer.disconnect();
    },
    () => document.documentElement.className,
    () => "",
  );
}

/**
 * :root に定義された CSS 変数を名前順で集める。styles.css が SSOT なので値は写さない。
 * Tailwind v4 は `@theme` の内容を `@layer theme { :root, :host { ... } }` へ出すため、
 * トップレベルの CSSStyleRule だけでなく `@layer` / `@media` 等のグループ規則
 * (CSSGroupingRule を継承する rule 全般) の中も再帰的に辿る。辿らないと `@layer` の中の
 * `:root` を見落とす (ADR-0022)
 */
function readRootTokens(prefix: string): string[] {
  const names = new Set<string>();
  const visit = (rules: CSSRuleList) => {
    for (const rule of rules) {
      if (
        rule instanceof CSSStyleRule &&
        rule.selectorText.split(",").some((s) => s.trim() === ":root")
      ) {
        for (const name of rule.style) {
          if (name.startsWith(prefix)) names.add(name);
        }
      }
      if (rule instanceof CSSGroupingRule) visit(rule.cssRules);
    }
  };
  for (const sheet of document.styleSheets) {
    try {
      visit(sheet.cssRules);
    } catch {
      // 別オリジンの stylesheet は cssRules を読めない。Storybook の preview では起きないが、
      // 読めないものを黙って飛ばすと一覧が欠けるので残す
      console.warn("[tokens] cssRules を読めない stylesheet", { href: sheet.href });
    }
  }
  return [...names].sort();
}

function resolved(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** 対象トークンが 0 件で終わる回帰を検出する。空の表を silent に描かせない */
function warnIfEmpty(names: string[], story: string): void {
  if (names.length === 0) {
    console.warn("[tokens] トークンが 0 件", { story });
  }
}

/** CSS の色として解決できる値だけを通す。非色トークン (spacing / animation 等) を選り分ける */
function isColor(value: string): boolean {
  return parse(value) !== undefined;
}

/** 解決後の値を伴う色トークンを名前順で集める */
function readColorTokens(): ThemeToken[] {
  return dropRedundantColorAliases(
    readRootTokens("--")
      .map((name) => ({ name, value: resolved(name) }))
      .filter(({ value }) => isColor(value)),
  );
}

/**
 * `<html>` の class が変わるたびに children を作り直す。値は `getComputedStyle` から読むため
 * React の依存に現れず、再 render だけでは React Compiler がメモ化した結果を返して値が
 * 止まる。key での remount なら読み取りごとやり直される (2026-09-20、light と dark で
 * --muted-foreground の比が 4.35 と 5.57 に分かれることで確認)
 */
function RereadOnThemeChange({ children }: { children: ReactNode }) {
  const htmlClass = useHtmlClass();
  return <Fragment key={htmlClass}>{children}</Fragment>;
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

/** 本文テキストの下限 (WCAG 1.4.3、implementation.md「色とコントラスト」) */
const BODY_TEXT_MINIMUM = 4.5;

/**
 * 前景と背景の対のコントラストを出す。`styles.css` の値を変えた人がここで閾値を確かめる。
 * dark は light と別に検算する必要があるため (implementation.md)、テーマを切り替えて読む。
 *
 * axe は描画された実ペアしか見ないので、story を持たない部品で使う色は検査に出てこない。
 * この表は描画の有無と無関係に、定義されている対を全件並べる。
 */
function ContrastTable() {
  const pairs = foregroundPairs(readColorTokens());
  warnIfEmpty(
    pairs.map(({ foreground }) => foreground.name),
    "Tokens/Contrast",
  );

  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th scope="col" className="p-2 text-left">
            前景
          </th>
          <th scope="col" className="p-2 text-left">
            背景
          </th>
          <th scope="col" className="p-2 text-left">
            比
          </th>
          <th scope="col" className="p-2 text-left">
            4.5:1
          </th>
        </tr>
      </thead>
      <tbody>
        {pairs.map(({ foreground, background }) => {
          // 解析できない値を渡すと wcagContrast は TypeError を投げる (2026-09-20 実測。
          // 型は number を返すと宣言しているが実行時は throw する)。ここへ来る値は
          // useColorTokens() が isColor() で絞っているので必ず解析できる
          const ratio = wcagContrast(foreground.value, background.value);
          const passes = ratio >= BODY_TEXT_MINIMUM;
          return (
            <tr key={foreground.name}>
              <td className="p-2 font-mono text-xs">{foreground.name}</td>
              <td className="p-2 font-mono text-xs">{background.name}</td>
              <td className="p-2 font-mono text-xs">{ratio.toFixed(2)}</td>
              {/* 色だけで伝えない (styling.md)。文字で判定を書く */}
              <td className="p-2 font-mono text-xs">{passes ? "満たす" : "割る"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RadiusTokens() {
  const names = readRootTokens("--radius");
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
          <span className="font-mono text-xs text-muted-foreground">{resolved(name)}</span>
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
  const names = readRootTokens("--font");
  warnIfEmpty(names, "Tokens/Typography");
  return (
    <div className="flex flex-col gap-4">
      {names.map((name) => (
        <p key={name} className="font-mono text-xs text-muted-foreground">
          {name}: {resolved(name)}
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

export const Colors: StoryObj = {
  render: () => (
    <RereadOnThemeChange>
      <ColorSwatches />
    </RereadOnThemeChange>
  ),
};
export const Contrast: StoryObj = {
  render: () => (
    <RereadOnThemeChange>
      <ContrastTable />
    </RereadOnThemeChange>
  ),
};
export const Radius: StoryObj = { render: () => <RadiusTokens /> };
export const Typography: StoryObj = { render: () => <TypographyTokens /> };
