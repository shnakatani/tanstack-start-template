import viteReact from "@vitejs/plugin-react";

type ReactPluginOptions = { compiler: false } | { compiler: true; logDiagnostics?: true };

/**
 * React の変換 (`@vitejs/plugin-react`)。アプリの `plugins` と、ブラウザで走る project
 * (`tooling/test/chromium-project.ts`) の両方がここから作り、`viteReact()` を別に書かない。
 * `viteReact` の作り方を 1 か所にし、アプリとテストの違いを `compiler` と `logDiagnostics` の 2 つに限る。
 * 別に書くと、ほかの option がアプリとテストで食い違っても、テストは全部通る
 * (`docs/guides/testing/configuration.md`「テストでだけ plugin を変える」)。
 *
 * `logDiagnostics` はアプリだけが立てる。bail out はビルドログで読み (ADR-0014)、テストで出すと
 * ブラウザで走る project ごとに同じ bail out を出し直す
 * (`docs/guides/testing/configuration.md`「テストでも React Compiler を通す理由」)
 */
export function reactPlugin(options: ReactPluginOptions) {
  return viteReact({
    compiler: options.compiler && { logDiagnostics: options.logDiagnostics ?? false },
  });
}
