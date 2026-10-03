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
   * checkbox の名前には入れず、説明として結ぶ
   */
  description?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  /**
   * タイトルと checkbox の間に置く補足 (状態バッジ等)。説明文の後ろに続けて checkbox の説明として読ませる。
   * 行を見分ける識別子として名前に読ませたいときは、`label` に含める。
   * `Field` horizontal は `FieldContent` があると `items-start` になる (`ui/field.tsx`) ので、
   * 補足はタイトルの 1 行目に上端を揃える
   */
  trailing?: ReactNode;
  onCheckedChange: (checked: boolean) => void;
}) {
  // デフォルト引数 (id = useId()) にしない。引数が undefined のときだけ評価されるため
  // hook の呼び出しが条件付きになり、消費側が id の有無を切り替えると hook 数が変わる
  const generatedId = useId();
  const rowId = id ?? generatedId;
  const titleId = useId();
  const descriptionId = useId();
  const trailingId = useId();
  // `cond && <Badge />` の偽 (false) などの何も描かない値で包みを描くと、空の要素が flex の子になって隙間が増える
  const hasTrailing = trailing !== undefined && trailing !== null && typeof trailing !== "boolean";
  // label の中のテキストはすべて checkbox の名前に入るので、名前をタイトルに絞り、
  // 説明文と trailing は説明として結ぶ (docs/guides/forms-and-inputs.md「Choice Card の名前と説明を分ける理由」)
  const describedBy =
    [description === undefined ? undefined : descriptionId, hasTrailing ? trailingId : undefined]
      .filter((value) => value !== undefined)
      .join(" ") || undefined;

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
          <FieldTitle id={titleId}>{label}</FieldTitle>
          {description !== undefined && (
            <FieldDescription id={descriptionId}>{description}</FieldDescription>
          )}
        </FieldContent>
        {hasTrailing && (
          // 説明に結ぶ id を付けるための包み。display: contents にしない。
          // contents の要素の読み上げはブラウザで差が出てきた (docs/guides/forms-and-inputs.md「Choice Card の名前と説明を分ける理由」)
          <span id={trailingId}>{trailing}</span>
        )}
        <Checkbox
          id={rowId}
          checked={checked}
          disabled={disabled}
          aria-labelledby={titleId}
          aria-describedby={describedBy}
          onCheckedChange={onCheckedChange}
        />
      </Field>
    </FieldLabel>
  );
}

export { ChoiceCard, ChoiceCardList };
