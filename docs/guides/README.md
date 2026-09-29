# 設計ガイド

部品をまたいで守る作法について、なぜその形か (explanation) と、その作法で組む手順・落とし穴への対処 (how-to) を主題ごとに置く。
決定と、決定で比べた案は `docs/decisions/` の ADR が持ち、ガイドは ADR を番号で指す。作法の選び方で比べた案は、ガイドの explanation が持つ。Claude が作業中に読む規範は `.claude/rules/` が持ち、出典としてガイドの節を指す (ADR-0001)。

## 書き方

書き方の全体と理由は `docs/guides/writing-docs.md`「ガイドを書く」「ガイドの書き方を選んだ理由」にある。要点は次のとおり。

- 1 本に 1 主題。主題の中を how-to の節と explanation の節に分ける
- コードはファイルパスで指し、貼らない。ADR の決定は言い換えず `ADR-NNNN` で指す
- 経緯を書かない。コードと決定が変わったら、その場で書き換える
- 節を他の文書から指すときは `docs/guides/<file>.md「<見出し>」` の形にする。見出しを変えたら `git grep` で指している側を直す

## 主題

| ファイル                                                               | 主題                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [writing-docs.md](writing-docs.md)                                     | ドキュメントの書き方 (ADR・rules・AGENTS.md・ガイドの書き方、比の洗い出し)                                                                                                                                                                |
| [lint/configuration.md](lint/configuration.md)                         | lint の設定 (解決後の設定での確かめ方、ルールとプラグインの足し方、testing-library の範囲、variant、off の条件とテストの緩和、抑制、設定の落とし穴)                                                                                       |
| [lint/tailwind-and-shadcn.md](lint/tailwind-and-shadcn.md)             | Tailwind と shadcn の lint (`require-static-classes` の範囲、variant 関数の宣言、`@shadcn/lint` の発火の確かめ方)                                                                                                                         |
| [lint/custom-rules.md](lint/custom-rules.md)                           | 自前の lint ルール (書き方、2 通りに壊して確かめる、JS plugin の落とし穴、`@oxlint/plugins` を直接の依存にしない理由、ネイティブのルールを先に探す理由)                                                                                   |
| [placement.md](placement.md)                                           | 配置と境界 (route の中の置き場、route ファイルの組み方、features か route か、落とし穴 (importProtection、Tailwind の scan 範囲)、route の中を `-` で始める理由、route ファイルの組み方と code splitting、`src/test/` の helper の分け方) |
| [react/updates.md](react/updates.md)                                   | ユーザー操作による更新 (ハンドラ、Action 層と mutation、完了点の組み方、mutation の pending、楽観表示、操作の型ごとの当て方)                                                                                                              |
| [react/effects.md](react/effects.md)                                   | effect (effect とイベントハンドラの分け方、開発時の二重実行の読み方、effect に書くかの判定)                                                                                                                                               |
| [react/memoization.md](react/memoization.md)                           | メモ化と React Compiler (手動メモ化の判定、Compiler の診断)                                                                                                                                                                               |
| [server-functions.md](server-functions.md)                             | server function (認可、例外を server のログに残す、部分一致の検索)                                                                                                                                                                        |
| [database.md](database.md)                                             | データベース (接続先を決める、スキーマを変える、起動時に migration を適用する形に変える、テストで使う、DB のファイルをアプリで作らない理由、パスを cwd 基準にする理由、migration を起動時に適用しない理由)                                |
| [lists-and-search.md](lists-and-search.md)                             | 一覧・絞り込み・検索 (一覧テーブル、URL の絞り込み条件、検索の入力欄)                                                                                                                                                                     |
| [forms-and-inputs.md](forms-and-inputs.md)                             | フォームと入力部品 (スキーマ、数値の入力欄、fieldComponents、Select の値の解決、高さのあるダイアログ、placeholder)                                                                                                                        |
| [dates-and-time-zones.md](dates-and-time-zones.md)                     | 日時とタイムゾーン (日付や日時の値を足す、画面に日時を出す、画面に暦の日付を出す、整形した日時をテストで確かめる、日付の入力を扱う、タイムゾーンを明示して整形する理由、書式をロケールに任せる理由)                                       |
| [styling-and-tokens.md](styling-and-tokens.md)                         | スタイルとトークン (色の当て方、外見の配り方、トークンの作り直し、比の測り方、scan と `theme(static)`、間隔)                                                                                                                              |
| [accessibility.md](accessibility.md)                                   | アクセシビリティ (層ごとの役割、axe の緑と incomplete の読み方、a11y の tag、抑制の書き方、通知の文言)                                                                                                                                    |
| [testing/waiting-and-assertions.md](testing/waiting-and-assertions.md) | テストの待機と assert (待つ口、同期読みの書き換え、否定を肯定で書く、assert の予算、viewport、状態と通知)                                                                                                                                 |
| [testing/annotations.md](testing/annotations.md)                       | テストの注釈 (注釈の残し方、reporter ごとの読み方、注釈の位置の決まり方、`console.warn` ではなく注釈で残す理由、helper にテストの文脈を渡す理由)                                                                                          |
| [testing/user-interactions.md](testing/user-interactions.md)           | テストのユーザー操作 (クリックの発火、animation を戻すテスト、入力部品、debounce)                                                                                                                                                         |
| [testing/mocking.md](testing/mocking.md)                               | テストのモジュール差し替え (形の選び方、`__mocks__` に寄せる理由、`__mocks__` で元を展開して一部だけ差し替えない理由)                                                                                                                     |
| [testing/time-zones.md](testing/time-zones.md)                         | テストのタイムゾーン (基準のタイムゾーン、TZ ごとの実行、ブラウザでの切り替え、基準を決める理由、globalSetup に置く理由、プロセスを分ける理由、並列にする理由)                                                                            |
| [testing/route-wrappers.md](testing/route-wrappers.md)                 | route の wrapper のテスト                                                                                                                                                                                                                 |
| [testing/check-scripts.md](testing/check-scripts.md)                   | 検査スクリプトの置き方 (検査スクリプトの足し方、分けて置く理由)                                                                                                                                                                           |
| [testing/type-tests.md](testing/type-tests.md)                         | 型テスト (置き場所、`vp check` での検査、Vitest の `typecheck` を使わない理由)                                                                                                                                                            |
| [storybook.md](storybook.md)                                           | Storybook (story の置き方と書き方、カタログと play の範囲、framework と telemetry、自動構成の外、play の書き方と移し方、CLI の使い方と MCP を入れない理由)                                                                                |
| [registry.md](registry.md)                                             | registry との付き合い方 (部品の足し方、baseline の取り直しと 3-way の取り込み、台帳との突き合わせ、公式のノブ)。乖離の台帳は `docs/registry-deviations.md`                                                                                |
| [dependencies-and-toolchain.md](dependencies-and-toolchain.md)         | 依存と開発環境 (手元の環境、秘密の足し方、待機の前倒し、catalog と pin、action の足し方、依存をバレルの禁止の対象に足す、依存を上げたときに見直すもの、config の worktree 除外、typescript を直接の依存に置かない理由)                    |
