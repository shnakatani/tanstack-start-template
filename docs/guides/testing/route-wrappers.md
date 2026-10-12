# route の wrapper のテスト

Route hooks を使う wrapper を、実 router で描いて検証する手順と、その形にしている理由を持つ。

## how-to

### route の wrapper をテストする

Route hooks を使う wrapper は、root だけをテスト用に差し替えた route tree に実 `Route` を付け、`createMemoryHistory` の router で描いて、route ファイルのテストが検証する。ページ本体は props で描く。理由は「route の wrapper を実 router で描く理由」にある。

- route ファイルのテストは route ファイル名に `.test` を付ける (`index.test.tsx`)。`route.test.tsx` と名付けない。`route.tsx` はディレクトリのレイアウトルートの予約名 ([TanStack Router docs「File Naming Conventions」][] の `.route.tsx` File Type) で、そのテストと読める
- ページ本体のテストは `-components/` の部品として props で描く。wrapper の往復 (URL → props、操作 → URL、別の遷移で search が変わったときの追随、search の検証失敗を受ける error component) は route ファイルのテストが持つ。同じ経路を 2 つのテストで見ると、片方が古いまま緑になる

| 組み方                                                                                                                                                                                                                                                                                                                                                                                                                  | 守らないと                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| root は `createRootRouteWithContext<{ queryClient }>()({ component: () => <Outlet /> })` で本番と同じ context 型を持たせ ([TanStack Router docs「How to Set Up Testing with Code-Based Routing」][] の Test with Context)、実 `Route` を生成コードと同じ `update({ id, path, getParentRoute })` で付ける。`update` の公開型に id / path / getParentRoute が無いので (生成コードは `as any`)、交差型で注釈した変数を渡す | 生成済みの `routeTree` は browser test で描けない。`createTestRouter` (`src/test/app/create-test-router.tsx`) は component から自前の route を作るので、`validateSearch` や loader を持つ実 `Route` を付けられない |
| router は `createRouter` の options の先頭で `TEST_ROUTER_DEFAULTS` (`src/test/app/test-router-defaults.ts`) を spread して組む (「pending 表示の時間を扱う」)                                                                                                                                                                                                                                                          | pending 表示の最小表示時間がテストの待ちになる。定数に既定を足したときに、そのテストだけが取り残される                                                                                                             |
| router には本番と同じ `defaultErrorComponent` (`RouteErrorContent`) を渡す                                                                                                                                                                                                                                                                                                                                              | 無いと、検証の失敗が root の外まで抜けて組み込みの `ErrorComponent` が描き、"wasn't caught by any route" の warn が出る                                                                                            |

browser test は DEV で走るので、search の検証に失敗すると `RouteErrorContent` が例外の文言を出す。文言は `thrownValueMessage` (`src/lib/thrown-value-message.ts`) が作り、検証の失敗では `error.message` (Standard Schema の issues の JSON) になる。テストは schema の文言が含まれることを見る。

### pending 表示の時間を扱う

テストで router を組むときは、`createRouter` の options の先頭で `TEST_ROUTER_DEFAULTS` (`src/test/app/test-router-defaults.ts`) を spread する (`createRouter({ ...TEST_ROUTER_DEFAULTS, routeTree, history })`)。後に書いた options が定数の値に勝つ。理由は「テスト用の router の既定を定数で持つ理由」にある。

| 定数に置く options       | 理由                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `defaultPendingMinMs: 0` | pending 表示がいったん出ると、最小表示時間 (既定 500ms) がそのままテストの待ちになる ([TanStack/router#4569][]。テストの案内に `defaultPendingMinMs` が欠けていることを上流が認めた) |

- テストで既定にしたい router の options は、各テストに書かずに定数に足す。各テストに書くと、足し漏れたテストだけが別の既定で走る
- 本番の設定 (`src/router.tsx`) の値を定数に写さない。片方だけ変えたときに、テストだけが古い既定で緑になる。本番と同じ部品を通したいテストは、その option を自分で渡す (`defaultErrorComponent` など)
- `defaultPendingMs` は定数に足さず、既定のまま置く。0 にすると毎回 pending を踏む

pending 表示が route の読み込み中に出ることを検証するテストは、対象 route の `pendingMs` を下げる。表示を部品として描くだけなら、`createTestRouter` で `pendingComponent` を直接描く。

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

### テスト用の router の既定を定数で持つ理由

テストごとに `createRouter` を組む形は、[TanStack Router docs「How to Set Up Testing with Code-Based Routing」][] が「TanStack Router Internal Pattern (Recommended)」として示す。テスト用の router の既定の options をどう共有するかは、この guide も [TanStack Router docs「How to Test Router with File-Based Routing」][] も示していない ([TanStack/router#4569][] は 2026-10-12 に open)。

| 案                                                                                                                          | 評価                                                                                                                                                                     | 採否     |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 各テストが既定の options を自分で書く                                                                                       | 公式の Recommended の形のまま。既定にしたい option が増えるたびに、全部のテストに書き足すことになる                                                                      | 却下     |
| 既定の options の定数を各テストが spread する                                                                               | テストごとに組む形と、`createRouter` が `routeTree` から型を推論することを保ったまま、既定を 1 か所で持つ。spread の忘れは型も lint も止めないので、規範とレビューで守る | **採用** |
| 描画までする helper ([TanStack Router docs「How to Test Router with File-Based Routing」][] の `renderWithFileRoutes` の形) | テストごとに route tree と options (`InnerWrap`、`defaultErrorComponent`、`context`) が違うので、`createRouter` の generics と options を素通しするだけの層になる        | 却下     |

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。

[TanStack Router docs「File Naming Conventions」]: https://tanstack.com/router/latest/docs/routing/file-naming-conventions
[TanStack Router docs「How to Set Up Testing with Code-Based Routing」]: https://tanstack.com/router/latest/docs/how-to/setup-testing
[TanStack/router#4569]: https://github.com/TanStack/router/issues/4569
[TanStack Router docs「How to Test Router with File-Based Routing」]: https://tanstack.com/router/latest/docs/how-to/test-file-based-routing
[TanStack Router docs「Automatic Code Splitting」]: https://tanstack.com/router/latest/docs/guide/automatic-code-splitting
[`@tanstack/router-core` 1.171.34 の `isModuleNotFoundError`]: https://github.com/TanStack/router/blob/57e126e99dbd86f735ead2ba98ba5e98ef0cc668/packages/router-core/src/utils.ts#L507-L517
[`@tanstack/react-router` 1.170.41 の `lazyRouteComponent`]: https://github.com/TanStack/router/blob/57e126e99dbd86f735ead2ba98ba5e98ef0cc668/packages/react-router/src/lazyRouteComponent.tsx#L53-L70
