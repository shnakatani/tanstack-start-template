import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";

import { cn } from "@/lib/utils";

/**
 * セグメント表示の排他選択 (segmented radio group)。
 *
 * ToggleGroup ではなく RadioGroup を土台にする。決め手はセマンティクスで、必須の単一選択には
 * role="radiogroup" + aria-checked (RadioGroup.js / RadioRoot.js) が要る。base-ui の ToggleGroup は
 * トグルボタンパターンで role="group" + aria-pressed になり (ToggleGroup.js / Toggle.js)、
 * これは prop では埋められない。mui/base-ui#3525 で維持者も「radio group を直接使え」と回答している。
 * Radix / React Aria / Ark UI / Chakra はいずれも単一選択の segmented control を radiogroup
 * セマンティクスで実装しており、この構成は多数派に沿う。
 * なお ToggleGroup は選択済み項目の再クリックで値が空配列になるが (ToggleGroup.js)、これは
 * onValueChange で eventDetails.cancel() すれば防げるため却下理由としては弱い。
 *
 * 意匠は registry の Tabs (variant=default) から取っている。shadcn-ui/ui#8839 のとおり shadcn の
 * 現行 Tabs は実体が segmented control であり、この見た目が標準形である。ただし TabsTrigger は
 * cva 化されておらず借用できないため、値をこのファイルで持つ (registry を書き換えて export を
 * 増やすと ADR-0006 の許容リストに恒久的な乖離が増える)。
 *
 * **値の出所は tabs.tsx の tabsListVariants (トラック) と TabsTrigger (セグメント)。registry の
 * Tabs を再生成したときは突き合わせること。** そのままではない差分は次のとおり。
 * - 高さは h-full (TabsTrigger は h-[calc(100%-1px)])。トラック 36px に対し実効 30px になる
 * - min-w-12 を足している (等幅化。registry には無い)
 * - relative は採っていない (TabsTrigger は持つが、包含ブロックを要する after 下線を使わない)
 * - data-active を data-checked へ読み替えている (Tabs と radio で選択状態の属性が違う)
 * - py-1 / has-data-[icon=*] / [&_svg]* / dark:* は採っていない (アイコンを載せない前提。dark は
 *   切替経路を用意していない。切替を入れるときに揃える)
 * - gap-1.5 は採っていない (アイコンを載せないため子要素が 1 つ)
 * - focus ring の 3px は ring-3 表記にした (TabsTrigger は ring-[3px]。出力は同一で、
 *   リポジトリ多数派 (button / select / input / checkbox / radio-group) が ring-3)
 * - aria-invalid 系 3 クラスを足している (出所は radio-group.tsx。Tabs は持たない)。
 *   registry の RadioGroupItem と同じく **item 自身の属性**で発火する。group に付けても
 *   item には当たらないため、消費側は item ごとに aria-invalid を渡す
 * - トラックは tabsListVariants の text-muted-foreground を採らない (未選択の文字色は
 *   セグメント側の text-foreground/60 で決める)
 *
 * outline-none は書かない。同居すると --tw-outline-style が none に固定され、
 * focus-visible:outline-1 が outline-width だけ効いて描画されなくなる (実機で確認)。
 * TabsTrigger も outline-none を持たない (tabs.tsx の outline-none は TabsContent のもの)。
 *
 * ラベルは持たない。registry の RadioGroup / ToggleGroup / Tabs と同じく、凡例や可視ラベルの
 * markup は消費側が組む。テーブルセル内など列ヘッダーがラベルを兼ねる場面では消費側が
 * aria-label で名前を与える。
 */

/**
 * 選択肢を収めるトラック。segmented control は「連結した枠の中で 1 つが浮く」構造で
 * アクションボタンと区別されるため、枠 (bg-muted) と内側パディングが識別要素になる。
 */
const SEGMENTED_RADIO_GROUP =
  "inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-[3px]";

/**
 * セグメント 1 個。
 *
 * min-w-12 (48px) が 1 文字ラベルと 2 文字ラベルの幅を揃える。w-fit のトラックでは自由空間が
 * 生まれず、flex-1 だけでは文字数ぶんの幅差がそのまま残るため、下限で揃える。
 * 未選択は text-foreground/60 で、トラック上のコントラストは約 5.2:1 (AA を満たす。実機実測)。
 * 選択は bg-background + shadow-sm の浮いたつまみで、文字は text-foreground (20.16:1)。
 * hover が選択済みの文字色を奪わないのは、選択時と hover 時がどちらも text-foreground で
 * 同色だからである (異なる色を選ぶと data-checked は :where() 包みで特異度がゼロ加算のため
 * hover に負ける。segmented-radio-group.test.tsx がこれを回帰として固定している)。
 * 無効表示は aria-disabled で書く。base-ui の Radio.Root は span を描画するため
 * :disabled 疑似クラスが当たらず、代わりに aria-disabled="true" が付く。
 */
const SEGMENTED_RADIO_GROUP_ITEM =
  "inline-flex h-full min-w-12 flex-1 items-center justify-center rounded-md border border-transparent px-2 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-checked:bg-background data-checked:text-foreground data-checked:shadow-sm";

function SegmentedRadioGroup<Value extends string>({
  className,
  ...props
}: RadioGroupPrimitive.Props<Value>) {
  return (
    <RadioGroupPrimitive
      data-slot="segmented-radio-group"
      className={cn(SEGMENTED_RADIO_GROUP, className)}
      {...props}
    />
  );
}

// registry の RadioGroupItem / ToggleGroupItem と同じく非ジェネリック。base-ui の Radio.Root の
// ジェネリックは親 RadioGroup の Value と型で結ばれないため、付けても型安全を生まない
function SegmentedRadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props<string>) {
  return (
    <RadioPrimitive.Root
      data-slot="segmented-radio-group-item"
      className={cn(SEGMENTED_RADIO_GROUP_ITEM, className)}
      {...props}
    />
  );
}

export { SegmentedRadioGroup, SegmentedRadioGroupItem };
