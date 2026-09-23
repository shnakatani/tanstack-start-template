/**
 * スクリーンリーダーへの通知 (ADR-0034)。`RootDocument` が初期マークアップに置く空の live region へ、
 * 素の DOM でメッセージのノードを追加し、一定時間後に消す。React の state を触らないので、
 * Action (Transition) の中から呼んでも進行中の Transition を blocking に落とさない。
 *
 * 形は React Aria の `LiveAnnouncer` (`role="log"` + `aria-live` + `aria-relevant="additions"`、
 * 7000ms で削除) と同じ。違うのは region の作り方で、React Aria は初回の `announce()` で region を
 * 生成するため、生成直後の取りこぼしを避けて Safari 向けに 100ms 待ってからメッセージを入れる。
 * 本実装は region を初期マークアップに置くので (MDN「ARIA live regions」の最上位の推奨)、
 * その待ちが要らず、`announce()` はその場でノードを足せる。Base UI の
 * `useInitialLiveRegionTextMutation` (200ms) は待ちではなく、mount 時に word joiner を足して
 * 200ms 後に戻す text mutation なので、常時 mount の空 region には当たらない。
 */
export const LIVE_REGION_IDS = {
  polite: "live-region-polite",
  assertive: "live-region-assertive",
} as const;

export type Politeness = keyof typeof LIVE_REGION_IDS;

/** React Aria の LiveAnnouncer と同じ値 */
const MESSAGE_LIFETIME_MS = 7000;

/**
 * politeness に対応する region。無いときの扱い (warn / throw) は呼び出し側が決める
 * (`announce` は warn、テストの `readAnnouncements` は throw)。
 */
export function findLiveRegion(politeness: Politeness): HTMLElement | null {
  return document.getElementById(LIVE_REGION_IDS[politeness]);
}

/**
 * 通知を 1 件足す。呼び出せるのは client の経路だけで、SSR ガードは持たない。
 * server から呼ぶのは配線の誤りなので、`document` の `ReferenceError` で表に出す。
 */
export function announce(message: string, politeness: Politeness = "polite"): void {
  const region = findLiveRegion(politeness);
  if (region === null) {
    console.warn("[announce] live region が無い", { id: LIVE_REGION_IDS[politeness], message });
    return;
  }
  const node = document.createElement("div");
  node.textContent = message;
  region.append(node);
  // `globalThis.` を落とさない。vitest の fake timers が差し替えるのは globalThis 側で、
  // 素の `setTimeout` へ直すと寿命を測るテスト (live-announcer.test.tsx) が進められなくなる
  globalThis.setTimeout(() => {
    node.remove();
  }, MESSAGE_LIFETIME_MS);
}
