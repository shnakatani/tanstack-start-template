/**
 * Canvas 2D の `fillStyle` は、CSS の色として解析できない値を代入すると直前の値を保つ
 * (Canvas 2D 仕様)。この性質を使い、既知の値を入れてから対象を代入し、変わったかどうかで
 * 判定する。ブラウザ自身のパーサを借りるので `color-mix()` や relative color syntax も通る。
 *
 * 既知の値を 1 つにすると、その値そのものを判定したときに「変わらなかった」と読めてしまう。
 * 2 つ用意し、1 つ目と一致したときだけ 2 つ目で測り直す。
 */
const SENTINELS = ["#010203", "#040506"] as const;

/** 使い回す。トークンの数だけ canvas を作ると、一覧の描画ごとに要素と context が増える */
let sharedContext: CanvasRenderingContext2D | null | undefined;

function context(): CanvasRenderingContext2D | null {
  sharedContext ??= document.createElement("canvas").getContext("2d");
  return sharedContext;
}

function changesFillStyle(ctx: CanvasRenderingContext2D, sentinel: string, value: string): boolean {
  ctx.fillStyle = sentinel;
  ctx.fillStyle = value;
  return ctx.fillStyle !== sentinel;
}

/**
 * `cssColor` が CSS の色として解析できるかを判定する。warn は出さない静かな述語で、
 * トークン一覧から非色 (spacing / font / animation 等) を選り分ける用途に使う。ここで
 * 鳴らすと非色トークンの数だけ warn が出て、一覧の欠落を示す warn が埋もれる。
 */
export function isColor(cssColor: string): boolean {
  const ctx = context();
  if (ctx === null) {
    // 2D context が取れないと全トークンが非色になり、一覧が丸ごと空になる。原因が
    // canvas 側にあることを残さないと、CSSOM の走査を疑うことになる
    console.warn("[css-color] canvas の 2D context を取得できない", { cssColor });
    return false;
  }
  const [first, second] = SENTINELS;
  if (changesFillStyle(ctx, first, cssColor)) return true;
  // 1 つ目と同じ値そのものだった可能性が残る。別の値で測り直す
  return changesFillStyle(ctx, second, cssColor);
}
