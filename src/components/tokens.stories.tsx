import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useSyncExternalStore } from "react";

import { contrastRatio } from "@/lib/contrast";

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

/** :root に定義された CSS 変数を名前順で集める。styles.css が SSOT なので値は写さない */
function readRootTokens(prefix: string): string[] {
  const names = new Set<string>();
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      // 別オリジンの stylesheet は cssRules を読めない。Storybook の preview では起きないが、
      // 読めないものを黙って飛ばすと一覧が欠けるので残す
      console.warn("[tokens] cssRules を読めない stylesheet", { href: sheet.href });
      continue;
    }
    for (const rule of rules) {
      if (!(rule instanceof CSSStyleRule)) continue;
      if (!rule.selectorText.split(",").some((s) => s.trim() === ":root")) continue;
      for (const name of rule.style) {
        if (name.startsWith(prefix)) names.add(name);
      }
    }
  }
  return [...names].sort();
}

function resolved(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * 任意の CSS 色文字列を `rgb(r, g, b)` へ正規化する。styles.css の色は oklch() で
 * 書かれており、contrastRatio (src/lib/contrast.ts) は rgb() しか解析できないため必要になる
 * (getComputedStyle でカスタムプロパティを読んでも colorspace は変換されず oklch() の
 * ままなことを実測で確認した)。Canvas 2D の fillStyle は無効な色を代入すると値を無視して
 * 直前の値を保つ (仕様どおりの挙動) ため、判定用の sentinel を挟んで検出する
 */
function toRgb(cssColor: string): string | null {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.warn("[tokens] canvas 2d context を取得できない");
    return null;
  }
  const sentinel = "#010203";
  ctx.fillStyle = sentinel;
  ctx.fillStyle = cssColor;
  if (ctx.fillStyle === sentinel) {
    console.warn("[tokens] 色として解析できない値", { cssColor });
    return null;
  }
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

function ColorTokens() {
  // 変わるたびに key へ渡してテーブルを丸ごと作り直す。resolved()/toRgb() をメモ化
  // していないため再 render 自体でも値は更新されるが、key での強制再構築も併せて
  // 依存関係の見落としに備える (実測: 依存を持たない再 render でも表示は正しく更新された)
  const htmlClass = useHtmlClass();
  const background = resolved("--background");
  const backgroundRgb = toRgb(background);
  const names = readRootTokens("--").filter(
    (name) => !name.startsWith("--radius") && !name.startsWith("--font"),
  );

  return (
    <table key={htmlClass} className="w-full text-sm">
      <thead>
        <tr>
          <th scope="col" className="p-2 text-left">
            token
          </th>
          <th scope="col" className="p-2 text-left">
            見本
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
        {names.map((name) => {
          const value = resolved(name);
          const rgb = toRgb(value);
          const ratio =
            rgb === null || backgroundRgb === null ? null : contrastRatio(rgb, backgroundRgb);
          return (
            <tr key={name}>
              <td className="p-2 font-mono text-xs">{name}</td>
              <td className="p-2">
                {/* jsx-a11y/control-has-associated-label は td も対象にする (th と同様)。
                    見本は装飾で「解決後の値」列と同じ値を表すため、その値をそのまま
                    アクセシブルな名前にする */}
                <span
                  aria-hidden
                  className="block size-6 rounded border border-border"
                  style={{ background: value }}
                />
                <span className="sr-only">{value}</span>
              </td>
              <td className="p-2 font-mono text-xs">{value}</td>
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

/** styling.md の typography 階層。見出しの寸法は pageTitle が持つので、ここでは階層だけを見せる */
const TYPOGRAPHY_SAMPLES = [
  { label: "ページ見出し", className: "text-lg font-semibold" },
  { label: "セクション見出し", className: "text-base font-semibold" },
  { label: "本文", className: "text-base" },
  { label: "補足", className: "text-xs" },
] as const;

function TypographyTokens() {
  return (
    <div className="flex flex-col gap-4">
      {readRootTokens("--font").map((name) => (
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
