import type { TestContext } from "vite-plus/test";

/**
 * popup の中で End を押して末尾へ届くかを見るテストの、失敗の原因を調べるための記録。この失敗は CI でだけ
 * 起き、End のあとに popup が scroll しないまま落ちる。手元では macOS でも Linux のコンテナでも再現しなかった
 * (2026-10-30、計 144 回)。
 *
 * 作った時点から、focus、scroll する容器の状態、末尾の要素の位置、キーと focus の event、scroll の event、
 * 描画の回数を時刻つきで集める。テストは End を送る前に作り、到達の assert が落ちたときだけ `report()` を
 * テストの文脈の `annotate` で残す。listener と描画の数え上げは、テストの終わりに外す。
 *
 * テストファイルの中に書かないのは、ファイルの大きさが変わると、結果のキャッシュの無い CI での実行順が変わり、
 * 失敗が起きた順番 (同じページで、似た End のテストの直後) が崩れるからである (Vitest の `BaseSequencer` は、
 * キャッシュが無いと大きいファイルから走らせる)
 */
export function recordEndKeyScroll(
  scroller: Element,
  marker: Element,
  onTestFinished: TestContext["onTestFinished"],
) {
  const startedAt = performance.now();
  const lines: string[] = [];
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
    const scrollerRect = scroller.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    log(
      `${label} active=${describeNode(document.activeElement)} hasFocus=${String(document.hasFocus())} visibility=${document.visibilityState} scrollTop=${scroller.scrollTop} scrollHeight=${scroller.scrollHeight} clientHeight=${scroller.clientHeight} overflowY=${getComputedStyle(scroller).overflowY} scroller.top=${Math.round(scrollerRect.top)} scroller.bottom=${Math.round(scrollerRect.bottom)} marker.top=${Math.round(markerRect.top)} innerHeight=${window.innerHeight} scrollEvents=${scrollEvents} frames=${frames}`,
    );
  }
  // Base UI の popup は End の keydown の伝播を止めるので、bubble では受けられない。capture で受け、dispatch が
  // 終わってから既定の動作を止められたかと、その時点の状態を読む
  function onKey(event: KeyboardEvent) {
    log(`${event.type} ${event.key} target=${describeNode(event.target)}`);
    setTimeout(() => {
      log(
        `${event.type} ${event.key} の dispatch 後 defaultPrevented=${String(event.defaultPrevented)}`,
      );
      snapshot(`${event.key} の後`);
    });
  }
  function onFocus(event: FocusEvent) {
    log(`${event.type} target=${describeNode(event.target)}`);
  }
  function onScroll() {
    scrollEvents += 1;
    if (scrollEvents === 1) log(`最初の scroll scrollTop=${scroller.scrollTop}`);
  }
  function onScrollEnd() {
    log(`scrollend scrollTop=${scroller.scrollTop}`);
  }

  window.addEventListener("keydown", onKey, true);
  document.addEventListener("focusin", onFocus, true);
  document.addEventListener("focusout", onFocus, true);
  scroller.addEventListener("scroll", onScroll);
  scroller.addEventListener("scrollend", onScrollEnd);
  onTestFinished(() => {
    cancelAnimationFrame(frameRequest);
    window.removeEventListener("keydown", onKey, true);
    document.removeEventListener("focusin", onFocus, true);
    document.removeEventListener("focusout", onFocus, true);
    scroller.removeEventListener("scroll", onScroll);
    scroller.removeEventListener("scrollend", onScrollEnd);
  });
  snapshot("記録の開始");

  return {
    report() {
      snapshot("報告の時点");
      return lines.join("\n");
    },
  };
}

function describeNode(node: EventTarget | null) {
  if (node === null) return "null";
  if (!(node instanceof Element)) return node.constructor.name;
  const role = node.getAttribute("role");
  return role === null ? node.tagName : `${node.tagName}[role=${role}]`;
}
