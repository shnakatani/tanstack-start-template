import { cdp } from "vite-plus/test/browser/context";

/**
 * マウスをどの要素にも乗らない viewport 外の位置へ退避する。
 * 座標は viewport 寸法に依存しないため、呼び出し時の viewport を気にせず使える。
 * 全体 run ではブラウザインスタンスが再利用され、前ファイルの click 位置にマウスが残る。
 * hover 由来の配色と交絡すると、開状態のスタイルを検証するテストが実装を壊しても素通りする。
 *
 * 公式の `userEvent.unhover()` は `document.body` へ移すだけで (vitest の interactivity API)、body の
 * 中央に要素があればその hover が残る。どの要素にも乗らない位置は viewport 外にしか無いので CDP で出す。
 */
export async function parkMouse(): Promise<void> {
  await cdp().send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: -1,
    y: -1,
  });
}
