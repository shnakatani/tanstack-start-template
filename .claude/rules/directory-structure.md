---
paths:
  - "src/**"
---

# ディレクトリ構成方針

## コンポーネント配置

| 配置先                       | 内容                                                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ui/`         | shadcn 生成コンポーネント (`vp dlx shadcn@latest add` の出力先)                                                                           |
| `src/components/action/`     | `ui/` を包み `action` prop で Transition 化した部品。ファイル名は包む先と同名 (ADR-0014)                                                  |
| `src/components/parts/`      | registry を包んで外見を定義する自作部品。層の規則 (`no-restyle` / `require-static-classes`) の適用外 (ADR-0020 / ADR-0021)                |
| `src/components/screens/`    | 部品を並べて画面を組む共有コンポーネント。層の規則を適用する (ADR-0020 / ADR-0021)                                                        |
| `src/components/`            | 上のどれでもないもの。層の規則を適用する (ADR-0020 / ADR-0021)。実例は `live-regions.tsx`                                                 |
| `src/features/<domain>/`     | ドメイン固有で複数の画面から使うコンポーネント                                                                                            |
| `routes/<path>/-components/` | その URL 配下だけで使うコンポーネント。`-` prefix は routeTree から除外される                                                             |
| `routes/<path>/-lib/`        | その URL 配下だけで使う、コンポーネントでないモジュール (行の組み立て、列定義、dialog の handle、型)。テストは同じディレクトリ (ADR-0019) |
| `routes/<path>/-hooks/`      | その URL 配下だけで使う React hook (`use-*`)。`src/hooks/` と同じ線引き (ADR-0019)                                                        |

- `routes/<path>/-` で始まるディレクトリ (`-components/` `-lib/` `-hooks/`) の中の import は相対パスで書く
- 一覧テーブルは `DataTable` (`src/components/parts/`) に列定義と data を渡す。列定義は `createColumnHelper` で `-lib/<画面>-columns.ts` (横断なら `src/features/<domain>/`) に書き、cell の描画は `-components/` の部品を参照で渡す (ADR-0019)
- 部品と画面の取り違えは機械で止まらない。判断軸は役割: registry や自作部品を包んで外見そのものを定義するなら `parts/`、既存の部品を並べて画面を組むだけなら `screens/`。消費者が 1 つでも、外見の定義を担うなら `parts/` (ADR-0020)
- story は部品と同じディレクトリに `<部品>.stories.tsx` で置く。`src/components/ui/` も同じで、baseline の対象外になる (ADR-0006 / ADR-0022)
- className を書きたくなったこと自体は `parts/` への移動理由にならない。静的か動的かを問わない。層の規則から外れるために移すのは逆 (ADR-0020 / ADR-0021)
- `routes/` の階層は URL の設計であってドメインの区切りではない。ドメインの画面が 1 つの URL サブツリーに収まる保証は無いので、ドメイン固有の共有部品を `routes/` 側へ置かない (ADR-0012)
- route ファイルの rename / 移動時、`createFileRoute` のパス文字列は plugin が自動更新する。手で書き換えない
- 公式の詳細は TanStack の intent skill (`@tanstack/router-plugin` / `@tanstack/router-core`) を load して確認する

## features と hooks と lib と server の境界

| 配置先                   | 内容                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `src/features/<domain>/` | 1 つのドメインに属するもの一式 (スキーマ / query options / mutation options / server fn / 共有 UI) |
| `src/hooks/`             | React 依存のカスタム hook (`use-*`) と、React 依存の context 定義                                  |
| `src/lib/`               | ドメインに属さない汎用ロジック・型 (React 非依存)                                                  |
| `src/server/`            | ドメインに属さないもの (DB 接続とスキーマ、横断的な server function)                               |

- 画面そのもの (ページ本体) は route ファイルの named export に残す。ドメイン固有で複数の画面から使う UI は `src/features/<domain>/` へ置く (ADR-0012)
- `src/features/<domain>/` 内部の import は相対パスで書く。ディレクトリごと移せる形を保つ (ADR-0012)
- React の hook を `src/lib/` に置かない
- client bundle へ入るファイルから `src/server/db/` と native binding を持つ依存を import しない。DB へ触るのは `.server.` を持つファイルとテスト、`src/server/db/` の中に限る (遮断は `vite.config.ts` の `tanstackStart` の `importProtection`)
- `src/features/<domain>/` のファイル名と、横断的な server function の置き場所は `server-functions.md`「ファイルの置き場所と名前」が持つ
- server function の認証・認可をどこへ置くかは `server-functions.md`「関心事の置き場所」が持つ

## テストとスクリプトの配置

`scripts/` 配下の分け方と実行 project は `testing.md`「テストの種別と置き場所」が持つ。

テスト専用ヘルパーは 2 段に置く。2 つのテストで同じ locator を書き分けると、ラベル変更で片方だけ落ちる。

| 対象                                         | 置き場所                                                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ドメインを跨ぐもの (render の型、a11y、mock) | `src/test/`                                                                                                                                                               |
| 特定の部品の locator や fixture              | 部品と同じディレクトリの `<部品>.test-helpers.ts`。`routes/` 配下では対象と同じ `-components/` か `-lib/` に置き、route ファイル自身の helper は route ファイルの隣に置く |
| story だけが使うロジック                     | story と同じディレクトリの `<名前>.story-helpers.ts`。`src/lib/` へ置かない。プロダクトコードと読まれ、誰かが import すれば出荷される (ADR-0022)                          |

- 付随ファイル (`*.test.*` / `*.test-helpers.*` / `*.story-helpers.*` / `*.stories.*`) の種別は `scripts/lib/companion-files.ts` が唯一の定義で、lint の適用外・coverage の除外・registry baseline の突き合わせはそこから導出する。種別を足すときはそこだけを直す
- route ファイルの隣に置いた `*.test-helpers.ts` は `routeFileIgnorePattern` (`vite.config.ts`) が route ファイル扱いから外す。`-` で始まるディレクトリの中は元から除外される
- `*.test-helpers.ts` / `*.story-helpers.ts` / `src/test/` をアプリのコードから import しない。型しか引かない helper は build を壊さず、fixture が bundle に入る。lint の `no-restricted-imports` が止め、テストと story と helper は対象外 (ADR-0004)
- helper のテストの置き方は対象の実行環境で決める。DOM が要るものは `*.test.tsx` (browser project)、純粋なものは `*.test.ts` (unit project)

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

- ルートファイル (`routes/**/*.tsx`) はルーティングとページ構成に専念する。その画面専用の純粋ロジックは `-lib/`、複雑な UI は `-components/`、ドメインに属するなら `src/features/<domain>/`、属さないなら `src/lib/` へ切り出す
- Route hooks (`Route.useSearch` / `Route.useNavigate`) はルートファイル内の薄い wrapper component で吸収し、ページ本体は値とハンドラを props で受ける named export にする。Route hooks を混ぜるとページテストがテスト router で動かない
- loader 本体も named export の関数に切り出す。route 定義に直書きすると loader だけを呼ぶテストが書けない (実例: `src/routes/notes/index.tsx` の `loadNotesPageData`)
- loader は Query を温めるためだけに呼び、値は component が `useSuspenseQuery` で読む。`useLoaderData` で Query 所有のデータを読むと、mutation の `invalidateQueries` では loader が再実行されず画面だけ古いまま残る
- wrapper 側の search 読み出しと navigate 発行は `src/test/mount-route.tsx` で実 router 上へ載せて検証する。props 直渡しのテストだけでは wrapper が 1 度も実行されない
