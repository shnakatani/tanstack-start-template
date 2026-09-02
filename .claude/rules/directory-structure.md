---
paths:
  - "src/**"
---

# ディレクトリ構成方針

## コンポーネント配置

| 配置先                       | 内容                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| `src/components/ui/`         | shadcn 生成コンポーネント (`vp dlx shadcn@latest add` の出力先)                     |
| `src/components/`            | 複数画面で共有する自作コンポーネント                                                |
| `routes/<path>/-components/` | 単一画面専用コンポーネント。`-` prefix は TanStack Router が routeTree から除外する |

- `-components/` 内部の import は相対パスで書く
- route ファイルの rename / 移動時、`createFileRoute` のパス文字列は plugin が自動更新する。手で書き換えない
- 公式の詳細は TanStack の intent skill (`@tanstack/router-plugin` / `@tanstack/router-core`) を load して確認する

## hooks と lib と server の境界

| 配置先        | 内容                                                              |
| ------------- | ----------------------------------------------------------------- |
| `src/hooks/`  | React 依存のカスタム hook (`use-*`) と、React 依存の context 定義 |
| `src/lib/`    | React に依存しない純粋ロジック・スキーマ・型                      |
| `src/server/` | server 専用モジュール (DB アクセス、server function の実装)       |

- React の hook を `src/lib/` に置かない
- DB ドライバのような native binding を持つ依存は `src/server/` の外から import しない。client bundle に混ざるとビルドが壊れる (遮断は `vite.config.ts` の `tanstackStart` の `importProtection`)

## テストとスクリプトの配置

`scripts/` 配下の分け方と実行 project は `testing.md`「テストの種別と置き場所」が持つ。

## shadcn コンポーネント導入時のチェック

`src/components/ui/` を新規追加・改変したら、最初のコミット前に:

1. `vp check --fix` を通す。registry コードも他と同じ検査を受ける。上流の形を保つ必要がある違反だけ行単位で抑制し、ADR-0006 の許容リストへ記録する
2. インタラクティブなコンポーネントは registry 素寸法のまま使う (`button.tsx` 参照、ADR-0007)。`min-h-11` 等の 44px 焼き込みや独自の hit 拡大を足さない
   - **input を包むラッパーを足さない**。疑似要素が input を覆い、本体がポインタを受け取れなくなる (ADR-0007)
3. 生成時 baseline を `docs/registry-baseline/<name>.tsx` に取得する (新規追加時と `--overwrite` 再生成時の両方)。手順は ADR-0006「検査手順」
4. baseline との diff が許容リスト (ADR-0006) と 1:1 であることを確認してからコミットする。乖離の理由は ADR-0006 が持つ。コード側の理由コメントは、ADR の記述だけでは実装者が誤る場合 (打ち消し不能な落とし穴など) に限る。素のまま使っていることの説明は書かない (ADR に載っていなければ上流のものと判別できる)
   - 例外は `oxlint-disable` directive の `--` 説明。ADR と重複しても、「なぜそのルールを抑制してよいのか」をその行に書く (「なぜ上流の形を保つのか」ではない)。抑制の妥当性はその行を読む人が判断するため
5. 未使用での先行導入 (vendor preset) は許容する。chore コミットとして記録する

## ルートファイル

- ルートファイル (`routes/**/*.tsx`) はルーティングとページ構成に専念する。ビジネスロジックや複雑な UI は `-components/` か `src/lib/` へ切り出す
- Route hooks (`Route.useSearch` / `Route.useNavigate`) はルートファイル内の薄い wrapper component で吸収し、ページ本体は値とハンドラを props で受ける named export にする。Route hooks を混ぜるとページテストがテスト router で動かない
- loader 本体も named export の関数に切り出す。route 定義に直書きすると loader だけを呼ぶテストが書けない (実例: `src/routes/notes/index.tsx` の `loadNotesPageData`)
- wrapper 側の search 読み出しと navigate 発行は `src/test/mount-route.tsx` で実 router 上へ載せて検証する。props 直渡しのテストだけでは wrapper が 1 度も実行されない
