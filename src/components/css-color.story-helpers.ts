/**
 * Canvas 2D の `fillStyle` は、CSS の色として解析できない値を代入すると直前の値を保つ
 * (Canvas 2D 仕様)。この性質を使い、既知の値を入れてから対象を代入し、変わったかどうかで
 * 判定する。ブラウザ自身のパーサを借りるので `color-mix()` や relative color syntax も通る。
 *
 * 既知の値を 1 つにすると、その値そのものを判定したときに「変わらなかった」と読めてしまう。
 * 2 つ用意し、1 つ目と一致したときだけ 2 つ目で測り直す。
 */
const SENTINELS = ["#010203", "#040506"] as const;

/** 2D context を作る口。テストから差し替えるために関数で受ける */
export type ContextFactory = () => CanvasRenderingContext2D | null;

const browserContext: ContextFactory = () => document.createElement("canvas").getContext("2d");

/**
 * 判定器を作る。context の取得は 1 回だけ行い、失敗した結果も覚える。毎回作り直すと、
 * トークンの数だけ canvas が増え、同じ warn が並ぶ。
 */
export function createColorParser(createContext: ContextFactory = browserContext) {
  let cached: { context: CanvasRenderingContext2D | null } | null = null;
  let warned = false;

  return function isColorValue(cssColor: string): boolean {
    cached ??= { context: createContext() };
    const ctx = cached.context;
    if (ctx === null) {
      // 2D context が取れないと全トークンが非色になり、一覧が丸ごと空になる。原因が
      // canvas 側にあることを残さないと、CSSOM の走査を疑うことになる。
      // トークンの数だけ同じ warn を出しても読めないので 1 度だけにする
      if (!warned) {
        warned = true;
        console.warn("[css-color] canvas の 2D context を取得できない。色の一覧は空になる");
      }
      return false;
    }
    const [first, second] = SENTINELS;
    if (changesFillStyle(ctx, first, cssColor)) return true;
    // 1 つ目と同じ値そのものだった可能性が残る。別の値で測り直す
    return changesFillStyle(ctx, second, cssColor);
  };
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
export const isColor = createColorParser();
