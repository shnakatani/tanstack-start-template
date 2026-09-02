/**
 * jsPlugin が実際にロードされ、`lint.settings` の `entryPoint` が解決できていることを見る。
 * どちらも `--print-config` の出力に現れないため、設定値の突き合わせでは代替できない
 * (oxc-project/oxc#22117、ADR-0004)。
 *
 * `bg-red-500` は `src/styles.css` が既定 palette を初期化して初めて未知になる。entryPoint の
 * 解決に失敗すると素の Tailwind theme へ落ちて既知クラスに戻り、下の directive が不要になる。
 * `--report-unused-disable-directives` がそれを検出する。
 */
// oxlint-disable-next-line better-tailwindcss/no-unknown-classes -- 未知クラスであることが検査対象
export const UnknownPaletteClass = () => <div className="bg-red-500" />;
