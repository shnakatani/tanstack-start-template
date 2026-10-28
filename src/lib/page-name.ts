// augmentation だけのファイルを module にする。import も export も無いと、下の declare module が
// augmentation でなく ambient の宣言になり、@tanstack/react-router の型を置き換える
export {};

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /**
     * ページの名前。`<title>` と、ページの見出しの行の h1 (`RoutePageHeader`) になる。
     * ページの route (自分の component が `RoutePageHeader` で h1 を描く route) と、ページの上に重ねるダイアログの
     * route に、title を組む `head` と 1 組で書く (`pageRouteOptions`、`dialogRouteOptions`)。
     * 名前の付いたページの route の子に、ダイアログでない名前の付いたページの route を置かない (h1 が 2 つ並ぶ)。
     * 省略できる key にする。必須にすると root とテストの route まで `staticData` を課す (ADR-0035)
     */
    pageName?: string;
  }
}
