# 実 router で描くテスト

テストで実 router を組んで描くときの手順 (route の wrapper の検証、テスト用の router の既定、pending 表示の時間、component の chunk の読み込み) と、その形にしている理由を持つ。

## how-to

### route の wrapper をテストする

Route hooks を使う wrapper は、root だけをテスト用に差し替えた route tree に実 `Route` を付け、`createMemoryHistory` の router で描いて、route ファイルのテストが検証する。ページ本体は props で描く。理由は「route の wrapper を実 router で描く理由」にある。

- route ファイルのテストは route ファイル名に `.test` を付ける (`index.test.tsx`)。`route.test.tsx` と名付けない。`route.tsx` はディレクトリのレイアウトルートの予約名 ([TanStack Router docs「File Naming Conventions」][] の `.route.tsx` File Type) で、そのテストと読める
- ページ本体のテストは `-components/` の部品として props で描く。wrapper の往復 (URL → props、操作 → URL、別の遷移で search が変わったときの追随、search の検証失敗を受ける error component) は route ファイルのテストが持つ。同じ経路を 2 つのテストで見ると、片方が古いまま緑になる

| 組み方                                                                                                                                                                                                                                                                                                                                                                                                                         | 守らないと                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root は `createRootRouteWithContext<{ queryClient }>()` で組んで本番と同じ context 型を持たせ ([TanStack Router docs「How to Set Up Testing with Code-Based Routing」][] の Test with Context)、component は `<Outlet />` を描き、実 `Route` を生成コードと同じ `update({ id, path, getParentRoute })` で付ける。`update` の公開型に id / path / getParentRoute が無いので (生成コードは `as any`)、交差型で注釈した変数を渡す | 生成済みの `routeTree` は browser test で描けない。`createTestRouter` (`src/test/app/create-test-router.tsx`) は component から自前の route を作るので、`validateSearch` や loader を持つ実 `Route` を付けられない                                                                                                                                                                                                                     |
| router は `createRouterWithTestDefaults` で組む (「テスト用の router の既定をそろえる」)                                                                                                                                                                                                                                                                                                                                       | テスト用の既定 (`defaultPendingMinMs: 0` など) が入らず、pending 表示の最小表示時間がテストの待ちになる                                                                                                                                                                                                                                                                                                                                |
| root に本番の root と同じ失敗の部品を持たせる。`errorComponent` は `<HeadContent />` と `FullScreenRouteError` を描く関数、`notFoundComponent` は `NotFoundContent` にする。router には本番と同じ `notFoundMode: "root"` を渡す                                                                                                                                                                                                | 部品が無いと、どの route も受けない失敗が root の外まで抜けて組み込みの `ErrorComponent` が描き、"wasn't caught by any route" の warn が出る。本番の root の errorComponent は文書の骨格の `HeadContent` で title を反映するので、テストの root でも `HeadContent` を添えないと、root が受けた失敗で title が変わらない。`notFoundMode` が無いと、ページの下の存在しない URL がページの `<Outlet />` の中で組み込みの not found になる |

browser test は DEV で走るので、search の検証に失敗すると `RouteErrorContent` が例外の文言を出す。文言は `thrownValueMessage` (`src/lib/thrown-value-message.ts`) が作り、検証の失敗では `error.message` (Standard Schema の issues の JSON) になる。テストは schema の文言が含まれることを見る。

### テスト用の router の既定をそろえる

テストで router を組むときは、`createRouter` の代わりに `createRouterWithTestDefaults` (`src/test/app/create-router-with-test-defaults.ts`) を呼ぶ (`createRouterWithTestDefaults({ routeTree, history })`)。型は `createRouter` と同じで、options もそのまま渡す。呼ぶ側が渡した options が既定に勝つ。理由は「テスト用の router の既定を factory で入れる理由」にある。

- テストのファイル (`*.test.ts(x)`、`*.test-helpers.ts(x)`、`src/test/**`) で `@tanstack/react-router` の `createRouter` と `Router` を import すると、lint (`no-restricted-imports`) が止める。別名の import と、テストのファイルからの再 export も止まる。型だけの import (`import type { Router }` と `import { type Router }`) は止めない
- 名前空間の import (`import * as Router from "@tanstack/react-router"`) は、`createRouter` を使わなくても丸ごと止まる。テストでは必要な名前を個別に import する
- 止まらない形が 2 つある。`await import("@tanstack/react-router")` から取り出した `createRouter` と、テストのファイルでないファイルが再 export した `createRouter` である (oxlint 1.87.0、2026-10-12 に確認)。テストでは dynamic import から router を組まない。アプリのコード (テストでないファイル) から `createRouter` を再 export しない
- `createTestRouter` (`src/test/app/create-test-router.tsx`) は内部で `createRouterWithTestDefaults` を呼ぶので、呼ぶ側は何もしなくてよい
- テストで既定にしたい router の options は、各テストに書かずに `createRouterWithTestDefaults` の既定に足す。各テストに書くと、足し漏れたテストだけが別の既定で走る
- 本番の設定 (`src/router.tsx`) の値を既定に写さない。片方だけ変えたときに、テストだけが古い既定で緑になる。本番と同じ設定を通したいテストは、その option を自分で渡す (`notFoundMode` など)
- 既定に置いた option の理由は、その option が扱う挙動の節に書く (`defaultPendingMinMs` は「pending 表示の時間を扱う」)

### pending 表示の時間を扱う

`createRouterWithTestDefaults` は既定に `defaultPendingMinMs: 0` を入れる。pending 表示がいったん出ると、最小表示時間 (既定 500ms) がそのままテストの待ちになる ([TanStack/router#4569][]。テストの案内に `defaultPendingMinMs` が欠けていることを上流が認めた)。`defaultPendingMs` は既定に足さず、上流の既定のまま置く。0 にすると毎回 pending を踏む。

pending 表示が route の読み込み中に出ることを検証するテストは、対象 route の `pendingMs` を下げる。表示を部品として描くだけなら、`createTestRouter` で `pendingComponent` を直接描く。ページの見出しの行を描く表示なら、3 つ目の引数に対象 route の `staticData` (`Route.options.staticData`) を渡す。渡さないと `RoutePageHeader` が throw する。

| 手順                                                | 守らないと                                                                                    |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 対象 route の `Route.options.pendingMs` を 0 にする | 既定の `pendingMs` のままだと、pending が出る前に読み込みが終わり、pending 表示を観測できない |
| `afterEach` で `pendingMs` を元の値へ戻す           | テストが同じ `Route` インスタンスを使い回すので、後続のテストまで pending を踏む              |

### component の chunk の読み込みを握る

loader を持たない route の読み込み中と読み込みの失敗を検証するテストは、対象 route の `component` を `lazyRouteComponent` で包み直し、importer の決着をテストで握る。dev と build では automatic code splitting が `component` を遅延読み込みの wrapper で包み ([TanStack Router docs「Automatic Code Splitting」][])、chunk を読み終えるまで route は pending になる。テストでは root の plugin を外すので (`docs/guides/testing/configuration.md`「テストの分岐で plugin を外す理由」) chunk に分かれず、包み直さないと読み込み中も失敗も起きない。

| 手順                                                                                                                                                                                                                           | 守らないと                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `Route.update({ component: lazyRouteComponent(async () => { await loadChunk(); return { default: component }; }) })` で包み直す。`loadChunk` は `vi.fn` にし、`deferMock` で決着を握るか、`mockRejectedValueOnce` で失敗させる | `pendingComponent` と `errorComponent` を、route の読み込みを通して観測できない          |
| `onTestFinished` で元の `component` へ戻す                                                                                                                                                                                     | テストが同じ `Route` インスタンスを使い回すので、後続のテストまで chunk の読み込みを踏む |

失敗させる importer は、`Failed to fetch dynamically imported module`、`error loading dynamically imported module`、`Importing a module script failed` のどれでも始まらない文言で reject する。これらで始まる文言は `lazyRouteComponent` がブラウザの module の取得の失敗とみなし ([`@tanstack/router-core` 1.171.34 の `isModuleNotFoundError`][])、テストを動かしているページを読み込み直そうとする ([`@tanstack/react-router` 1.170.41 の `lazyRouteComponent`][])。

失敗させた importer は、再試行で呼び直せば読み直せる。テストが確かめられるのは、再試行が chunk の読み込みをもう 1 回呼ぶところまでである。本物の dynamic import を呼び直したときに、ブラウザが chunk を取り直すかは確かめられない。

## explanation

### route の wrapper を実 router で描く理由

Route hooks を使う wrapper (`Route.useSearch` / `Route.useNavigate`) は、実 router で描いて検証する必要がある。props 直渡しのページテストでは wrapper が一度も実行されず、URL → props と操作 → URL の往復が silent に壊れる。

[TanStack Router docs「How to Test Router with File-Based Routing」][] は生成済みの `routeTree.gen.ts` を `createMemoryHistory` で描く形を示す。このテンプレートでは `__root.tsx` が `TanStackDevtools` と `<html>` を描くため、browser test でそのまま import すると "Invalid hook call" (React の二重解決) と `<html>` を `<div>` の中に描く警告で動かない (2026-09-23 に実測)。

| 案                                                                                                               | 評価                                                                 | 採否     |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------- |
| root を差し替えた route tree + `Route.update`                                                                    | 実 `Route` の `validateSearch` / loader / wrapper をそのまま動かせる | **採用** |
| 生成済み `routeTree.gen.ts` を描く ([TanStack Router docs「How to Test Router with File-Based Routing」][] の形) | `__root.tsx` の devtools と `<html>` が browser test で動かない      | 却下     |
| props 直渡しのページテストだけ                                                                                   | wrapper が一度も実行されない                                         | 却下     |
| wrapper のテストを `route.test.tsx` に置く                                                                       | `route.tsx` (レイアウトルート) のテストと読める                      | 却下     |

### テスト用の router の既定を factory で入れる理由

[TanStack Router docs「How to Set Up Testing with Code-Based Routing」][] は、テストでの router の組み立て方を 2 つ示す。

- [TanStack Router docs「How to Set Up Testing with Code-Based Routing」][] は、テストごとに `createRouter` を組む形を「TanStack Router Internal Pattern (Recommended)」として示す。挙げる理由は "The TanStack Router team uses this pattern internally" だけである
- 同じ [TanStack Router docs「How to Set Up Testing with Code-Based Routing」][] は、`src/test/router-utils.tsx` の `createTestRouter(routes: any[], initialLocation = '/')` と `renderWithRouter` に router の組み立てを集める形を「Alternative: Router Test Utilities (For Simpler Cases)」として示す。上流の `createTestRouter` は `createRouter` に `routeTree` と `history` だけを渡し、ほかの options を受ける口を持たない。`routes: any[]` を受けるので、route tree から推論される型は呼ぶ側に届かない
- [TanStack Router docs「How to Set Up Testing with Code-Based Routing」][] も [TanStack Router docs「How to Test Router with File-Based Routing」][] も、`defaultPendingMinMs` のようなテスト用の router の既定の options の扱いには触れない (2026-10-12 に確認。[TanStack/router#4569][] は 2026-10-12 に open)

案は次の 3 つの軸で比べる。

- 既定の忘れを機械で止められるか: router を組むテストが既定を受け取り損ねたときに、`vp check` (型か lint) が落ちるか
- 呼び出しの書き方と型の推論: テストごとに違う options (`context`、`InnerWrap`、`notFoundMode`) と provider の包み方 (`QueryClientProvider`) をテストが自分で書けて、route tree から推論される型が呼ぶ側に届くか
- 既定を足すとき直す場所: テスト用の既定を 1 つ足すときに、どこを直すか

| 案                                                                                                                                                                                                                                          | 既定の忘れを機械で止められるか                                                                                    | 呼び出しの書き方と型の推論                                                                        | 既定を足すとき直す場所      | 採否     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------- | -------- |
| 各テストが既定の options を自分で書く ([TanStack Router docs「How to Set Up Testing with Code-Based Routing」][] の Recommended の形)                                                                                                       | 止められない。書き忘れたテストは、型も lint も通ったまま上流の既定で走る                                          | `createRouter` をそのまま書く。推論は保たれる                                                     | router を組むすべてのテスト | 却下     |
| 既定の options の定数を、各テストが `createRouter` の options に spread する                                                                                                                                                                | 止められない。spread を忘れたテストは、型も lint も通ったまま上流の既定で走る                                     | `createRouter` に定数の展開を 1 つ足す。推論は保たれる                                            | 定数の 1 か所               | 却下     |
| `createRouter` と同じ型 (`typeof createRouter`) の factory (`createRouterWithTestDefaults`)                                                                                                                                                 | 止められる。テストのファイルでの `createRouter` の import を lint が止める。dynamic import は止まらない           | `createRouter` と同じ options を書く。推論は保たれる (下の実測)                                   | factory の 1 か所           | **採用** |
| routes と初期位置だけを受ける factory ([TanStack Router docs「How to Set Up Testing with Code-Based Routing」][] の Alternative の `createTestRouter` の形)                                                                                 | factory を通るテストには既定が必ず入る。`createRouter` を直接呼ぶテストを止めるには、採用案と同じ lint が別に要る | テストごとに違う options を渡せない。`routes: any[]` を受けるので、推論された型は呼ぶ側に届かない | factory の 1 か所           | 却下     |
| 描画までする helper ([TanStack Router docs「How to Set Up Testing with Code-Based Routing」][] の Alternative の `renderWithRouter`、[TanStack Router docs「How to Test Router with File-Based Routing」][] の `renderWithFileRoutes` の形) | factory と同じ。helper を通るテストには既定が入り、迂回を止めるには lint が別に要る                               | router の options に加えて provider の包み方も、helper の引数として運ぶ                           | helper の 1 か所            | 却下     |

- 採用案は、[TanStack Router docs「How to Set Up Testing with Code-Based Routing」][] が Recommended とする形から 1 点外れる。テストは `createRouter` を直接呼ばず、factory を呼ぶ。それでも採るのは、Recommended の形が持つ 2 つの性質 (テストが options をそのまま書けることと、route tree からの型の推論) を factory が保ったまま、既定の忘れを lint で止められるからである。定数の spread も同じ 2 つを保つが、spread の忘れを止める手段が無い
- 型の推論は実測で確かめた (2026-10-12、`@tanstack/react-router` 1.170.41)。`typeof createRouter` で注釈した factory (`createRouterWithTestDefaults`) は、`createRouter` を直接呼ぶのと同じく route tree から型を推論した。tree にあるパスの `router.routesByPath["/b"]` は通り、tree に無いパスの `router.routesByPath["/zzz"]` はどちらの呼び方でも TS7053 になった。`trailingSlash: "always"` を渡しても同じだった
- 単一の component を描くだけのテストは、route tree も options も固定で運ぶものが無いので、`createTestRouter` (`src/test/app/create-test-router.tsx`) を呼ぶ。[TanStack Router docs「How to Set Up Testing with Code-Based Routing」][] が Alternative を「For Simpler Cases」とする範囲に当たる

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。

[TanStack Router docs「File Naming Conventions」]: https://tanstack.com/router/latest/docs/routing/file-naming-conventions
[TanStack Router docs「How to Set Up Testing with Code-Based Routing」]: https://tanstack.com/router/latest/docs/how-to/setup-testing
[TanStack/router#4569]: https://github.com/TanStack/router/issues/4569
[TanStack Router docs「How to Test Router with File-Based Routing」]: https://tanstack.com/router/latest/docs/how-to/test-file-based-routing
[TanStack Router docs「Automatic Code Splitting」]: https://tanstack.com/router/latest/docs/guide/automatic-code-splitting
[`@tanstack/router-core` 1.171.34 の `isModuleNotFoundError`]: https://github.com/TanStack/router/blob/57e126e99dbd86f735ead2ba98ba5e98ef0cc668/packages/router-core/src/utils.ts#L507-L517
[`@tanstack/react-router` 1.170.41 の `lazyRouteComponent`]: https://github.com/TanStack/router/blob/57e126e99dbd86f735ead2ba98ba5e98ef0cc668/packages/react-router/src/lazyRouteComponent.tsx#L53-L70
