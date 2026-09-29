import { spawn } from "node:child_process";
import { availableParallelism } from "node:os";

import { REPO_ROOT } from "../lib/repo-root.ts";

/**
 * `*.tz.test.ts` を TZ ごとに別のプロセスで走らせる。基準の TZ (`vitest.global-setup.ts`) では
 * `vp test run` が走らせるので、ここでは残りを走らせる。
 *
 * テストの中で `TZ` を変えても、threads と vmThreads の pool では `Date` に効かない
 * (https://vitest.dev/guide/common-errors#time-zone-does-not-change-in-worker-threads)。
 * プロセスごとに決めれば pool を問わず効く。
 *
 * 暦の日付は、`toISOString()` や `new Date("YYYY-MM-DD")` を挟むと、UTC より進んだ TZ か
 * 遅れた TZ のどちらかで 1 日ずれる (ADR-0031 の Context)。両側と日付変更線の際を並べる。
 */
const TIME_ZONES = [
  "UTC",
  // UTC+9
  "Asia/Tokyo",
  // UTC+5:30。時単位でないオフセット
  "Asia/Kolkata",
  // UTC+14。進んだ側の端
  "Pacific/Kiritimati",
  // UTC-11。遅れた側の端
  "Pacific/Pago_Pago",
] as const;

const VP_ARGS = ["test", "run", "--project", "unit", ".tz.test.ts"];

type Run = {
  timeZone: string;
  status: number | null;
  signal: NodeJS.Signals | null;
  output: string;
};

/**
 * 1 つの TZ を走らせ、出力をためて返す。並列に走らせるので、出力を流すと TZ の間で行が混ざる。
 * 各プロセスの worker は 1 本にする。既定の maxWorkers は利用できる並列数を全部使うので、
 * プロセスの数と掛け算になる (vitest docs の guide/improving-performance の VITEST_MAX_WORKERS)
 */
function runTimeZone(timeZone: string): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn("vp", VP_ARGS, {
      cwd: REPO_ROOT,
      env: { ...process.env, TEST_TIME_ZONE: timeZone, VITEST_MAX_WORKERS: "1" },
    });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", reject);
    child.on("close", (status, signal) => {
      resolve({ timeZone, status, signal, output: Buffer.concat(chunks).toString() });
    });
  });
}

// 1 つの TZ で落ちても残りを走らせる。どの TZ で落ちたかの組み合わせ (進んだ側だけ、など) が原因の手がかりになる
const queue: string[] = [...TIME_ZONES];
const failed: Run[] = [];
await Promise.all(
  Array.from({ length: Math.min(availableParallelism(), queue.length) }, async () => {
    for (let timeZone = queue.shift(); timeZone; timeZone = queue.shift()) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- 並列の数を抑えるための逐次。この列が終わってから次の TZ を取る
      const run = await runTimeZone(timeZone);
      if (run.status === 0) {
        console.log(`[time-zones] OK   TEST_TIME_ZONE=${timeZone}`);
      } else {
        console.error(`[time-zones] FAIL TEST_TIME_ZONE=${timeZone}`, {
          status: run.status,
          signal: run.signal,
        });
        failed.push(run);
      }
    }
  }),
);

if (failed.length > 0) {
  for (const run of failed) {
    console.error(`\n[time-zones] TEST_TIME_ZONE=${run.timeZone} の出力:\n${run.output}`);
  }
  console.error(`\n[time-zones] ${failed.length} 個の TZ で失敗した。1 つずつ走らせ直すには:`);
  for (const run of failed) {
    console.error(`  TEST_TIME_ZONE=${run.timeZone} vp ${VP_ARGS.join(" ")}`);
  }
  // `process.exit` は使わない。stderr が pipe のとき書き込みは非同期で、exit が待たずに落とすと
  // 上の再現コマンドが切れる。終了コードだけ立てて自然に終わらせる
  process.exitCode = 1;
}
