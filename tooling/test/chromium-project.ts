import tailwindcss from "@tailwindcss/vite";
import type { UserWorkspaceConfig } from "vite-plus/test/config";

/**
 * ブラウザで走る project (ブラウザテストと story) に共通する設定。全 project が共有する設定は root から
 * 継承し、ブラウザで走る project だけが共有するものをここに置く。各 project は `mergeConfig` で
 * この上に自分の設定を重ねる。配列は連結され、オブジェクトは深く merge される
 * (`docs/guides/testing/configuration.md`「project を inline に並べる理由」)。
 *
 * 関数で返すのは 2 つの理由から。`tailwindcss()` を project を解決するときにだけ呼ぶ
 * (`docs/guides/vite-configuration.md`「読み込むだけで起きる副作用を持たせない理由」)。
 * `tailwindcss()` は呼ぶたびに新しい plugin を返し、ブラウザで走る project はそれぞれ自前の
 * Vite server を持つので、plugin の instance を project の間で共有しない
 */
export function chromiumProjectBase() {
  return {
    // Tailwind のクラスを実 CSS に解決する。setupFiles の src/test/browser/browser-setup.tsx が
    // src/styles.css を import し、この plugin がユーティリティクラスを生成する。Node の project には
    // 要らないので、テスト時の root の plugins には置かない (docs/guides/testing/configuration.md「テストでだけ plugin を変える」)
    plugins: [tailwindcss()],
    resolve: {
      // registry combobox の @base-ui/react barrel import が React を二重解決し invalid hook call になるのを防ぐ
      dedupe: ["react", "react-dom"],
    },
    test: {
      browser: {
        enabled: true,
        headless: true,
        instances: [{ browser: "chromium" }],
      },
    },
  } satisfies UserWorkspaceConfig;
}
