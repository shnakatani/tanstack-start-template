import { cn } from "cn";

import { ActionForm, type ActionFormProps } from "@/components/action/form";

/**
 * 内部スクロール方式のダイアログで、`DialogHeader` / `DialogFooter` の間に置く
 * 中間コンテナを縦の flex container にする。`DialogScrollBody` と組で使う。
 * 送信を伴う中間コンテナは `DialogScrollForm` が持つ。送信を伴わない `div` の中間コンテナが
 * 要るときは、この定数を層の外へ配らずこのファイルへ部品を足す (`require-static-classes`)。
 * 1280x600 で各クラスを外して実測した結果:
 *
 * - `flex` / `flex-col`: 外すと本体とフッターが横並びになるか、子の縮みが効かず本体が
 *   ダイアログ外へはみ出してフッターが見えなくなる
 * - `min-h-0`: flex item の既定 `min-height: auto` を打ち消す。外すと中間コンテナが内容高
 *   (594.3px) を下限に持ち `DialogContent` の制約まで縮まないため内部スクロールが成立しない
 * - `gap-6`: 本体とフッターの間隔。`DialogScrollBody` の縦 padding はスクロール領域の内側に
 *   ありスクロールで流れるため、固定側に余白を持たせる。`DialogContent` の `gap-6` と同値に
 *   することで区切り線の上下が 24px で対称になる (`gap-4` だと上 24px / 下 16px の非対称に
 *   なり、同じ「固定領域との境界」に 2 つの値が混じる)
 *
 * `flex-1` は実測で不要と判明したため持たない (`DialogContent` が `max-h-full` で内容高に
 * 従うので `flex-grow` が働く余白がない)。
 */
export const dialogScrollLayout = "flex min-h-0 flex-col gap-6";

/**
 * 内部スクロール方式のダイアログで、送信を伴う中間コンテナになる `form`。
 * 恒常的に viewport 高を超えるダイアログはこれと `DialogScrollBody` で組み、本体だけをスクロール
 * させる (Base UI Dialog の Inside scroll の形に、送信を持つ中間コンテナを足したもの)。組み忘れても
 * registry の Dialog の backstop (`popupOverflowBackstop`) で Popup ごと流れるので、内容は読める。
 * 見出しと X ボタンは sticky にしない。内部スクロールと 2 つの固定機構が重なり、どちらが効いているか
 * 実測しないと分からなくなる。shadcn の例のように本文を `max-h-[50vh]` で打ち切る形も採らない。
 * 打ち切りの値が viewport と Dialog の余白に追随せず、ダイアログごとに値を持つことになる。
 * `dialogScrollLayout` を当てた `ActionForm` で、`DialogScrollBody` と `DialogFooter` を包む。
 *
 * 依存の向きを parts → action にしてあるのは、汎用の `ActionForm` が特定のダイアログの
 * レイアウトを知らずに済むようにするため。逆向きにすると Action 層の責務が広がる (ADR-0016)。
 */
export function DialogScrollForm({ className, ...props }: ActionFormProps) {
  return <ActionForm className={cn(dialogScrollLayout, className)} {...props} />;
}
