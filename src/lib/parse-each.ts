import * as v from "valibot";

/**
 * 配列の各要素を schema で絞り、通った出力だけを並べて返す。外れた要素は `warnPrefix` と
 * raw input を `console.warn` に残して除外する。
 *
 * `v.parse` で throw しないのは、呼び出し元が描画中に走る経路 (`useMutationState` の結果の
 * 変換) を持ち、throw するとその画面ごと Error Boundary へ落ちるため。除外を silent にすると
 * 「行が出ない」だけが症状になり原因を追えないので、raw input を warn に残す。
 */
export function parseEach<TSchema extends v.GenericSchema>(
  schema: TSchema,
  values: readonly unknown[],
  warnPrefix: string,
): Array<v.InferOutput<TSchema>> {
  const parsed: Array<v.InferOutput<TSchema>> = [];
  for (const rawInput of values) {
    const result = v.safeParse(schema, rawInput);
    if (result.success) {
      parsed.push(result.output);
      continue;
    }
    console.warn(warnPrefix, { rawInput });
  }
  return parsed;
}
