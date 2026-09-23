# ADR-0043: Storybook は TanStack 専用の framework で導入し、telemetry を切る

- Status: Accepted
- Date: 2026-09-20
- 関連: ADR-0044 (story を状態のカタログにする) / ADR-0005 (ツールチェーン。明示で潰す既定の揃え方)

## Context

framework の選定は `tanstackStart()` plugin と Storybook の Vite builder の衝突 (storybookjs/storybook#33747) が決める。標準の Vite builder はこの衝突を自分で回避する必要があり、server function を呼ぶ部品の story を組めない。

## Decision

**`tanstackStart()` plugin と衝突しない TanStack 専用 framework を使い、telemetry は `core.disableTelemetry` で切る。**

router を memory-backed で自動ラップし、server function を自動 stub する。

自動構成が届かない範囲が 2 つある。

- TanStack Query は対象外。preview の構成へ手動で置く
- server-only 依存は `__mocks__` で遮断する

### telemetry を切る

telemetry は `core.disableTelemetry` で切る。既定で有効で、実行したコマンド・バージョン・addon 一覧・story とコンポーネントの件数を送る。このテンプレートから作られる全プロジェクトへ配られる設定なので、`envDir: false` や `disable_tools` (ADR-0005) と同じく明示で潰す側に揃える。

### 検討した選択肢

| 案                               | 評価                                                                                                | 採否     |
| -------------------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| 標準の Vite builder を使う       | `tanstackStart()` との衝突を自分で回避することになり、server function を呼ぶ部品の story が組めない | 却下     |
| TanStack 専用 framework を使う   | router を memory-backed で自動ラップし、server function を自動 stub する                            | **採用** |
| telemetry を既定のまま有効にする | このテンプレートから作られる全プロジェクトへ配られる設定なので、明示で潰す                          | 却下     |

## Consequences

- Storybook の静的ビルドは検証しない (storybookjs/storybook#33747 が未解決)

## 出典

- Storybook: TanStack framework — https://storybook.js.org/docs/get-started/frameworks/tanstack-react
- storybookjs/storybook#33747 (Vite builder と tanstack start plugin の衝突)
