/**
 * `src/styles.css` のトークンから WCAG のコントラスト比を計算する。
 *
 * 比を計算する手段がリポジトリに無いと、ADR に書いた値を誰も追試できず、トークンを
 * 動かしたあとの再測もできない (ADR-0028)。
 *
 * ここは検査ではない。合否は `src/components/contrast.stories.tsx` の axe が持つ
 * (ADR-0024 の節 5)。
 */

import Color from "colorjs.io";

const THEME_SELECTOR = { light: ":root", dark: ".dark" } as const;

export type Theme = keyof typeof THEME_SELECTOR;

/**
 * トークン名から宣言された値を引く表。
 *
 * 色でない宣言 (`--radius`) も入る。`:root` の宣言をそのまま読むためで、色に絞る判定は
 * 値を解決する側が持つ。
 */
type TokenTable = Readonly<Record<string, string>>;

/**
 * `:root` と `.dark` をトークンの表にする。
 *
 * `.dark` は `:root` に重ねる。dark で再宣言しないトークンは light の値のまま効くので、
 * 重ねないと「dark に無い」と「dark で light と同値」を区別できない。
 */
export function parseTokenTable(css: string): Readonly<Record<Theme, TokenTable>> {
  const light = parseBlock(css, THEME_SELECTOR.light);
  return { light, dark: { ...light, ...parseBlock(css, THEME_SELECTOR.dark) } };
}

function parseBlock(css: string, selector: string): TokenTable {
  // コメントを先に落とす。コメントの中に宣言の例を書くことがある
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  // セレクタを行頭に固定する。固定しないと `@media` が `:root` を外から包む形で、
  // 条件付きの値が無条件のトークンとして表へ入る。
  //
  // 行頭で足りるのは、入れ子を必ず字下げするフォーマッタを commit 前に通すからである
  // (AGENTS.md「コミット前に `vp check --fix` 必須」)。字下げなしの入れ子は
  // `vp check` が Formatting issues として弾く。フォーマッタを外すとこの前提が消える
  const found = new RegExp(`^${escapeForRegExp(selector)}\\s*\\{([\\s\\S]*?)\\n\\}`, "m").exec(
    source,
  );
  const body = found?.[1];
  if (body === undefined) {
    // セレクタが在るのに当たらない形と、本当に無い形を区別する。区別しないと
    // 調べ始める場所を誤らせる
    throw new Error(
      source.includes(selector)
        ? `行頭のセレクタとして見つからない (字下げされているか、閉じ括弧が行頭にない): ${selector}`
        : `セレクタが見つからない: ${selector}`,
    );
  }
  if (body.includes("{")) {
    // 入れ子のブロック (`@media` など) があると、条件付きの値が無条件のトークンとして
    // 混ざる。閉じ括弧が行頭に無い CSS でも、次のブロックまで飲み込んで同じ形になる。
    // どちらも例外にならず静かに誤った比を返すので、ここで止める
    throw new Error(`宣言だけのブロックではない (入れ子か、閉じ括弧が行頭にない): ${selector}`);
  }
  const table: Record<string, string> = {};
  // 宣言は複数行にまたがる (`--destructive-surface`)。改行を潰してから ; で割る
  for (const declaration of body.replace(/\s+/g, " ").split(";")) {
    const parsed = /^\s*(--[a-z0-9-]+)\s*:\s*(.+)/i.exec(declaration);
    const [, name, value] = parsed ?? [];
    if (name !== undefined && value !== undefined) {
      table[name] = value.trim();
    }
  }
  return table;
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type Rgb = readonly [number, number, number];

/** sRGB の 0..1 の成分と alpha。整数へ丸めない */
type Srgb = { readonly rgb: Rgb; readonly alpha: number };

/**
 * CSS の色を sRGB へ解決する。
 *
 * `toGamut` の形は axe-core 4.13.0 の `Color.parseString` に合わせている。合わせないと、
 * sRGB の外にある oklch で負の成分が残り、axe と別の比が出る (dequelabs/axe-core#4908)。
 *
 * ここでは丸めない。面を重ねる前に丸めると層ごとに誤差が乗る。8bit へ落とすのは重ね終わった
 * あとの 1 回だけで、`measurePair` の `toDisplayed` が持つ
 */
export function resolveSrgb(value: string): Srgb {
  const color = new Color(value).toGamut({ space: "srgb", method: "clip" }).to("srgb");
  const { r, g, b } = color;
  const alpha = readAlpha(color);
  if (r === null || g === null || b === null || alpha === null) {
    // CSS Color 4 の欠けた成分。oklch や lab から sRGB へ変換する経路では 0 に解決されて
    // ここへ来ない (`oklch(0.5 none 180)` は灰色になる。2026-09-22 実測)。残るのは sRGB の
    // まま渡された `rgb(none 0 0)` と、空間変換が触らない alpha の `/ none` である
    //
    // 仕様は欠けた成分を 0 として扱えと定める (CSS Color 4 の Missing color components)。
    // ここで止めるのは、`src/styles.css` にこの綴りが 1 つも無く、現れたときは書き損じか
    // 上流の変更だからである
    throw new Error(`none を含む色はコントラストを計算できない: ${value}`);
  }
  // `toGamut` は oklch 空間で clip するため、sRGB へ戻すと成分が -1e-17 のように範囲の外へ
  // わずかに出る。相対輝度の式は成分が [0, 1] にあることを前提にするので、ここで収める。
  // oklch を 2496 色掃いた最大のはみ出しは 4.3e-14 で、比には現れない (2026-09-22 に
  // colorjs.io 0.7.1 で実測)
  //
  // axe-core も輝度の前に clamp しない (`axe.js:18341` の `getRelativeLuminance` は `this.r`
  // を読む)。8bit へ丸めた `_red` を読むのは半透明を合成する経路だけで、そこでは表示ではなく
  // 算術に使われる (`axe.js:24779` の `_flattenColors`)
  return { rgb: [clampChannel(r), clampChannel(g), clampChannel(b)], alpha };
}

function clampChannel(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * colorjs.io 0.7.1 の型 (`Color#alpha`) は `number` で null を許さないが、alpha に `none`
 * を渡すと実際には null が返る (`rgb(0 0 0 / none)` で 2026-09-22 に実測)。関数境界で型を
 * 実態に合わせ直し、`typescript/no-unnecessary-condition` が本物の分岐を「到達しない」と
 * 誤判定しないようにする
 *
 * 同じ型定義の `PlainColorObject` (`color.d.ts:63`) は `alpha: number | null` と宣言して
 * おり、ここでの拡大はその側の宣言と揃える操作でもある。
 *
 * ただし `Color` クラス (`color.d.ts:151` の `implements PlainColorObject`) が `alpha` を
 * `number` へ狭めること自体は TypeScript が許す形なので、上流の誤りとは断定しない。
 *
 * 上流へは未報告。2026-09-22 に `gh search issues --repo color-js/color.js` を
 * `alpha null` / `alpha types` / `PlainColorObject` の 3 クエリで引いて該当 0 件だった
 */
function readAlpha(color: Color): number | null {
  return color.alpha;
}

/**
 * いちばん下の面の上へ、上の面を下から順に重ねて 1 色にする。
 *
 * いちばん下は alpha の欄を持たない `Rgb` で受ける。ただしこれは「不透明である」ことまでは
 * 表さない。`resolveSrgb("#00000080").rgb` と書けば型検査は通り、alpha が黙って落ちる
 * (2026-09-22 実測)。
 *
 * 不透明の保証を持つのは呼び出し元 `measurePair` の guard である。そこへ置いたのは、
 * トークン名と解決後の alpha を同時に持つのが `measurePair` だからで、`layerOf` は `Srgb`
 * を返す時点でトークン名を落とす
 */
function flattenLayers(bottom: Rgb, layers: readonly Srgb[]): Rgb {
  return layers.reduce<Rgb>(
    (under, layer) => [
      layer.rgb[0] * layer.alpha + under[0] * (1 - layer.alpha),
      layer.rgb[1] * layer.alpha + under[1] * (1 - layer.alpha),
      layer.rgb[2] * layer.alpha + under[2] * (1 - layer.alpha),
    ],
    bottom,
  );
}

/**
 * WCAG 2.2 の relative luminance (https://www.w3.org/TR/WCAG22/#dfn-relative-luminance)。
 *
 * 閾値は 0.04045 である。2021-05 より前の版は 0.03928 で、同 URL の Note 2 が差し替えを
 * 説明している。axe-core 4.13.0 も 0.04045 を使う (`axe.js` の `getRelativeLuminance`)。
 * 揃えないと、成分が 2 つの値の間に入る色だけ axe と違う比が出る
 */
export function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb;
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function toLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/**
 * WCAG 2.2 の contrast ratio。出た比は丸めない。
 *
 * 丸めるなと書いているのは Understanding SC 1.4.3 の地の文で、対象は比であって色ではない
 * (「4.499:1 would not meet the 4.5:1 threshold」)。色のほうは本体の定義が 8bit を要求する
 * ので、`measurePair` が `toDisplayed` を通してから渡す
 */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  return (Math.max(lumA, lumB) + 0.05) / (Math.min(lumA, lumB) + 0.05);
}

/**
 * 画面に出る 8bit の色へ落とす。
 *
 * WCAG 2.2 の relative luminance は `RsRGB = R8bit/255` と定義しており、輝度の式へ入れる色は
 * 8bit で表されたものである。丸めずに測ると定義から外れる。
 *
 * 丸めるのは重ね終わった後の 1 回だけにする。ブラウザは面を float で重ねてから 1 回
 * ラスタライズするので、画面に出るのはその 1 回ぶんの色である。axe は `Color` が内部で
 * 8bit を持つため層ごとに丸まるが、これは実装の都合で、定義が要求する形ではない
 */
function toDisplayed(rgb: Rgb): Rgb {
  return [round8(rgb[0]), round8(rgb[1]), round8(rgb[2])];
}

function round8(channel: number): number {
  return Math.round(channel * 255) / 255;
}

/** 8bit へ落とした色を `#rrggbb` にする。`toDisplayed` を通した値を渡す */
export function toHex(rgb: Rgb): string {
  return `#${rgb
    .map((channel) =>
      Math.round(channel * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** 面 1 枚。`alpha` は 0..1 */
export type LayerSpec = { readonly token: string; readonly alpha: number };

/**
 * `--input/30` の形を読む。`/30` は Tailwind の `bg-input/30` に合わせた百分率。
 *
 * 受理する綴りを正規表現で明示する。`Number` に任せると `""` と `" 0"` が 0 になり、
 * `1e2` と `0x10` も通る。書き損じが alpha 0 として通ると、比 1 が「コントラストが無い」
 * として静かに報告される (2026-09-22 実測)。読み方が 1 つに定まる綴りだけを通す
 */
export function parseLayerSpec(spec: string): LayerSpec {
  const parts = spec.split("/");
  const [token, percent] = parts;
  if (token === undefined || !token.startsWith("--")) {
    throw new Error(`トークン名は -- で始める: ${spec}`);
  }
  if (parts.length > 2) {
    throw new Error(`不透明度の指定は 1 つだけ書く: ${spec}`);
  }
  if (percent === undefined) {
    return { token, alpha: 1 };
  }
  // `-` と指数表記と 16 進はここで落ちる。`00` と `0.0` は読み方が 1 つなので通す
  if (!/^\d+(\.\d+)?$/.test(percent)) {
    // 範囲ではなく綴りが原因。`--input/.5` に「0..100 で書く」と返すと、書いた人には
    // 0.5 が範囲内に見えて原因へ辿り着けない
    throw new Error(`不透明度は十進数で書く (符号・指数表記・空白は使えない): ${spec}`);
  }
  const value = Number(percent);
  if (value > 100) {
    throw new Error(`不透明度は 0..100 で書く: ${spec}`);
  }
  return { token, alpha: value / 100 };
}

/**
 * 測った 1 対。
 *
 * `backdrop` は下地を畳んだ後の色、`foreground` は下地の上へ載せた後の色で、どちらも
 * 画面に出る 8bit へ落としてある (`toDisplayed`)。
 * 半透明の前景は下地と混ざった色になるので、出力へ載せるときは「画面に出る色」として
 * 読ませる。下地が不透明 1 枚のときの `backdrop` は、その宣言を sRGB へ解決した値そのもの
 * であって、合成は挟まらない
 */
export type MeasuredPair = {
  readonly backdrop: Rgb;
  readonly foreground: Rgb;
  readonly ratio: number;
};

/**
 * 下地を下から順に重ね、その上へ前景を載せて比を出す。
 *
 * 前景も下地へ合成する。半透明の文字色 (`text-foreground/60`) は下地と混ざった色で
 * 読まれるので、生の値で比を取ると画面に存在しない比が出る
 */
export function measurePair(args: {
  table: TokenTable;
  backdrop: readonly LayerSpec[];
  foreground: LayerSpec;
}): MeasuredPair {
  const [bottomSpec, ...restSpecs] = args.backdrop;
  if (bottomSpec === undefined) {
    throw new Error("下地が 1 枚も渡されていない");
  }
  const bottom = layerOf(args.table, bottomSpec);
  if (bottom.alpha !== 1) {
    // ここでしかトークン名を知らない。`flattenLayers` へ持ち込むと、呼び出し側の語彙を
    // 持たない関数がトークン名を抱えることになる
    throw new Error(`いちばん下の下地は不透明でなければならない: ${bottomSpec.token}`);
  }
  const blended = flattenLayers(
    bottom.rgb,
    restSpecs.map((spec) => layerOf(args.table, spec)),
  );
  const backdrop = toDisplayed(blended);
  const foreground = toDisplayed(flattenLayers(blended, [layerOf(args.table, args.foreground)]));
  return { backdrop, foreground, ratio: contrastRatio(foreground, backdrop) };
}

/**
 * 表からトークンを引いて 1 枚の面にする。
 *
 * alpha は宣言側と指定側の積を取る。`--border` のようにトークン自身が alpha を持つ場合、
 * `--border/50` は「宣言の alpha のさらに半分」になる
 */
function layerOf(table: TokenTable, spec: LayerSpec): Srgb {
  const declared = table[spec.token];
  if (declared === undefined) {
    throw new Error(`宣言されていないトークン: ${spec.token}`);
  }
  let resolved: Srgb;
  try {
    resolved = resolveSrgb(declared);
  } catch (cause) {
    // 色でない宣言 (`--radius`) が表に入る。colorjs.io の素のメッセージは値しか
    // 持たないので、どのトークンかをここで足す (`TokenTable` の docstring の契約)
    throw new Error(`トークン ${spec.token} の値を色として解決できない: ${declared}`, { cause });
  }
  return { rgb: resolved.rgb, alpha: resolved.alpha * spec.alpha };
}
