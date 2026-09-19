import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useSyncExternalStore } from "react";

import { pageTitle } from "@/components/parts/page-title";

import { contrastRatio } from "./contrast.story-helpers";
import { isColor, toRgb } from "./css-color.story-helpers";
import { dropRedundantColorAliases } from "./theme-tokens.story-helpers";

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

function ColorTokens() {
  // <html> の class が変わるたびに key へ渡してテーブルを丸ごと作り直す。resolved()/toRgb() を
  // メモ化していないため再 render 自体でも値は更新されるが、key での強制再構築も併せて
  // 依存関係の見落としに備える (実測: 依存を持たない再 render でも表示は正しく更新された)
  const htmlClass = useHtmlClass();
  const background = resolved("--background");
  const backgroundRgb = toRgb(background);
  // 色として解決できるトークンだけを Colors へ通す。isColor() は振り分け用の静かな述語
  // (warn しない)。denylist (--radius/--font を除く) では成立しない。@layer を再帰して集める
  // ようになった結果、Tailwind 既定 theme の spacing / animation / container 等が同じ一覧へ
  // 入るため、除くべき接頭辞を数え上げ続けることになる (ADR-0022)
  const tokens = dropRedundantColorAliases(
    readRootTokens("--")
      .map((name) => ({ name, value: resolved(name) }))
      .filter(({ value }) => isColor(value)),
  );
  warnIfEmpty(
    tokens.map(({ name }) => name),
    "Tokens/Colors",
  );

  return (
    <table key={htmlClass} className="w-full text-sm">
      <thead>
        <tr>
          <th scope="col" className="p-2 text-left">
            token
          </th>
          <th scope="col" className="p-2 text-left">
            解決後の値
          </th>
          <th scope="col" className="p-2 text-left">
            背景とのコントラスト
          </th>
        </tr>
      </thead>
      <tbody>
        {tokens.map(({ name, value }) => {
          const rgb = toRgb(value);
          const ratio =
            rgb === null || backgroundRgb === null ? null : contrastRatio(rgb, backgroundRgb);
          return (
            <tr key={name}>
              <td className="p-2 font-mono text-xs">{name}</td>
              <td className="p-2 font-mono text-xs">
                {/* 見本と値を同じセルに置く。見本を別の td に分けると jsx-a11y/control-has-
                    associated-label が td (th と同様に対象) をラベル無しの control とみなして
                    落ちる。見本は装飾として aria-hidden にし、隣の可視テキストをそのセル自身の
                    アクセシブルな名前として使う */}
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block size-4 shrink-0 rounded border border-border"
                    style={{ background: value }}
                  />
                  {value}
                </span>
              </td>
              <td className="p-2 font-mono text-xs">{ratio === null ? "—" : ratio.toFixed(2)}</td>
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

export const Colors: StoryObj = { render: () => <ColorTokens /> };
export const Radius: StoryObj = { render: () => <RadiusTokens /> };
export const Typography: StoryObj = { render: () => <TypographyTokens /> };
