/**
 * スクリーンリーダーへの通知 (ADR-0017)。`RootDocument` が初期マークアップに置く空の live region へ、
 * 素の DOM でメッセージのノードを追加し、一定時間後に消す。React の state を触らないので、
 * Action (Transition) の中から呼んでも進行中の Transition を blocking に落とさない。
 *
 * 形は React Aria の `LiveAnnouncer` (`role="log"` + `aria-live` + `aria-relevant="additions"`、
 * 7000ms で削除) と同じ。region を初回の announce で作らず初期マークアップに置く点だけ違う。
 */
export const LIVE_REGION_IDS = {
  polite: "live-region-polite",
  assertive: "live-region-assertive",
} as const;

export type Politeness = keyof typeof LIVE_REGION_IDS;

/** React Aria の LiveAnnouncer と同じ値 */
const MESSAGE_LIFETIME_MS = 7000;

export function announce(message: string, politeness: Politeness = "polite"): void {
  if (typeof document === "undefined") {
    return;
  }
  const id = LIVE_REGION_IDS[politeness];
  const region = document.getElementById(id);
  if (region === null) {
    console.warn("[announce] live region が無い", { id, message });
    return;
  }
  const node = document.createElement("div");
  node.textContent = message;
  region.append(node);
  globalThis.setTimeout(() => {
    node.remove();
  }, MESSAGE_LIFETIME_MS);
}
