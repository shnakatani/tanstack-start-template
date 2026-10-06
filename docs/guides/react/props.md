# 部品の props の型

自前の部品の props の型を書くときの手順と、その型にしている理由を持つ。

| 決定                                                                                                               | ADR      |
| ------------------------------------------------------------------------------------------------------------------ | -------- |
| registry との乖離は生成時 baseline との 3-way で判別し、許容リスト (registry コードと `src/styles.css`) の行に限る | ADR-0020 |

## how-to

### children を宣言する

- 自前の props 型に `children: ReactNode` (必須) か `children?: ReactNode` (任意) を書く。どちらにするかは部品の意図で選ぶ
- 型は `ReactNode` にする。理由は「children を `ReactNode` で受ける理由」にある
- `ReactElement` へ狭めるのは、子を JSX 要素ちょうど 1 つに限る部品 (子を 1 つだけ受けて複製する部品など) だけにし、狭めた理由を型の近くのコメントに書く
- `PropsWithChildren` で children を足さない。`PropsWithChildren` は children を任意で足すだけで、必須にするなら結局 props 型に `children` を書く。理由は「children を明示して宣言する理由」にある
- `src/components/ui/` の registry のコードは生成された形のまま置き、この節を当てない (ADR-0020)。外部のライブラリが求める型に props を合わせるときも、その型に従う

### children 以外の名前で受ける

- JSX の子要素として描かないもの (行のデータ、行を描く関数など) は `children` で受けず、役割を表す名前の prop (`rows`、`renderRow` など) で受ける

### ラッパー部品の props を転送先から導出する

転送先へ渡す prop の型は自前で宣言し直さず、転送先の `ComponentProps<typeof 転送先>` (HTML の要素なら `ComponentProps<"a">`) から導出する。転送先の型が変わると、ラッパーの型も追随する ([React TypeScript Cheatsheet「ComponentProps」][] の Infer component props type)。自前で宣言するのは、その部品だけが持つ prop (`label`、`options`、`sanitize` など) に限る。

導出の形は、転送先の API をどこまで公開するかで選ぶ。

| 部品の形                                                                | props の型                                                                                                                                                                                        | 実例                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 転送先の API をすべて公開する薄いラッパー                               | `ComponentProps<…>` をそのまま受ける。spread から `ref` を外すことを型で示すときだけ `ComponentPropsWithoutRef<…>` にする ([React TypeScript Cheatsheet「ComponentProps」][] の React 19+ の注記) | `src/components/parts/button-link.tsx` |
| 1 つの転送先へ props を spread し、一部の prop だけを内部で握るラッパー | 握る prop を `Omit<ComponentProps<…>, "<握る prop>">` で外す。JSX では、握る prop を spread の後ろに書く                                                                                          | `src/components/action/`               |
| 複数の部品を組み合わせ、値・id・`aria-invalid` を内部で配線する部品     | 公開する prop を `Pick<ComponentProps<…>, "…">` で列挙して extends し、rest を spread しない                                                                                                      | `src/components/parts/form-fields.tsx` |

- 配線する部品で rest を spread すると、内部で握る controlled な prop (`value`、`onChange`、`id`、`aria-*`) を呼び出し側が上書きでき、`className` で Field の組み方の外から見た目を変えられる。`Omit` は外し忘れた prop と、転送先に後から足された prop も公開するので、配線する部品では公開する側を `Pick` で列挙する

## explanation

### children を `ReactNode` で受ける理由

[React docs「Using TypeScript」][] の Children は、children の型として `ReactNode` と `ReactElement` の 2 つを並べ、どちらかを推奨してはいない。同じ節は、型では特定の要素 (`<li>` だけなど) に絞れないとも書く。
`ReactElement` が実際に通すのは「JSX 要素がちょうど 1 つ」で、文字列、複数の子、`cond && <x />` を型で拒む。狭めて得られるのは「要素が 1 つ」という制約だけなので、その制約が要る部品でだけ狭め、ほかは `ReactNode` で受ける。

| 渡した children        | `ReactNode` | `ReactElement`                                 |
| ---------------------- | ----------- | ---------------------------------------------- |
| 文字列 `text`          | 通る        | 落ちる (TS2747)                                |
| 要素 2 つ `<b /><i />` | 通る        | 落ちる (TS2746)                                |
| `{cond && <b />}`      | 通る        | 落ちる (TS2322。`false \| Element` を受けない) |
| 要素 1 つ `<b />`      | 通る        | 通る                                           |
| 要素 1 つ `<li />`     | 通る        | 通る (要素の種類は絞れない)                    |

表は typescript 6.0.3 と `@types/react` 19.3.0 の `tsc` で、それぞれの形を `children: ReactNode` と `children: ReactElement` の部品に渡して測った (2026-10-02)。

### children を明示して宣言する理由

`@types/react` 19.3.0 の `PropsWithChildren<P>` は `P & { children?: ReactNode | undefined }` で、children を任意で足す。`PropsWithChildren<{ children: ReactNode }>` と書けば必須になるが (2026-10-06、typescript 6.0.3 で確かめた)、そのときは `PropsWithChildren` が足すものが無い。children を必須にするか任意にするかを props 型の中の 1 行で読めるように、どちらの場合も明示して宣言する。

[React docs「Using TypeScript」][] の Children も、[React TypeScript Cheatsheet「Typing Component Props」][] の Useful React Prop Type Examples も、`children` を props 型に明示して書く形だけを示す。`PropsWithChildren` を避けるよう書いた公式の記述は見つからなかった (2026-10-06)。

### ラッパー部品の props の導出を選んだ理由

[React TypeScript Cheatsheet「Useful Patterns by Use Case」][] の Wrapping/Mirroring a HTML Element は、要素の props をすべて受けるラッパーを `ComponentPropsWithoutRef<"button">` の extends で書く。[React TypeScript Cheatsheet「ComponentProps」][] は React 19 以降について "`ComponentProps<T>` is usually all you need — `ref` is just a regular prop for function components. Reach for `ComponentPropsWithoutRef<T>` when you specifically need to remove `ref` from a spread." とする。薄いラッパーの行はこの 2 つに従う。

一部の prop を握る部品の書き方は、公開の範囲で分けた。

| 案                                     | 評価                                                                                                                                                          | 採否                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `Omit` で握る prop を外し、rest を渡す | 転送先の API を丸ごと公開したい部品 (Action 層の Button と form) では、握る prop 以外を書き写さずに済む。外し忘れと、転送先に後から足された prop は公開される | 1 つの転送先のラッパーで採用 |
| `Pick` で公開する prop を列挙する      | 列挙しない prop は公開されない。配線する部品では、Field の組み方を迂回する経路が型に現れない                                                                  | 配線する部品で採用           |
| props を自前で宣言し直す               | 転送先の型が変わっても追随しない                                                                                                                              | 却下                         |

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。React docs と React TypeScript Cheatsheet の引用は、2026-10-06 に原文と照らした。React TypeScript Cheatsheet は、[React docs「Using TypeScript」][] の Further learning が挙げるコミュニティの資料である。

[React docs「Using TypeScript」]: https://react.dev/learn/typescript#typing-children
[React TypeScript Cheatsheet「ComponentProps」]: https://react-typescript-cheatsheet.netlify.app/docs/reference/ComponentProps
[React TypeScript Cheatsheet「Typing Component Props」]: https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/basic_type_example
[React TypeScript Cheatsheet「Useful Patterns by Use Case」]: https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/patterns_by_usecase
