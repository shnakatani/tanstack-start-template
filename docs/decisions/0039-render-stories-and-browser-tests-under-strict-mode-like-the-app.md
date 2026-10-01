# ADR-0039: story とブラウザテストはアプリと同じく StrictMode の下で描く

- Status: Accepted
- Date: 2026-10-01
- 関連: ADR-0037 (テストの設定の置き場所)

## Context

この ADR は、story とブラウザテストで部品を StrictMode の下で描くかを決める。戻すと、描画中の副作用 (描画のたびに出る `console.warn` など) がテストを通り抜ける。

アプリは StrictMode の下で動く。`src/` は client entry を持たないので、TanStack Start の既定の entry が使われ、それが `<StartClient />` を `<StrictMode>` で包む (`@tanstack/react-start` 1.168.58 の `default-entry/client.tsx`)。StrictMode は開発時に部品の描画を 2 回走らせ、mount 直後の effect を 1 度外して付け直す。描画が純粋でない部品や、cleanup の無い effect をここで見つける仕組みである (React docs「StrictMode」)。

story とブラウザテストは、どちらも StrictMode なしで描いていた。そのため、アプリの開発時には 2 回になる副作用が、テストでは 1 回に見えていた。2026-10-01 に、`src/components/parts/form-fields.tsx` の部品が出す `console.warn` を `useEffect` から描画中へ戻しても、warn の回数を 1 回と確かめる story は通った。

StrictMode で描くかを決める口は、経路ごとに次のとおり (2026-10-01、Storybook 10.6.0、vitest-browser-react 2.3.0 で確かめた)。

| 経路                                                               | 口                                                                   | 届く範囲                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storybook の画面                                                   | `.storybook/main.ts` の `framework.options.strictMode`               | `@storybook/react` は、モジュールを読んだ時点で `global.FRAMEWORK_OPTIONS?.strictMode` を読む (`renderToCanvas.tsx`)。`FRAMEWORK_OPTIONS` を置くのは builder-vite で、Storybook の画面の iframe の HTML を組むときだけ埋め込む (`transform-iframe-html.ts`) |
| vitest 経由の story (`@storybook/addon-vitest`)                    | 同上                                                                 | 届かない。addon-vitest の vitest plugin は framework から名前しか読まず、story を描く前に読むのは `setProjectAnnotations` が渡す preview の annotation だけ (`vitest-plugin/index.ts`)。main.ts に `strictMode: true` を書いても、描画中の warn を見逃した  |
| 両方                                                               | `.storybook/preview.tsx` の decorator                                | 届く。preview の annotation は両方の経路で読まれる                                                                                                                                                                                                          |
| ブラウザテスト (`vitest-browser-react` の `render` / `renderHook`) | `configure({ reactStrictMode: true })` (`vitest-browser-react/pure`) | 既定は無効。有効にすると `render` と `rerender` が描くものを StrictMode で包み、`renderHook` も `render` を通る (`src/pure.tsx`)                                                                                                                            |

`strictMode` は `@storybook/tanstack-react` の設定の型 (`FrameworkOptions`) に無く、Storybook の framework のページ (react-vite、tanstack-react) にも載っていない。main.ts から framework の設定を portable stories へ運ばない件は、`features` について上流でも報告がある (storybookjs/storybook#29782)。

## Decision

**story とブラウザテストは、アプリと同じく StrictMode の下で描く。story は `.storybook/preview.tsx` の decorator で包み、ブラウザテストは `src/test/browser/browser-setup.tsx` で `vitest-browser-react` の `configure({ reactStrictMode: true })` を呼ぶ。**

- story の decorator は preview の decorators の最後に置く。Storybook は story・component・project の順に並べた decorator を前から重ねるので、後ろほど外側に来る (`prepareStory.ts`、`decorators.ts`)。`@storybook/tanstack-react` は router の decorator を一番内側に足すので (`preview.tsx` の `applyDecorators`)、router ごと StrictMode に入り、アプリの root と同じ形になる
- 置き場所と、StrictMode で回数が増えたときの直し方は `docs/guides/testing/configuration.md`「StrictMode の下で描く」にある

| 案                                                                               | 評価                                                                                                                                                                                                          | 採否     |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| story は preview の decorator、ブラウザテストは `configure` で StrictMode にする | 公開された API (decorator と `configure`) だけで、Storybook の画面・vitest 経由の story・ブラウザテストの 3 経路がアプリと同じ描き方になる                                                                    | **採用** |
| story は main.ts の `framework.options.strictMode` で StrictMode にする          | vitest 経由の story に届かず、`mise run verify` と CI では何も検出しない。`@storybook/tanstack-react` の型に無く、書くには型を握りつぶすことになる                                                            | 却下     |
| main.ts に加え、vitest の setup で `globalThis.FRAMEWORK_OPTIONS` を書く         | 内部の global に頼る。`@storybook/react` がモジュールを読んだ時点で読むので、setup の読み込み順にも依存する                                                                                                   | 却下     |
| 回数を確かめる story やテストにだけ `<StrictMode>` を足す                        | 書いた所しか見ない。描画が純粋でないことは、どの部品のどの story で表に出るか前もって分からない                                                                                                               | 却下     |
| 親の state を変えて部品を描き直す専用の story を組む                             | 部品が読む値を変えずに描き直させることはできるが、Storybook の慣習ではない自前の仕組みで、部品ごとに組むことになる。StrictMode は React が描画の純粋さを確かめるために用意した仕組みで、全 story に一度に効く | 却下     |
| StrictMode なしのまま描く                                                        | アプリの開発時と描き方が違い、描画中の副作用がテストを通り抜ける                                                                                                                                              | 却下     |

## Consequences

- 描画中の副作用が回数の検証で落ちる。2026-10-01 に、warn を描画中へ戻した実装で `CheckboxValidatorsWarn` の story が「2 回呼ばれた」で落ち、`useEffect` の実装では通ることを確かめた。React 19.3.0 は 2 回目の描画の `console` を抑えない
- mount 直後の effect は setup → cleanup → setup の順に走る。cleanup の無い effect の呼び出しを数えるテストは 2 回を見る。テストの期待値ではなく effect の側を直す
- 導入した 2026-10-01 の時点で、light と dark の全 story は StrictMode の下でも通った。ブラウザテストは、StrictMode の有無で結果が変わらなかった
- Storybook の画面でも StrictMode が効く。story を開いた直後の effect も 2 回走る
- addon-vitest が main.ts の framework の設定を portable stories へ運ぶようになっても、preview の decorator は 3 経路に効くので、置き場所を変える理由にはならない

## 出典

- TanStack Start の既定の client entry が `StrictMode` で包むこと (`@tanstack/react-start` 1.168.58): https://github.com/TanStack/router/blob/%40tanstack%2Freact-start%401.168.58/packages/react-start/src/default-entry/client.tsx
- StrictMode が開発時に描画と effect を 2 回走らせること (React docs「StrictMode」): https://react.dev/reference/react/StrictMode
- `@storybook/react` が `FRAMEWORK_OPTIONS.strictMode` で包むかを決めること (Storybook 10.6.0 の `renderToCanvas.tsx`): https://github.com/storybookjs/storybook/blob/v10.6.0/code/renderers/react/src/renderToCanvas.tsx
- builder-vite が `FRAMEWORK_OPTIONS` を iframe の HTML に埋め込むこと (Storybook 10.6.0 の `transform-iframe-html.ts`): https://github.com/storybookjs/storybook/blob/v10.6.0/code/builders/builder-vite/src/transform-iframe-html.ts
- addon-vitest の vitest plugin が framework から名前を読むこと (Storybook 10.6.0 の `vitest-plugin/index.ts`): https://github.com/storybookjs/storybook/blob/v10.6.0/code/addons/vitest/src/vitest-plugin/index.ts
- `@storybook/tanstack-react` の `FrameworkOptions` (Storybook 10.6.0 の `types.ts`): https://github.com/storybookjs/storybook/blob/v10.6.0/code/frameworks/tanstack-react/src/types.ts
- decorator を story・component・project の順に並べて前から重ねること (Storybook 10.6.0 の `prepareStory.ts` と `decorators.ts`): https://github.com/storybookjs/storybook/blob/v10.6.0/code/core/src/preview-api/modules/store/csf/prepareStory.ts 、 https://github.com/storybookjs/storybook/blob/v10.6.0/code/core/src/preview-api/modules/store/decorators.ts
- `@storybook/tanstack-react` が router の decorator を一番内側に足すこと (Storybook 10.6.0 の `preview.tsx`): https://github.com/storybookjs/storybook/blob/v10.6.0/code/frameworks/tanstack-react/src/preview.tsx
- main.ts の `features` が portable stories に届かない報告: https://github.com/storybookjs/storybook/issues/29782
- `vitest-browser-react` の `configure` と `reactStrictMode` (2.3.0 の README と `src/pure.tsx`): https://github.com/vitest-dev/vitest-browser-react/blob/v2.3.0/README.md 、 https://github.com/vitest-dev/vitest-browser-react/blob/v2.3.0/src/pure.tsx
