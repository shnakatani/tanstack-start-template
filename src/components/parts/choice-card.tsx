import { useId } from "react";
import type { ReactNode } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";

/**
 * 補足を添える選択肢や、選択が主役の一覧に並べるカード状の行の器。ラベルだけの複数選択は
 * FieldSet の中に Field の行を並べる (docs/guides/forms-and-inputs.md「入力欄の周りに要素を置く」)。
 * まとまりの名前は外側の `FieldSet` と `FieldLegend` が持つ。
 *
 * `FieldGroup` 素の gap はフォームのフィールド間の値で行の並びには過大なため、registry の
 * `FieldGroup` が持つ `data-[slot=checkbox-group]:gap-3` に寄せる。shadcn の registry の例
 * (`dialog-example.tsx`) も `data-slot="checkbox-group"` で同じ間隔にしている。
 */
function ChoiceCardList({ children }: { children: ReactNode }) {
  return <FieldGroup data-slot="checkbox-group">{children}</FieldGroup>;
}

/**
 * 補足を添える選択肢や、選択が主役の一覧のカード状の行。ラベルだけの複数選択は FieldSet の中に
 * Field の行を並べる (docs/guides/forms-and-inputs.md「入力欄の周りに要素を置く」)。
 * 公式の Choice Card パターンを `Checkbox` で組む。
 *
 * > Wrap `Field` components inside `FieldLabel` to create selectable field groups.
 * > This works with `RadioItem`, `Checkbox` and `Switch` components.
 * > — https://ui.shadcn.com/docs/components/base/field (Choice Card)
 */
function ChoiceCard({
  id,
  label,
  description,
  checked,
  disabled = false,
  trailing,
  onCheckedChange,
}: {
  /** 省略時は内部で採番する。外から参照する必要があるときだけ渡す */
  id?: string;
  label: ReactNode;
  /**
   * タイトルの下に置く説明文。shadcn の Choice Card の例と同じく、`FieldContent` の中で `FieldTitle` に続ける。
   * registry の `FieldDescription` は control と結ばれないので、id を checkbox の `aria-describedby` へ渡す
   */
  description?: ReactNode;
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
  const descriptionId = useId();

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
          {description !== undefined && (
            <FieldDescription id={descriptionId}>{description}</FieldDescription>
          )}
        </FieldContent>
        {trailing}
        <Checkbox
          id={rowId}
          checked={checked}
          disabled={disabled}
          aria-describedby={description === undefined ? undefined : descriptionId}
          onCheckedChange={onCheckedChange}
        />
      </Field>
    </FieldLabel>
  );
}

export { ChoiceCard, ChoiceCardList };
