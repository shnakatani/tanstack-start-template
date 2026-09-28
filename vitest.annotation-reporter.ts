import type { Reporter, TestCase } from "vite-plus/test/node";

import { describeAnnotations } from "./scripts/lib/annotation-lines";

/**
 * 落ちなかったテストの注釈を端末に出す。`default` と `minimal` の reporter は、落ちたテストの
 * 注釈しか出さない。通ったテストの注釈を出す端末の reporter は `verbose` だけで、`verbose` は
 * 全テストを 1 行ずつ出す (vitest docs の guide/test-annotations)。
 *
 * 落ちたテストの注釈は `default` が出すので、ここでは出さない。
 *
 * `verbose` に替えず、`DefaultReporter` も継承しない。`verbose` は通ったテストを全件並べ、
 * 組み込みの reporter の継承は minor 更新で形が変わりうる (vitest docs の guide/advanced/reporters の warning)。
 * ここで使うのは公開の `Reporter` の hook と `TestCase` の API だけにする
 */
export class PassedTestAnnotationReporter implements Reporter {
  onTestCaseResult(testCase: TestCase): void {
    if (testCase.result().state === "failed") return;
    const lines = describeAnnotations(
      {
        moduleId: testCase.module.moduleId,
        fullName: testCase.fullName,
        annotations: testCase.annotations(),
      },
      testCase.project.config.root,
    );
    if (lines.length > 0) console.log(lines.join("\n"));
  }
}
