// Vite の ImportMetaEnv は既定で Record<string, any> を継承し、宣言していないキーの索引が
// any になる。公式のオプトインで fallback を切り、宣言したキーだけを許す
// (vite/types/importMeta.d.ts の ImportMetaEnvFallbackKey)。
interface ViteTypeOptions {
  strictImportMetaEnv: unknown;
}

// アプリ固有の環境変数を足すときは、ここへ ImportMetaEnv を宣言して 1 キーずつ列挙する。
// 宣言しないキーの参照は tsc が弾く。VITE_ 接頭辞のキーだけが client へ公開される。
//
//   interface ImportMetaEnv {
//     readonly VITE_API_BASE_URL: string;
//   }
//
// 定義側は .mise.toml の [env] が持つ。`.env` は読まない (vite.config.ts の envDir: false)。
// 値が環境ごとに変わらないものは環境変数にせず、モジュール定数にする (実例: src/lib/app-name.ts)。
