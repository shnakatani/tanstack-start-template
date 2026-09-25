import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";
import { XIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * Popup の配置コンテナ (base-ui 公式 anatomy の Dialog.Viewport)。
 * Dialog / AlertDialog 共通。fixed で画面全体を覆って Popup を中央寄せし、
 * p-4 が Popup と画面端の余白 (上下左右 1rem) を担う。
 */
export const popupViewportLayout =
  "fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-4";

/**
 * 内容が viewport 高を超える場合の backstop。Dialog / AlertDialog の
 * Popup 共通。高さの上限は Viewport (popupViewportLayout) の padding 内に収まる
 * max-h-full で制約し、超過分は Popup 全体のスクロールで到達可能にする。
 */
export const popupOverflowBackstop = "max-h-full overflow-y-auto";

// registry 乖離: detached trigger の payload 型を透過するための generic 化。
// base-ui createHandle<Payload> と組で使う。
function Dialog<Payload = unknown>({ ...props }: DialogPrimitive.Root.Props<Payload>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger<Payload = unknown>({ ...props }: DialogPrimitive.Trigger.Props<Payload>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

/** detached trigger 用 handle を作る (base-ui createHandle の re-export)。1 handle につき Root は 1 つ (複数 Root は非サポートで、後からマウントした Root が状態を引き継いでしまう)。Root を同時に 1 つしか描画されない場所に置き、そこへ向けて Trigger を配る。 */
const createDialogHandle = DialogPrimitive.createHandle;

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Viewport data-slot="dialog-viewport" className={popupViewportLayout}>
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            // 縦積みは flex column (base-ui 公式の inside-scroll パターンと同型)。ヘッダー・
            // フッターを固定したまま中間要素だけスクロールさせたいダイアログは、共有部品の
            // DialogScrollBody (このファイル) で本体を包む。この p-6 を
            // 打ち消して Viewport の内側へ移す実装なので、padding を変えるときは同部品も見る。
            // 内部スクロールを持たないダイアログは、popupOverflowBackstop の overflow-y-auto で
            // DialogContent 全体がスクロールする。backstop スクロール発火時は absolute 配置の
            // X 閉じるボタンもコンテンツと共に流れるため、恒常的に溢れる長大ダイアログを
            // 新設する場合は内部スクロール方式にする。X が流れる挙動は防御層として許容し
            // sticky は作らない (base-ui 公式の outside scroll パターンも X が流れる設計で、
            // sticky 化した独自実装に公式前例がないため)。
            popupOverflowBackstop,
            "relative flex min-h-0 w-full max-w-full flex-col gap-6 rounded-xl bg-popover p-6 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              render={<Button variant="ghost" className="absolute top-4 right-4" size="icon-sm" />}
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>Close</DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-heading leading-none font-medium", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

/**
 * 内部スクロール方式のダイアログ本体 (base-ui 公式の inside-scroll パターン)。
 * `DialogHeader` と `DialogFooter` を固定したまま、この領域だけをスクロールさせる。
 *
 * base-ui にも shadcn registry にも Body に相当するパートは無いため、両者を組み合わせた
 * registry からの乖離として `ui/dialog.tsx` に置く (`docs/registry-deviations.md`)。見た目は
 * `ScrollArea` への class で持ち、部品ディレクトリの外で当てると `no-restyle` が止める
 * (ADR-0011)。
 *
 * `-mx-6` と `px-6` は `DialogContent` の `p-6` (`ui/dialog.tsx`) を打ち消して Viewport の
 * 内側へ移すためのペア。Viewport は `overflow: scroll` なので、内側に余白がないと入力の
 * focus ring (`input.tsx` の `focus-visible:ring-3` = box-shadow 3px) が境界でクリップされる。
 * **`DialogContent` の padding を変えたらこの値も変える**。ずれは `action/dialog.stories.tsx`
 * の `Overflowing` で、本文と見出しの左端の揃いとして見える。
 *
 * `py-4` は同じクリップを縦で防ぐ。先頭・末尾に来た要素 (input の focus ring、`card.tsx` の
 * `ring-1`) が境界で切れる。横と違い打ち消す対象がないので値は独立で、消費側が個別に持って
 * いた `FieldGroup` の縦 padding を本体へ集約したもの。区切り線との間隔でもあるため、変えると
 * 全ダイアログの本文開始位置が動く。
 *
 * `border-y` は固定領域とスクロール領域の境界を示す (base-ui 公式が Header の
 * `border-bottom` と Actions の `border-top` で担っている役割)。`-mx-6` により
 * ダイアログの左右端まで届く。溢れていないダイアログでは線が装飾に見えるため、
 * base-ui が Root と Viewport の双方に出す `data-has-overflow-y` でスクロールが要るときだけ色を付ける
 * (`border-transparent` を先に置くのでレイアウトシフトは起きない)。border を registry の
 * `ui/scroll-area.tsx` 側へは入れない — 入れると境界線を求めていない消費者
 * (`route-error.tsx` のスタックトレース領域など) にも不要な線が出る。同じ属性で出し分けて
 * いるスクロールバー幅の退避は、バーの太さと対なので `ui/scroll-area.tsx` が既定で持つ。
 *
 * `data-has-overflow-y:pr-0` は `ScrollArea` の既定 (スクロールバー幅の退避) を降りる指定。
 * 本文の `px-6` が既にバー幅を上回るので、上乗せすると本文だけ見出し・フッターよりバー幅ぶん
 * 内へ寄って端がそろわなくなる。バーを本文の余白の上に載せる形は base-ui 公式の inside-scroll
 * デモと同じで、あちらも header / 本文 / footer を同じ `p-4` に置き `w-4` のバーを載せている。
 * ただし公式のバーは hover / スクロール中しかポインタを受けないのに対し registry のバーは
 * 常時受けるので、末尾側の余白を持たない器での既定の退避そのものは要る (ADR-0020)。
 * `px-6` がバー幅を下回ると本文がバーに隠れるため、降りてよいことは `Overflowing` story で
 * 本文とバーが重ならないことで見る。
 * 降りられるのは `cn` の衝突解決が既定側の `pr-2.5` を落とすからで、詳細度は同じ、
 * CSS の出力順ではむしろ既定が後に来る。衝突解決を持たない結合 (`cn` が併せて export する
 * `clsx` など) に替えると既定が無言で復活する。
 * x 軸は既定のまま残す。`py-4` も横バーの太さを上回るが、下端にはそろえる相手が無いため
 * (区切り線は Root の border で、Root の padding の外に描かれる)。
 *
 * `scroll-area-focus-outline` (`styles.css`) は Viewport のフォーカス指標を Root へ移す共有
 * utility。ここで要るのは、Viewport の border box が Root の padding box と一致するため
 * `overflow-hidden` が Viewport の ring を全周クリップするからである。公式 CSS も `.Body` の
 * `overflow: hidden` と `.Body:has(.BodyViewport:focus-visible)` を対で持っている。
 *
 * Root の `flex-1` / `min-h-0` / `overflow-hidden` と Viewport の `flex-1` / `min-h-0` は
 * 公式 CSS の `.Body` / `.BodyViewport` に対応する指定。1280x600 の実測では `flex-col` を
 * 入れて Root の高さが確定すれば Viewport の `size-full` が解決されるため外しても動くが、
 * その場合「なぜ動くか」が base-ui の Viewport が `overflow: scroll` を持つことへの暗黙
 * 依存になるので公式どおり残す。**機能を担っているのは `flex-col` (外すと内部スクロールが
 * 効かない) と `-mx-6` / `px-6` (外すと内容が 24px 内側へずれ、focus ring がクリップされる)**。
 *
 * フォームを持つダイアログでも、Root は Popup の flex の子になる。`ActionDialogContent`
 * (`action/dialog.tsx`) の form が `display: contents` で box を作らないため、公式の
 * inside-scroll 例と同じく Popup の直下に Header / ScrollArea.Root / Actions が並ぶ。
 */
function DialogScrollBody({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof ScrollArea>, "viewportClassName" | "children"> & {
  children: React.ReactNode;
}) {
  return (
    <ScrollArea
      data-slot="dialog-scroll-body"
      className={cn(
        "scroll-area-focus-outline -mx-6 flex min-h-0 flex-1 flex-col overflow-hidden border-y border-transparent data-has-overflow-y:border-border data-has-overflow-y:pr-0",
        className,
      )}
      viewportClassName="min-h-0 flex-1 overscroll-contain px-6 py-4"
      {...props}
    >
      {children}
    </ScrollArea>
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogScrollBody,
  DialogTitle,
  DialogTrigger,
  createDialogHandle,
};
