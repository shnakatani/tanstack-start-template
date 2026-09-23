# ADR-0044: Route hooks を使う wrapper は、root を差し替えた route tree に実 Route を付け、memory history の router で route ファイルのテストが検証する

- Status: Accepted
- Date: 2026-09-23
- 関連: ADR-0012 (ページ本体は `-components/`、route の property は export しない)、ADR-0038 (待機は retry API に委ねる)

## Context

Route hooks を使う wrapper は、実 router で描いて検証する必要がある。props 直渡しのページテストでは wrapper (`Route.useSearch` / `Route.useNavigate`) が一度も実行されず、URL → props と操作 → URL の往復が silent に壊れる。

Router の how-to「How to Test Router with File-Based Routing」は生成済みの `routeTree.gen.ts` を `createMemoryHistory` で描く形を示す。このテンプレートでは `__root.tsx` が `TanStackDevtools` と `<html>` を描くため、browser test でそのまま import すると "Invalid hook call" (React の二重解決) と `<html>` を `<div>` の中に描く警告で動かない (2026-09-23 に実測)。

## Decision

**Route hooks を使う wrapper は、root だけをテスト用に差し替えた route tree に実 `Route` を付け、`createMemoryHistory` の router で描いて、route ファイルのテストが検証する。ページ本体は props で描き、wrapper の往復は route ファイルのテストが持つ。**

| 規範                                                                                                                                                                                                                                                                                                              | 守らないと何が壊れるか                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| root は `createRootRouteWithContext<{ queryClient }>()({ component: () => <Outlet /> })` で本番と同じ context 型を持ち、`Route` を生成コードと同じ `update({ id, path, getParentRoute })` で付ける。`update` の公開型に id / path / getParentRoute が無いので (生成コードは `as any`)、交差型で注釈した変数を渡す | 生成済み `routeTree` は browser test で描けない。`createTestRouter` (`src/test/create-test-router.tsx`) は component から自前の route を作るので、`validateSearch` や loader を持つ実 `Route` を付けられない |
| router には本番と同じ `defaultErrorComponent` (`RouteErrorContent`) を渡す                                                                                                                                                                                                                                        | 無いと検証失敗が root の外まで抜けて組み込みの `ErrorComponent` が描き、"wasn't caught by any route" の warn が出る                                                                                          |
| route ファイルのテストは route ファイル名に `.test` を付ける (`index.test.tsx`)。`route.test.tsx` と名付けない                                                                                                                                                                                                    | `route.tsx` はディレクトリのレイアウトルートの予約名 (Router の file-naming-conventions)。そのテストと読める                                                                                                 |
| ページ本体のテストは `-components/` の部品として props で描く。wrapper の往復 (URL → props、操作 → URL、別の遷移で search が変わったときの追随、search の検証失敗を受ける error component) は route ファイルのテストが持つ                                                                                        | 同じ経路を 2 つのテストで見ると、片方が古いまま緑になる                                                                                                                                                      |

## Consequences

- route ごとに、route ファイルのテストが route の定義と wrapper の往復を、`-components/` のテストがページの描画を持つ。実例は `src/routes/notes/index.test.tsx` と `src/routes/notes/-components/notes-page.test.tsx`
- browser test は DEV で走るので、search の検証失敗は `RouteErrorContent` が `error.message` (Standard Schema の issues の JSON) をそのまま出す。テストは schema の文言が含まれることを見る

### 再評価の条件

- `__root.tsx` が browser test で描けるようになったら、生成済み `routeTree` で描く形 (how-to の形) に戻す

## 検討した選択肢

| 案                                               | 評価                                                                 | 採否     |
| ------------------------------------------------ | -------------------------------------------------------------------- | -------- |
| root を差し替えた route tree + `Route.update`    | 実 `Route` の `validateSearch` / loader / wrapper をそのまま動かせる | **採用** |
| 生成済み `routeTree.gen.ts` を描く (how-to の形) | `__root.tsx` の devtools と `<html>` が browser test で動かない      | 却下     |
| props 直渡しのページテストだけ                   | wrapper が一度も実行されない                                         | 却下     |
| wrapper のテストを `route.test.tsx` に置く       | `route.tsx` (レイアウトルート) のテストと読める                      | 却下     |

## 出典

- TanStack Router の how-to「How to Test Router with File-Based Routing」: <https://tanstack.com/router/latest/docs/framework/react/how-to/test-file-based-routing>
- TanStack Router の how-to「How to Set Up Testing with Code-Based Routing」: <https://tanstack.com/router/latest/docs/framework/react/how-to/setup-testing>
- TanStack Router の file-naming-conventions (`route.tsx`): <https://tanstack.com/router/latest/docs/framework/react/routing/file-naming-conventions>
