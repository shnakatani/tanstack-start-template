/**
 * Storybook 経由の実行か。真ならテーマごとの project を作れない。
 *
 * `@storybook/addon-vitest` はこのとき project 名を `storybook:${configDir}` へ上書きするので、
 * 同じ `configDir` から 2 つ作ると名前が衝突して Vitest が起動しない (ADR-0047)。
 */
export function isStorybookRun(value: string | undefined): boolean {
  // 読み方を addon へ揃える。addon は `optionalEnvToBoolean` で読み、`"false"` と `"0"` と
  // 空文字だけを偽にする。`=== "true"` で比べると `VITEST_STORYBOOK=1` のときに addon だけが
  // 名前を上書きし、こちらは 2 つ作って衝突が戻る。
  //
  // node_modules の参照はシンボル名で書く。chunk のファイル名は版ごとに変わるので、
  // パスで書くと次の更新で辿れなくなる
  if (value === undefined || value === "") return false;
  return value.toUpperCase() !== "FALSE" && value !== "0";
}
