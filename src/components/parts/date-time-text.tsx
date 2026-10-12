import type { ReactNode } from "react";

import { formatDateTime } from "@/lib/format-date-time";

/**
 * 瞬間 (ADR-0031) を画面に出す。`formatDateTime` で基準タイムゾーンの壁時計に整形し、`<time dateTime>` に
 * 機械可読の ISO 8601 を持たせる。`tabular-nums` で数字の字幅をそろえ、日時が替わっても幅が変わらないようにする
 * (ADR-0042。Geist は比例数字で、字ごとに幅が違う)。
 */
export function DateTimeText({ value }: { value: Date }): ReactNode {
  return (
    <time dateTime={value.toISOString()} className="tabular-nums">
      {formatDateTime(value)}
    </time>
  );
}
