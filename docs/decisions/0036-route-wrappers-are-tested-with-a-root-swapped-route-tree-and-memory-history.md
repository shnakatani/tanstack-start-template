# ADR-0036: Route hooks を使う wrapper は root を差し替えた route tree と memory history で検証する

- Status: Accepted
- Date: 2026-09-23
- 関連: ADR-0012 (ページ本体は `-components/`、route の property は export しない)、ADR-0033 (検証対象の route)、ADR-0035 (debounce のテスト)、ADR-0013 (待機は retry API に委ねる)

## Context

`.claude/rules/directory-structure.md`「ルートファイル」は「Route hooks を使う wrapper は実 router で描いて検証する」を規範として持っていたが、実例が無かった。props 直渡しのページテストでは wrapper (`Route.useSearch` / `Route.useNavigate`) が一度も実行されず、URL → props と操作 → URL の往復が silent に壊れる。

Router の how-to「How to Test Router with File-Based Routing」は生成済みの `routeTree.gen.ts` を `createMemoryHistory` で描く形を示す。この repo では `__root.tsx` が `TanStackDevtools` と `<html>` を描くため、browser test でそのまま import すると "Invalid hook call" (React の二重解決) と `<html>` を `<div>` の中に描く警告で動かない (2026-09-23 に実測)。

## Decision

**root だけをテスト用に差し替えた route tree に実 `Route` を付け、`createMemoryHistory` の router で描く。ページ本体は props で描き、wrapper の往復は route ファイルのテストが持つ。**

| 規範                                                                                                                                                                                                                                                                                                              | 守らないと何が壊れるか                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root は `createRootRouteWithContext<{ queryClient }>()({ component: () => <Outlet /> })` で本番と同じ context 型を持ち、`Route` を生成コードと同じ `update({ id, path, getParentRoute })` で付ける。`update` の公開型に id / path / getParentRoute が無いので (生成コードは `as any`)、交差型で注釈した変数を渡す | 生成済み `routeTree` は browser test で描けない。`createTestRouter` (`src/test/create-test-router.tsx`) は component から自前の route を作るので、`validateSearch` や loader を持つ実 `Route` を付けられない     |
| router には本番と同じ `defaultErrorComponent` (`RouteErrorContent`) を渡す                                                                                                                                                                                                                                        | 無いと検証失敗が root の外まで抜けて組み込みの `ErrorComponent` が描き、"wasn't caught by any route" の warn が出る                                                                                              |
| route ファイルのテストは route ファイル名に `.test` を付ける (`index.test.tsx`)。`route.test.tsx` と名付けない                                                                                                                                                                                                    | `route.tsx` はディレクトリのレイアウトルートの予約名 (Router の file-naming-conventions)。そのテストと読める                                                                                                     |
| ページ本体のテストは `-components/` の部品として props で描く。wrapper の往復 (URL → 入力欄、Enter → URL、別の遷移で `q` が変わったときの追随、空白だけの確定、上限超えの切り詰め、文字列以外の error component、フォーカスの維持、通知) は route ファイルのテストが持つ                                          | 同じ経路を 2 つのテストで見ると、片方が古いまま緑になる                                                                                                                                                          |
| debounce のテストは 1 文字ずつ別の `userEvent.keyboard` で打つ。実時間の待ち (`NOTE_SEARCH_DEBOUNCE_MS`) は `vi.mock(import(...))` の partial mock で広げる                                                                                                                                                       | `fill` は 1 回の input、`type("abc")` は 3 文字を間を置かず送るので、どちらも debounce の欠落を検出しない (2026-09-23 に mutant で実測)。実値だと `mise run verify` の負荷で打鍵の間隔に負け、途中の取得が混ざる |
| landmark は `<search>` 要素で組み、部品のテストは要素名で見る                                                                                                                                                                                                                                                     | 同梱の `@vitest/browser` の locator engine が `search` role を `<search>` に写さない (2026-09-23 に実測)。本番のマークアップをテスト側の欠落に合わせない                                                         |

## Consequences

- `src/routes/notes/index.test.tsx` が route の定義と wrapper の往復を、`src/routes/notes/-components/notes-page.test.tsx` がページの描画を持つ。検索欄の locator は `note-search-field.test-helpers.ts` の 1 箇所
- browser test は DEV で走るので、search の検証失敗は `RouteErrorContent` が `error.message` (Standard Schema の issues の JSON) をそのまま出す。テストは schema の文言が含まれることを見る
- 同じ画面で `q` が別の値へ変わる経路 (Link、他画面からの戻る) は `router.navigate` で作る。確定は replace なので (ADR-0033)、memory history の `back()` では前の `q` に戻れない
- fake timers は使わない。vitest の browser mode では locator の操作が fake timer を進めない (vitest-dev/vitest#10058 open。修正 PR #11242 も open)

### 再評価の条件

- `__root.tsx` が browser test で描けるようになったら、生成済み `routeTree` で描く形 (how-to の形) に戻す
- `@vitest/browser` の locator engine が `search` role を `<search>` に写すようになったら、部品のテストを `getByRole("search")` に戻す
- vitest が browser の操作で fake timer を進めるようになったら、debounce の待ちの拡大を fake timers に置き換えられるか測り直す

## 検討した選択肢

| 案                                                         | 評価                                                                           | 採否     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------ | -------- |
| root を差し替えた route tree + `Route.update`              | 実 `Route` の `validateSearch` / loader / wrapper をそのまま動かせる           | **採用** |
| 生成済み `routeTree.gen.ts` を描く (how-to の形)           | `__root.tsx` の devtools と `<html>` が browser test で動かない                | 却下     |
| props 直渡しのページテストだけ                             | wrapper が一度も実行されない                                                   | 却下     |
| `<form role="search">` にして `getByRole("search")` で引く | locator engine の欠落を本番のマークアップで吸収し、lint 抑制と再評価条件を積む | 却下     |
| wrapper のテストを `route.test.tsx` に置く                 | `route.tsx` (レイアウトルート) のテストと読める                                | 却下     |

## 出典

- TanStack Router の how-to「How to Test Router with File-Based Routing」: <https://tanstack.com/router/latest/docs/framework/react/how-to/test-file-based-routing>
- TanStack Router の how-to「How to Set Up Testing with Code-Based Routing」: <https://tanstack.com/router/latest/docs/framework/react/how-to/setup-testing>
- TanStack Router の file-naming-conventions (`route.tsx`): <https://tanstack.com/router/latest/docs/framework/react/routing/file-naming-conventions>
- vitest-dev/vitest#10058 (browser mode の操作が fake timer を進めない) / PR #11242: <https://github.com/vitest-dev/vitest/issues/10058> / <https://github.com/vitest-dev/vitest/pull/11242>
