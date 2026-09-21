/**
 * `VITEST_STORYBOOK` を Storybook と同じ読み方で解釈する。
 *
 * Storybook 側は `optionalEnvToBoolean` で読み (`storybook` パッケージ内。chunk のファイル名は版ごとに変わるので
 * シンボル名で grep する)、
 * `"false"` と `"0"` と空文字だけを偽として扱う。`=== "true"` で比べると、`VITEST_STORYBOOK=1`
 * のときに addon だけが project 名を上書きし、こちらは project を 2 つ作って名前が衝突する
 * (ADR-0022 の節 7-1)。
 */
export function isStorybookRun(value: string | undefined): boolean {
  if (value === undefined || value === "") return false;
  return value.toUpperCase() !== "FALSE" && value !== "0";
}
