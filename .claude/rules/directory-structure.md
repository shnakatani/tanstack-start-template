---
paths:
  - "src/**"
---

# ディレクトリ構成方針

## コンポーネント配置

| 配置先                       | 内容                                                                                                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ui/`         | shadcn 生成コンポーネント (`vp dlx shadcn@latest add` の出力先。ADR-0011)。registry に相当が無い ui 部品は、拡張する registry のファイルの中に足す (ADR-0020)                     |
| `src/components/action/`     | `ui/` を包み `action` prop で Transition 化した部品。ファイル名は包む先と同名 (ADR-0016)。層の規則を適用する (ADR-0011)                                                           |
| `src/components/parts/`      | ui 部品を組み合わせる自作部品。見た目の差は `ui/` の variant で持つ。層の規則を適用する (ADR-0011 / ADR-0022)                                                                     |
| `src/components/screens/`    | 部品を並べて画面を組む共有コンポーネント。層の規則を適用する (ADR-0011 / ADR-0022)                                                                                                |
| `src/components/`            | 上のどれでもないもの。層の規則を適用する (ADR-0011 / ADR-0022)。実例は `live-regions.tsx`                                                                                         |
| `src/features/<domain>/`     | ドメイン固有で複数の画面から使うコンポーネント (ADR-0010)                                                                                                                         |
| `routes/<path>/-components/` | その URL 配下だけで使うコンポーネント。`-` prefix は routeTree から除外される (`docs/guides/placement.md`「route の中の置き場」)                                                  |
| `routes/<path>/-lib/`        | その URL 配下だけで使う、コンポーネントでないモジュール (行の組み立て、列定義、dialog の handle、型)。テストは同じディレクトリ (`docs/guides/placement.md`「route の中の置き場」) |
| `routes/<path>/-hooks/`      | その URL 配下だけで使う React hook (`use-*`)。`src/hooks/` と同じ線引き (`docs/guides/placement.md`「route の中の置き場」)                                                        |

- `routes/<path>/-` で始まるディレクトリの中の import は相対パスで書く (`docs/guides/placement.md`「route の中の置き場」)
- 部品として配るなら `parts/`、既存の部品を並べて画面を組むなら `screens/`。配る部品を `screens/` や直下へ置くと `componentImports` に入らず、素の要素に当てる見た目の上書きが検査から漏れる (ADR-0011)
- 一覧テーブルは `DataTable` (`parts/`) に列定義と data を渡す。列定義は `createColumnHelper` で `-lib/<画面>-columns.ts` に書き、cell は `-components/` の部品を参照で渡す (`docs/guides/lists-and-search.md`「一覧テーブルを組む」)
- ドメイン固有の共有部品を `routes/` 側へ置かない。`routes/` の階層は URL の設計で、ドメインの区切りではない (ADR-0010)
- route ファイルを rename / 移動しても `createFileRoute` のパス文字列は plugin が更新する。手で書き換えない
- story は部品と同じディレクトリに `<部品>.stories.tsx` で置き、`title` を書かない。見出しはファイルパスから決まる (`docs/guides/storybook.md`「story を置く」)
- story を置けるのは `src/components/` 配下だけ。他へ置くと `.storybook/main.ts` の `stories` から無言で外れる (`docs/guides/storybook.md`「story を置く」)
- 1 つのファイルが複数の部品を export するとき、単独で描画できる部品は story ファイルを分ける。親を要求する部品は親の story で扱う。CSF の meta は 1 ファイルに 1 つで、まとめると別の部品の meta 配下に並ぶ (`docs/guides/storybook.md`「story を置く」)
- `argTypes` の `options` に `cva` の variant を写すときは型で網羅を強制する。型検査も lint も一致を見ない (`docs/guides/storybook.md`「story を書く」)
- トークンの story に typography の階層のような class の規範を写さない。写すと片方だけが古くなり、突き合わせる検査も無い (`docs/guides/storybook.md`「story を置く」)
- story の decorator は器の形 (flex / gap) だけを持ち、余白を足さない。余白は `.storybook/preview.css` が持つ (`docs/guides/storybook.md`「story を書く」)
- `ui/` の story から部品へ渡す `className` は layout に限る。`ui/` は lint (`no-restyle`) の適用外なのでレビューで見る (`docs/guides/storybook.md`「story を書く」)

## features と hooks と lib と server の境界

| 配置先                   | 内容                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `src/features/<domain>/` | 1 つのドメインに属するもの一式 (スキーマ / query options / mutation options / server fn / 共有 UI) |
| `src/hooks/`             | React 依存のカスタム hook (`use-*`) と、React 依存の context 定義                                  |
| `src/lib/`               | ドメインに属さない汎用ロジック・型 (React 非依存)                                                  |
| `src/server/`            | ドメインに属さないもの (DB 接続とスキーマ、横断的な server function)                               |

- `src/features/<domain>/` の中の import は相対パスで書く。ディレクトリごと移せる形を保つ (`docs/guides/placement.md`「features か route か」)
- DB と native binding を持つ依存に触るのは、`.server.` を持つファイルとテストと `src/server/db/` の中だけ。client からの import は build (`importProtection`) が止める (ADR-0010)

## テストとスクリプトの配置

テスト専用ヘルパーは 2 段に置く。同じ locator を 2 つのテストで書き分けると、ラベル変更で片方だけ落ちる。

| 対象                                         | 置き場所                                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| ドメインを跨ぐもの (render の型、a11y、mock) | `src/test/`                                                                                                                           |
| 特定の部品の locator や fixture              | 部品と同じディレクトリの `<部品>.test-helpers.ts`。`routes/` では対象と同じ `-components/` か `-lib/`、route ファイル自身の分はその隣 |
| story だけが使うロジック                     | story と同じディレクトリの `<名前>.story-helpers.ts`。`src/lib/` に置くと出荷されうる (`docs/guides/storybook.md`「story を置く」)    |

- 付随ファイル (`*.test.*` / `*.test-helpers.*` / `*.story-helpers.*` / `*.stories.*`) の種別は `scripts/lib/companion-files.ts` だけが定義する。種別を足すときはそこだけを直す
- helper や `src/test/` をアプリのコードから import しない。lint (`no-restricted-imports`) が止める (ADR-0008)
- story (`*.stories.*`) も `no-restricted-imports` の対象から外す。出荷される bundle に入らない
- helper のテストは、DOM が要るものは `*.test.tsx` (browser project)、純粋なものは `*.test.ts` (unit project) に置く

## shadcn コンポーネント導入時のチェック

`src/components/ui/` を新規追加・改変したら、最初のコミット前に:

1. 生成時 baseline を `docs/registry-baseline/<name>.tsx` に取る (新規追加時と `--overwrite` 再生成時)。手順は `docs/guides/registry.md`「baseline を取り直して取り込む」
2. baseline との diff が台帳 `docs/registry-deviations.md` と 1:1 であることを確かめる。上流の形を保つ違反だけ行単位で抑制し、台帳へ記録する (ADR-0020)
3. コード側の理由コメントは、ADR と台帳だけでは実装者が誤る落とし穴に限る。`oxlint-disable` の `--` には、そのルールを抑制してよい理由を書く (`docs/guides/registry.md`「部品を足す」)
4. 未使用での先行導入 (vendor preset) は許容する。chore コミットとして記録する (`docs/guides/registry.md`「部品を足す」)
5. story を書く。消費側からの import が 0 件でも書く。書かないと a11y 検査が一度も当たらない (`docs/guides/storybook.md`「story を置く」)

## ルートファイル

- ルートファイル (`routes/**/*.tsx`) はルーティングとページ構成に専念する。純粋ロジックは `-lib/`、UI は `-components/`、ドメインに属するなら `src/features/<domain>/`、属さないなら `src/lib/` へ切り出す (`docs/guides/placement.md`「features か route か」)
- ページ本体は `-components/` に置き、Route hooks (`Route.useSearch` 等) はルートファイル内の export しない wrapper で吸収して props で渡す。混ぜるとページテストが動かない (`docs/guides/placement.md`「route ファイルを組む」)
- Route hooks を使う wrapper は、実 router + `createMemoryHistory` で描いて検証する。tree は root を差し替えて組む (実例: `src/routes/notes/index.test.tsx`、`docs/guides/testing/route-wrappers.md`「route の wrapper をテストする」)
- loader は `createFileRoute` の options に直接書く。関数に切り出すと `context` と `deps` の型を手で書くことになる (`docs/guides/placement.md`「route ファイルを組む」)
- loader は Query を温めるためだけに呼び、値は `useSuspenseQuery` で読む。`useSuspenseQuery` はキャッシュを読んで更新を購読するので、invalidate で描き直される (TanStack Router「External Data Loading」)
- route の property とそれが使うものを route ファイルから export しない。export すると main bundle に入る (ADR-0010)
- 分割されない property (`pendingComponent` / `loader` / `validateSearch` 等) が import する module は eager に読まれる。ページ本体と同じ module に置かず、pending 表示は別ファイル、共有する定数は `-lib/` に置く (ADR-0010)
- route ファイルのテストは route ファイル名に `.test` を付ける (`index.test.tsx`)。`route.test.tsx` はレイアウトルートのテストと読める (Router の file-naming-conventions)
