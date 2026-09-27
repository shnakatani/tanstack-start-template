/**
 * テスト全体の基準のタイムゾーンを決める。worker の起動前にメインプロセスで走るので、pool を
 * 問わず全 project の `Date` に効く (Vitest の common-errors「Time Zone Does Not Change in
 * Worker Threads」)。
 *
 * 基準は `APP_TIME_ZONE` (Asia/Tokyo) とも UTC とも違う TZ にする。ホストのローカル TZ が
 * `APP_TIME_ZONE` と一致すると、ローカル TZ で壁時計を組み立てる実装を固定値のテストが見逃す。
 * UTC はオフセットが 0 なので、変換漏れが隠れる。ホストの `TZ` に関わらず上書きする。
 *
 * テストの中で別の TZ を見るときは `vi.stubEnv("TZ", …)` で切り替える。切り替えが効くのは
 * forks / vmForks の project だけ。
 */
export default function setup() {
  process.env.TZ = "America/New_York";
}
