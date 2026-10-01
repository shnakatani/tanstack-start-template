# 部品の props の型

自前の部品の props の型を書くときの手順と、その型にしている理由を持つ。

## how-to

### children を宣言する

- 自前の props 型に `children: ReactNode` (必須) か `children?: ReactNode` (任意) を書く。どちらにするかは部品の意図で選ぶ
- 型は `ReactNode` にする。理由は「children を `ReactNode` で受ける理由」にある
- `ReactElement` へ狭めるのは、子を JSX 要素ちょうど 1 つに限る部品 (子を 1 つだけ受けて複製する部品など) だけにし、狭めた理由を型の近くのコメントに書く

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

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。

[React docs「Using TypeScript」]: https://react.dev/learn/typescript#typing-children
