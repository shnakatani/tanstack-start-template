import { relative } from "node:path";

import type { TestAnnotation } from "vite-plus/test";

/** 注釈を出すテスト 1 件。reporter の `TestCase` から読む値だけを持つ */
export interface AnnotatedTest {
  moduleId: string;
  fullName: string;
  annotations: ReadonlyArray<Pick<TestAnnotation, "type" | "message" | "location">>;
}

/**
 * テスト 1 件の注釈を、端末に出す行にする。形は verbose reporter の注釈の出力に揃える
 * (vitest docs の guide/test-annotations の verbose)。パスは `root` からの相対にする
 */
export function describeAnnotations(test: AnnotatedTest, root: string): string[] {
  if (test.annotations.length === 0) return [];
  const modulePath = relative(root, test.moduleId);
  return [
    `✓ ${modulePath} > ${test.fullName}`,
    ...test.annotations.flatMap(({ type, message, location }) => {
      const place = location
        ? `${relative(root, location.file)}:${location.line}:${location.column}`
        : modulePath;
      const body = message.split("\n").map((line, i) => `${i === 0 ? "    ↳ " : "      "}${line}`);
      return [`  ❯ ${place} ${type}`, ...body];
    }),
  ];
}
