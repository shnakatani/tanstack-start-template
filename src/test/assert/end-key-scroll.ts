import type { TestContext } from "vite-plus/test";

/**
 * popup の中で End を押して末尾へ届くかを見るテストの、失敗の原因を調べるための記録。この失敗は CI でだけ
 * 起き、End のあとに popup が scroll しないまま落ちる。手元では macOS でも Linux のコンテナでも再現しなかった
 * (2026-10-30、計 144 回)。`act` (End を送って到達を確かめる処理) が throw したときだけ、集めた値を
 * テストの文脈の `annotate` で残し、throw し直す。
 *
 * テストファイルの中に書かないのは、ファイルの大きさが変わると、結果のキャッシュの無い CI での実行順が変わり、
 * 失敗が起きた順番 (同じページで、似た End のテストの直後) が崩れるからである (Vitest の `BaseSequencer` は、
 * キャッシュが無いと大きいファイルから走らせる)。End の前には同期のレイアウトを強いる読み出しを減らし、
 * scroll できる状態は End の既定の動作の後に、位置は失敗の時点に読む
 */
export async function recordEndKeyScroll(
  { annotate }: Pick<TestContext, "annotate">,
  { scroller, marker }: { scroller: Element; marker: Element },
  act: () => Promise<void>,
) {
  const startedAt = performance.now();
  const lines: string[] = [];
  const listening = new AbortController();
  let scrollEvents = 0;
  let frames = 0;
  let frameRequest = requestAnimationFrame(countFrame);

  function countFrame() {
    frames += 1;
    frameRequest = requestAnimationFrame(countFrame);
  }
  function log(line: string) {
    lines.push(`${Math.round(performance.now() - startedAt)}ms ${line}`);
  }
  function snapshot(label: string) {
    log(
      `${label} active=${describeNode(document.activeElement)} hasFocus=${String(document.hasFocus())} visibility=${document.visibilityState} scrollTop=${scroller.scrollTop} scrollEvents=${scrollEvents} frames=${frames}`,
    );
  }
  function logScrollable() {
    log(
      `scrollHeight=${scroller.scrollHeight} clientHeight=${scroller.clientHeight} overflowY=${getComputedStyle(scroller).overflowY}`,
    );
  }

  // Base UI の popup は End の keydown の伝播を止めるので、bubble では受けられない。capture で受け、dispatch が
  // 終わってから既定の動作を止められたかを読む
  window.addEventListener(
    "keydown",
    (event) => {
      setTimeout(() => {
        log(
          `keydown ${event.key} target=${describeNode(event.target)} defaultPrevented=${String(event.defaultPrevented)}`,
        );
        snapshot(`${event.key} の後`);
        logScrollable();
      });
    },
    { capture: true, signal: listening.signal },
  );
  for (const type of ["focusin", "focusout"] as const) {
    document.addEventListener(
      type,
      (event) => {
        log(`${type} target=${describeNode(event.target)}`);
      },
      {
        capture: true,
        signal: listening.signal,
      },
    );
  }
  scroller.addEventListener("scroll", () => (scrollEvents += 1), { signal: listening.signal });
  scroller.addEventListener("scrollend", () => log(`scrollend scrollTop=${scroller.scrollTop}`), {
    signal: listening.signal,
  });
  snapshot("End の前");

  try {
    await act();
  } catch (error) {
    snapshot("失敗の時点");
    logScrollable();
    const scrollerRect = scroller.getBoundingClientRect();
    log(
      `scroller.top=${Math.round(scrollerRect.top)} scroller.bottom=${Math.round(scrollerRect.bottom)} marker.top=${Math.round(marker.getBoundingClientRect().top)} innerHeight=${window.innerHeight}`,
    );
    await annotate(lines.join("\n"), "error");
    throw error;
  } finally {
    cancelAnimationFrame(frameRequest);
    listening.abort();
  }
}

function describeNode(node: EventTarget | null) {
  if (node === null) return "null";
  if (!(node instanceof Element)) return node.constructor.name;
  const role = node.getAttribute("role");
  return role === null ? node.tagName : `${node.tagName}[role=${role}]`;
}
