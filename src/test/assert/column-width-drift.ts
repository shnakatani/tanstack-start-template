/** 1 frame で測った table の列見出しの幅 (px)。左の列から順 */
export type ColumnWidthFrame = readonly number[];

/**
 * frame ごとの列見出しの幅の記録から、最初の frame の幅から `tolerancePx` 以上ずれた列を文字列で返す。
 * 空配列なら、記録の間どの列も動いていない。
 *
 * - 列ごとに、ずれが最大の frame を 1 行にする (`"列 6: 50.0 → 70.0 (+20.0px, frame 3/12)"`)。
 *   `toEqual([])` の失敗文に、どの列が何 px 動いたかと、記録のどこで動いたかが残る
 * - frame が 2 未満なら `"frames N"` を返す。1 frame しか無い記録は何も比べていないので通さない
 * - 列の数が途中で変わったら `"columns 6 → 5"` を返す。列が差し替わった記録は幅の比較にならない
 */
export function columnWidthDrifts(
  frames: readonly ColumnWidthFrame[],
  tolerancePx: number,
): string[] {
  const [first, ...rest] = frames;
  if (first === undefined || rest.length === 0) {
    return [`frames ${frames.length}`];
  }
  const changedColumns = frames.find((frame) => frame.length !== first.length);
  if (changedColumns !== undefined) {
    return [`columns ${first.length} → ${changedColumns.length}`];
  }
  const drifts: string[] = [];
  first.forEach((initial, column) => {
    let worst: { frame: number; width: number } | undefined;
    frames.forEach((frame, index) => {
      const width = frame[column];
      if (width === undefined) return;
      const diff = Math.abs(width - initial);
      if (diff < tolerancePx) return;
      if (worst === undefined || diff > Math.abs(worst.width - initial)) {
        worst = { frame: index, width };
      }
    });
    if (worst === undefined) return;
    const diff = worst.width - initial;
    const sign = diff > 0 ? "+" : "-";
    drifts.push(
      `列 ${column + 1}: ${initial.toFixed(1)} → ${worst.width.toFixed(1)} (${sign}${Math.abs(diff).toFixed(1)}px, frame ${worst.frame + 1}/${frames.length})`,
    );
  });
  return drifts;
}
