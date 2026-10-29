import { afterEach, describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  expectWithinViewport,
  restoreDefaultViewport,
  setViewport,
  TABLET_VIEWPORT,
} from "@/test/assert/viewport";

/**
 * AlertDialogContent の viewport 溢れ backstop。Dialog と共有する registry 乖離
 * (Viewport + `popupOverflowBackstop` + Popup の flex-col。`docs/registry-deviations.md`) のガード。
 * `registry-baseline.test.ts` は baseline の存在しか見ず、乖離が消えても落ちないことを
 * 実測した (2026-09-22) ので、乖離の機能はここで固定する。
 *
 * 到達性は実キーボードで見る。中に tabbable が無いので Popup 自身が focus を受け、End で末尾まで
 * スクロールする。focus が届くのを待ってから End を送る (docs/guides/testing/user-interactions.md
 * 「popup を開いた直後にキーを送る」)。溢れコンテンツは `minHeight` で作る (flex item は既定で縮む。
 * dialog.test.tsx 参照)。
 */

const BOTTOM_MARKER = "末尾コンテンツ";

function renderTallAlertDialog() {
  return render(
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogTitle>確認</AlertDialogTitle>
        <AlertDialogDescription>長い内容でも見切れない</AlertDialogDescription>
        <div style={{ minHeight: "3000px" }}>先頭コンテンツ</div>
        <p>{BOTTOM_MARKER}</p>
      </AlertDialogContent>
    </AlertDialog>,
  );
}

describe("AlertDialogContent（viewport 溢れ backstop）", () => {
  afterEach(restoreDefaultViewport);

  it("Popup は Viewport の中で flex-col に組まれ、長身コンテンツでも viewport 内に収まる", async () => {
    await setViewport(TABLET_VIEWPORT);
    const screen = await renderTallAlertDialog();

    // base-ui 公式 anatomy: Popup は Viewport (配置コンテナ) の中に置く
    const popup = screen.getBySlot("alert-dialog-viewport").getByRole("alertdialog");
    await expect.element(popup).toHaveStyle("display: flex; flex-direction: column");
    await expectWithinViewport(popup);
  });

  it("キーボードで最下部コンテンツまで到達できる", async ({ annotate }) => {
    await setViewport(TABLET_VIEWPORT);
    const screen = await renderTallAlertDialog();
    const marker = screen.getByText(BOTTOM_MARKER);

    await expect.element(screen.getByText("先頭コンテンツ")).toBeInViewport();
    await expect.element(marker).not.toBeInViewport();

    const popup = screen.getByRole("alertdialog");
    await expect.element(popup).toHaveFocus();
    const record = recordEndKeyScroll(popup.element());
    record.snapshot("End の前");
    await userEvent.keyboard("{End}");
    record.snapshot("End の後");

    try {
      await expect.element(marker).toBeInViewport();
    } catch (error) {
      record.snapshot("待ち切った後");
      await annotate(record.report(), "error");
      throw error;
    } finally {
      record.stop();
    }
  });
});

/**
 * End で Popup が scroll しない失敗の原因を調べるための記録。この失敗は CI でだけ起き、手元では macOS でも
 * Linux のコンテナでも再現しなかった (2026-10-29、計 144 回)。End の前後の focus、Popup の scroll の状態、
 * キーと focus の event、描画の回数を時刻つきで集め、到達の assert が落ちたときだけ注釈に残す
 */
function recordEndKeyScroll(popup: Element) {
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
  // Base UI の Popup は End の keydown の伝播を止めるので、bubble では受けられない。capture で受け、dispatch が
  // 終わってから既定の動作を止められたかを読む
  function onKey(event: KeyboardEvent) {
    log(`${event.type} ${event.key} target=${describeNode(event.target)}`);
    setTimeout(() => {
      log(
        `${event.type} ${event.key} の dispatch 後 defaultPrevented=${String(event.defaultPrevented)}`,
      );
    });
  }
  function onFocus(event: FocusEvent) {
    log(`${event.type} target=${describeNode(event.target)}`);
  }
  function onScroll() {
    scrollEvents += 1;
  }
  function onScrollEnd() {
    log(`scrollend scrollTop=${popup.scrollTop}`);
  }

  window.addEventListener("keydown", onKey, true);
  document.addEventListener("focusin", onFocus, true);
  document.addEventListener("focusout", onFocus, true);
  popup.addEventListener("scroll", onScroll);
  popup.addEventListener("scrollend", onScrollEnd);

  return {
    snapshot(label: string) {
      log(
        `${label} active=${describeNode(document.activeElement)} hasFocus=${String(document.hasFocus())} visibility=${document.visibilityState} scrollTop=${popup.scrollTop} scrollHeight=${popup.scrollHeight} clientHeight=${popup.clientHeight} overflowY=${getComputedStyle(popup).overflowY} scrollEvents=${scrollEvents} frames=${frames}`,
      );
    },
    report() {
      return lines.join("\n");
    },
    stop() {
      cancelAnimationFrame(frameRequest);
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("focusout", onFocus, true);
      popup.removeEventListener("scroll", onScroll);
      popup.removeEventListener("scrollend", onScrollEnd);
    },
  };
}

function describeNode(node: EventTarget | null) {
  if (node === null) return "null";
  if (!(node instanceof Element)) return node.constructor.name;
  const role = node.getAttribute("role");
  return role === null ? node.tagName : `${node.tagName}[role=${role}]`;
}
