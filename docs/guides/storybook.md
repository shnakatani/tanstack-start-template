# Storybook

story を書くとき、play を書くとき、Storybook の agent 向けツールを使うときの手順と、その形にしている理由を持つ。

| 決定                                                                            | ADR      |
| ------------------------------------------------------------------------------- | -------- |
| Storybook は TanStack 専用の framework で導入し、telemetry を切る               | ADR-0047 |
| story は状態のカタログとし、play は操作で状態が変わる部品にだけ書く             | ADR-0048 |
| play は合成イベントで書き、実イベントの規律と移せない検証はブラウザテストに残す | ADR-0049 |
| story は部品の隣に置き、registry 部品は全件カタログにする                       | ADR-0050 |
| story の a11y は `error` で検査し、テーマごとに project を持つ                  | ADR-0052 |

## how-to

### story を置く

- story は部品と同じディレクトリに `<部品>.stories.tsx` で置き、`title` を書かない。見出しはファイルパスから決まる
- 1 つのファイルが複数の部品を export するときは、単独で描画できる部品ごとに story ファイルを分ける。親を要求する部品は親の story で扱う。CSF の meta は 1 ファイルに 1 つなので、まとめると別の部品の meta の配下に並ぶ
- story だけが使うロジックは、story と同じディレクトリの `<名前>.story-helpers.ts` に置く。`src/lib/` に置くと出荷されうる
- トークンの story に、typography の階層のような class の規範を写さない。写すと片方だけが古くなり、突き合わせる検査も無い

### story を書く

- variant の網羅を story の数で表さない。代表値を story にし、残りは `argTypes` の control で切り替える。直積で増やすと、カタログが読み通せない長さになる
- `argTypes` の `options` は `readonly any[]` で、`satisfies Meta<typeof X>` を書いても中身を検査しない。`cva` の variant をリテラルで写すと、variant を足したときに story だけ古くなり、lint も型検査も鳴らない (2026-09-20 実測)。`satisfies Record<Variant, null>` のオブジェクトを出処にして `Object.keys` で渡すと、足した側が型エラーになる
- 検証専用の story (終了状態が他の story と同じ見た目になるもの) には `tags: ["!dev"]` を付ける (ADR-0048)。ただし同じ見た目でも、別の部品の story なら残す。カタログは部品ごとに引くので、その部品の状態が 1 つも並ばない事態を避ける。実例は `ActionButtonShell` の `Idle` (`ActionButton` の `Default` と同じ見た目だが、pending が prop で切り替わることはそちらでしか見えない)
- story から部品へ渡す `className` は layout に限る (`no-restyle` の `allow: ["layout"]` に収まる class)。story は `no-restyle` / `require-static-classes` の適用外なので lint は鳴らない。外見を上書きする class は部品側の variant にする (ADR-0030)。カタログは実際の使われ方を見せるものなので、消費側で書ける形を story で書けなくしない。lint が鳴らないぶんはレビューで見る
- story の decorator は器の形 (flex / gap) だけを持ち、余白を足さない。vitest から走らせた story には Storybook の `layout: "padded"` が効かず、その差は `.storybook/preview.css` が埋める (ADR-0052)

### 上流の `write-story` skill との違い

`vp exec storybook skills` が出す `write-story` skill は上流の規約で、このリポジトリの決定と食い違う箇所がある。play を書く範囲は skill の「Simulate key user flows」ではなく ADR-0048 に従い、操作で状態が変わる部品にだけ書く。ADR に書かれていない項目は skill の既定に従う。

### 自動構成の外を手で置く

TanStack 専用の framework は、router を memory-backed で自動ラップし、server function を自動で stub する (ADR-0047)。次の 2 つは自動構成が届かない。

- TanStack Query は対象外。Query を使う部品の story を書くようになったら、QueryClient を `.storybook/preview.tsx` の構成へ手で置く
- server-only の依存を引く部品の story を書くようになったら、その依存を `__mocks__` で遮断する

### play を書く

- play の操作は `storybook/test` の合成イベントで書く (ADR-0049)。play は Storybook の UI 上でも走るので CDP を使えない
- 待機は `storybook/test` の `waitFor` で書く。ブラウザテストの retry API (ADR-0040) は play から呼べない
- popup を閉じる play は、閉じた popup の unmount を待ってから終える。待たないと、play の後に走る a11y 検査が animate-out の窓に入る (ADR-0042)
- Storybook の test 実行では、ブラウザテストの animation の無効化を適用していない。開閉を待つ story は `findBy` 系の待機だけで足りている。足りなくなったら `vitest.storybook.config.ts` の `setupFiles` へ入れる。`.storybook/preview.tsx` へ入れると `storybook dev` でも animation が消え、人が見るときの動きまで失う
- `storybook/test` の `expect` は、vitest の matcher をすべて持つわけではない。ブラウザテストの assertion を play へ機械的に写せない箇所がある

### ブラウザテストから play へ移す

1. 移すのは story を書く部品に限り、ファイルごとに移せるかを実測してから進める。一律には移さない
2. play で書いた検証は、既存のブラウザテストから削る。同じ振る舞いを 2 か所で固定しない
3. 対象の全 case が移れば、test ファイルごと削る。locator と文言を持つ `*.test-helpers.ts` は残す (`routes/` のテストが同じものを引く)
4. 移せない case (レイアウトと配色の実測、型契約、CDP 経由の実イベント) はブラウザテストに残し、残す理由と、実イベントの規律をどのテストが持つかを、そのファイルの JSDoc に書く。書かないと、次に読む人が「移し忘れ」と読んで消す

### Storybook の CLI を使う

`vp exec storybook skills` と `vp exec storybook tools` の使い方は AGENTS.md「Storybook の skill と tools」にある。ツールごとに、Storybook の起動が要るかが違う (2026-09-20 に storybook@10.6.0 で、port 6006 の Storybook を止め `--no-attach` を付けて 1 つずつ実行した)。

| ツール                                                     | 起動     | 備考                               |
| ---------------------------------------------------------- | -------- | ---------------------------------- |
| `docs list` / `docs show` / `stories changed` / `test run` | 不要     |                                    |
| `stories preview` / `review create`                        | 必要     | preview の URL と review の発行    |
| `stories find-by-component`                                | 実質必要 | 起動なしでも走るが、結果が空で返る |

`stories find-by-component` の逆依存グラフは dev server が持つ。未起動だと `no stories found` が返り、story が無いのと区別が付かない。tool の help 自身が「If a component has no matches here, it has no stories yet (say so, don't fabricate)」と書くので、読んだ側は「story が無い」と報告してしまう。起動して `--port` で指すと、距離つきで返る。

## explanation

### CLI を使い、MCP を入れない理由

`storybook@10.6.0` は agent 向けの機構を 2 経路で配っている。本体同梱の CLI (`storybook skills` / `storybook tools`) と、別パッケージの `@storybook/addon-mcp` である。どちらも同じツール群を公開する。公式 docs に載っているのは MCP だけで、CLI は記載が無く、`storybook --help` のコマンド一覧にも出ない。

| 観点             | CLI                                  | MCP                                                                     |
| ---------------- | ------------------------------------ | ----------------------------------------------------------------------- |
| 追加パッケージ   | 不要 (本体同梱)                      | `@storybook/addon-mcp`                                                  |
| Storybook の起動 | 多くのツールで不要 (上の表)          | 全ツールで必要 (HTTP endpoint 経由)                                     |
| 設定             | 不要                                 | `main.ts` に `componentsManifest: true` と、エージェントへの URL の登録 |
| 配布             | clone すれば誰でも同じコマンドが動く | 登録はエージェント側の個人設定                                          |

決め手は配布である。MCP の登録はエージェント側の設定に URL を 1 つ持つが、このリポジトリの Storybook の port は worktree ごとに変わる (`.mise.toml` の `storybook` タスクが `derive-dev-port.sh` で導出する)。同じ登録を collaborator へ配れない。CLI は `--cwd` / `-c` でプロジェクトを指すので、port の影響を受けない。

MCP が優るのは、ツールの説明がエージェントに常に見える点である。CLI は AGENTS.md に書いても読み飛ばされれば使われない。AGENTS.md の「Storybook の skill と tools」節を消さないのはこのためである。MCP へ移るなら、port を固定するか、worktree ごとに登録し直す運用が要る。
