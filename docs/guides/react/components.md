# コンポーネントの定義

コンポーネントとその中のヘルパーを定義するときの書き方と、その形にしている理由を持つ。props の型は `docs/guides/react/props.md` が持つ。

| 決定                                                                                                               | ADR      |
| ------------------------------------------------------------------------------------------------------------------ | -------- |
| registry との乖離は生成時 baseline との 3-way で判別し、許容リスト (registry コードと `src/styles.css`) の行に限る | ADR-0020 |

## how-to

### コンポーネントを定義する

- トップレベルのコンポーネントと、コンポーネントの中の名前付きヘルパーは `function` 宣言で書く。理由は「`function` 宣言で定義する理由」にある
- 関数の型を丸ごと注釈するヘルパー (`const onOpenChange: ComponentProps<typeof Dialog>["onOpenChange"] = (open, details) => { … }`) だけは、arrow 関数の `const` にする。`function` 宣言には関数の型を注釈できない ([microsoft/TypeScript#22063][] が提案のまま open。2026-10-06 に確認)
- その場で prop や引数に渡すコールバック (`onClick={() => …}`、`items.map((item) => …)`) は arrow 関数で書く
- `src/components/ui/` の registry のコードは生成された形のまま置き、この節に合わせて書き換えない (ADR-0020)

## explanation

### `function` 宣言で定義する理由

| 理由                    | 起きること                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 宣言より前で参照できる  | `function` 宣言は巻き上げられ、宣言より前で使える ([MDN「function」][] の Hoisting)。`const` は宣言に達するまで参照できない ([MDN「let」][] の Temporal dead zone)。モジュールの評価中に参照する形 (route ファイルの `createFileRoute(…)({ component: Page })`) では、`Page` を下に `const` で書くと tsc が TS2448 で落とし、実行時は `ReferenceError` になる。`function` 宣言なら、`Route` を上に、ページの部品を下に置ける |
| `.tsx` で型引数を書ける | `.tsx` では arrow 関数の型引数 `<T>(…) =>` が JSX の開始タグとして読まれ、TS17008 で落ちる。`<T,>` と書けば通るが、`function f<T>(…)` には書き分けが要らない                                                                                                                                                                                                                                                                 |

どちらも 2026-10-06 に typescript 6.0.3 の `tsc` と Node.js 24.20.0 で確かめた。描画の中で参照するだけなら、描画はモジュールの評価の後に走るので、`const` の部品を下に置いても落ちない。

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。MDN の引用は 2026-10-06 に原文と照らした。

[MDN「function」]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function#hoisting
[MDN「let」]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let#temporal_dead_zone_tdz
[microsoft/TypeScript#22063]: https://github.com/microsoft/TypeScript/issues/22063
