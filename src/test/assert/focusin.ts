import { onTestFinished } from "vite-plus/test";

/**
 * これから focusin を受けた要素を順に記録する。1 frame だけ focus が通った要素は、`toHaveFocus` の
 * retry の間隔では捉えられない
 */
export function recordFocusins(): Element[] {
  const targets: Element[] = [];
  const record = (event: FocusEvent) => {
    if (event.target instanceof Element) {
      targets.push(event.target);
    }
  };
  document.addEventListener("focusin", record);
  onTestFinished(() => document.removeEventListener("focusin", record));
  return targets;
}
