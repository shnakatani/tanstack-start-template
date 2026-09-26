# route の wrapper のテスト

Route hooks を使う wrapper を、実 router で描いて検証する手順と、その形にしている理由を持つ。

## how-to

### route の wrapper をテストする

Route hooks を使う wrapper は、root だけをテスト用に差し替えた route tree に実 `Route` を付け、`createMemoryHistory` の router で描いて、route ファイルのテストが検証する。ページ本体は props で描く。理由は「route の wrapper を実 router で描く理由」にある。実例は `src/routes/notes/index.test.tsx` と `src/routes/notes/-components/notes-page.test.tsx`。

- route ファイルのテストは route ファイル名に `.test` を付ける (`index.test.tsx`)。`route.test.tsx` と名付けない。`route.tsx` はディレクトリのレイアウトルートの予約名 (Router の file-naming-conventions) で、そのテストと読める
- ページ本体のテストは `-components/` の部品として props で描く。wrapper の往復 (URL → props、操作 → URL、別の遷移で search が変わったときの追随、search の検証失敗を受ける error component) は route ファイルのテストが持つ。同じ経路を 2 つのテストで見ると、片方が古いまま緑になる

| 組み方                                                                                                                                                                                                                                                                                                                 | 守らないと                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| root は `createRootRouteWithContext<{ queryClient }>()({ component: () => <Outlet /> })` で本番と同じ context 型を持たせ、実 `Route` を生成コードと同じ `update({ id, path, getParentRoute })` で付ける。`update` の公開型に id / path / getParentRoute が無いので (生成コードは `as any`)、交差型で注釈した変数を渡す | 生成済みの `routeTree` は browser test で描けない。`createTestRouter` (`src/test/app/create-test-router.tsx`) は component から自前の route を作るので、`validateSearch` や loader を持つ実 `Route` を付けられない |
| router には本番と同じ `defaultErrorComponent` (`RouteErrorContent`) を渡す                                                                                                                                                                                                                                             | 無いと、検証の失敗が root の外まで抜けて組み込みの `ErrorComponent` が描き、"wasn't caught by any route" の warn が出る                                                                                            |

browser test は DEV で走るので、search の検証に失敗すると `RouteErrorContent` が `error.message` (Standard Schema の issues の JSON) をそのまま出す。テストは schema の文言が含まれることを見る。

### pending 表示の時間を扱う

テスト用の router には `defaultPendingMinMs: 0` を渡す。pending 表示がいったん出ると、最小表示時間 (既定 500ms) がそのままテストの待ちになる。`defaultPendingMs` は既定のまま置く。0 にすると毎回 pending を踏む。

pending 表示が route の読み込み中に出ることを検証するテストは、対象 route の `pendingMs` を下げる。表示を部品として描くだけなら、`createTestRouter` で `pendingComponent` を直接描く (`src/routes/notes/index.test.tsx` の pending のテスト)。

| 手順                                                | 守らないと                                                                                    |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 対象 route の `Route.options.pendingMs` を 0 にする | 既定の `pendingMs` のままだと、pending が出る前に読み込みが終わり、pending 表示を観測できない |
| `afterEach` で `pendingMs` を元の値へ戻す           | テストが同じ `Route` インスタンスを使い回すので、後続のテストまで pending を踏む              |

## explanation

### route の wrapper を実 router で描く理由

Route hooks を使う wrapper (`Route.useSearch` / `Route.useNavigate`) は、実 router で描いて検証する必要がある。props 直渡しのページテストでは wrapper が一度も実行されず、URL → props と操作 → URL の往復が silent に壊れる。

Router の how-to「How to Test Router with File-Based Routing」は生成済みの `routeTree.gen.ts` を `createMemoryHistory` で描く形を示す。このテンプレートでは `__root.tsx` が `TanStackDevtools` と `<html>` を描くため、browser test でそのまま import すると "Invalid hook call" (React の二重解決) と `<html>` を `<div>` の中に描く警告で動かない (2026-09-23 に実測)。

| 案                                               | 評価                                                                 | 採否     |
| ------------------------------------------------ | -------------------------------------------------------------------- | -------- |
| root を差し替えた route tree + `Route.update`    | 実 `Route` の `validateSearch` / loader / wrapper をそのまま動かせる | **採用** |
| 生成済み `routeTree.gen.ts` を描く (how-to の形) | `__root.tsx` の devtools と `<html>` が browser test で動かない      | 却下     |
| props 直渡しのページテストだけ                   | wrapper が一度も実行されない                                         | 却下     |
| wrapper のテストを `route.test.tsx` に置く       | `route.tsx` (レイアウトルート) のテストと読める                      | 却下     |

- 出典: TanStack Router の how-to「How to Test Router with File-Based Routing」(https://tanstack.com/router/latest/docs/framework/react/how-to/test-file-based-routing)、「How to Set Up Testing with Code-Based Routing」(https://tanstack.com/router/latest/docs/framework/react/how-to/setup-testing)、file-naming-conventions (https://tanstack.com/router/latest/docs/framework/react/routing/file-naming-conventions)、テストの案内に `defaultPendingMinMs` が欠けていることを上流が認めた issue (https://github.com/TanStack/router/issues/4569)
