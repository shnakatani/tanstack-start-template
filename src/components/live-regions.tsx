import { LIVE_REGION_IDS } from "@/lib/live-announcer";

/**
 * `announce()` (ADR-0035) が書き込む live region。初期マークアップに含めるため `RootDocument` に置く。
 * React はこの要素の子を描画しない (空の JSX)。子は `announce` だけが足す
 * (react.dev「Manipulating the DOM with Refs」の Best practices)。
 */
export function LiveRegions() {
  return (
    <>
      <div
        id={LIVE_REGION_IDS.polite}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="sr-only"
      />
      <div
        id={LIVE_REGION_IDS.assertive}
        role="log"
        aria-live="assertive"
        aria-relevant="additions"
        className="sr-only"
      />
    </>
  );
}
