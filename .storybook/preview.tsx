import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/tanstack-react";
import { Fragment, useSyncExternalStore, type ReactNode } from "react";

import "../src/styles.css";

/**
 * `<html>` の class (light/dark) の変化を購読する。withThemeByClassName は
 * document.documentElement の class を直接書き換えるだけで React の state/props を
 * 経由しないため、購読しないと切り替えが story へ伝わらない。
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
 * テーマが変わるたび story を作り直す。`getComputedStyle` や CSSOM から読んだ値は React の
 * 依存に現れないため、再 render だけでは React Compiler がメモ化した結果を返して値が止まる
 * (2026-09-20 実測)。key での remount なら読み取りごとやり直される。
 *
 * story ごとに書き手が覚える形にすると、値を読む story を足した人が忘れて静かに止まる。
 * 全 story に掛かる decorator として置く。
 */
function RereadOnThemeChange({ children }: { children: ReactNode }) {
  const htmlClass = useHtmlClass();
  return <Fragment key={htmlClass}>{children}</Fragment>;
}

const preview: Preview = {
  decorators: [
    (Story) => (
      <RereadOnThemeChange>
        <Story />
      </RereadOnThemeChange>
    ),
    // styles.css の @custom-variant dark (&:is(.dark *)) に合わせて html へ class を当てる
    withThemeByClassName({
      themes: { light: "", dark: "dark" },
      defaultTheme: "light",
      parentSelector: "html",
    }),
  ],
  parameters: {
    // 違反を警告で留めない。expectNoA11yViolations が持つ「違反ゼロ」と基準を揃える (ADR-0022)
    a11y: { test: "error" },
  },
};

export default preview;
