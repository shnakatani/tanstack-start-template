import { useId } from "react";
import type { ReactNode } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field";

/**
 * 複数選択リストの器。`FieldGroup` 素の gap はフォームのフィールド間の値で行の並びには
 * 過大なため、shadcn の正典も checkbox グループでは上書きを例示する。
 * その例示値からさらに 1 段詰めるのは、候補が数十件並ぶ画面で同じ高さに収まる行数を
 * 優先した判断。
 */
function ChoiceCardList({ children }: { children: ReactNode }) {
  return <FieldGroup className="gap-2">{children}</FieldGroup>;
}

/**
 * 複数選択リストの 1 行。公式の Choice Card パターン。
 *
 * > Wrap `Field` components inside `FieldLabel` to create selectable field groups.
 * > This works with `RadioItem`, `Checkbox` and `Switch` components.
 * > — https://ui.shadcn.com/docs/components/base/field (Choice Card)
 */
function ChoiceCard({
  id,
  label,
  checked,
  disabled = false,
  trailing,
  onCheckedChange,
}: {
  /** 省略時は内部で採番する。外から参照する必要があるときだけ渡す */
  id?: string;
  label: ReactNode;
  checked: boolean;
  disabled?: boolean;
  /**
   * タイトルと checkbox の間に置く補足 (識別子・状態バッジ等)。
   * `Field` horizontal は `FieldContent` があると `items-start` になる (`ui/field.tsx`) ので、
   * 補足はタイトルの 1 行目に上端を揃える。行の content box より低い補足に `self-center` を
   * 足すとその分だけ下がるため、registry の揃えから外したいときだけ渡す
   */
  trailing?: ReactNode;
  onCheckedChange: (checked: boolean) => void;
}) {
  // デフォルト引数 (id = useId()) にしない。引数が undefined のときだけ評価されるため
  // hook の呼び出しが条件付きになり、消費側が id の有無を切り替えると hook 数が変わる
  const generatedId = useId();
  const rowId = id ?? generatedId;

  return (
    <FieldLabel
      htmlFor={rowId}
      // disabled 行はクリックが no-op になるので、押せると主張しない。
      // registry 側に救済経路が無い (Label の group-data-[disabled=true] は
      // 祖先に素の .group を要求し、Choice Card では当たらない)
      className={disabled ? "shrink-0 cursor-default" : "shrink-0 cursor-pointer"}
    >
      <Field orientation="horizontal" data-disabled={disabled || undefined}>
        <FieldContent>
          <FieldTitle>{label}</FieldTitle>
        </FieldContent>
        {trailing}
        <Checkbox
          id={rowId}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
        />
      </Field>
    </FieldLabel>
  );
}

export { ChoiceCard, ChoiceCardList };
