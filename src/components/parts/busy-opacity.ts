/**
 * `aria-busy` の項目を半透明にする class。`DataTable` の busy 行と `StaleContent` が同じ値を使う。
 * 値が 60 なのは、`opacity-50` が light で本文のコントラストを WCAG 1.4.3 の 4.5:1 より下へ落とすため
 * (ADR-0020)。dark は満たすが、テーマで値を変えない。当たる対は `--background` の上の `--foreground` で、
 * 不透明度がそのまま文字へ掛かるので不透明度を綴りへ移して測る:
 *   mise run contrast -- --theme light --bg '--background' --fg '--foreground/50'
 *   mise run contrast -- --theme light --bg '--background' --fg '--foreground/60'
 */
export const BUSY_OPACITY_CLASS = "aria-busy:opacity-60";
