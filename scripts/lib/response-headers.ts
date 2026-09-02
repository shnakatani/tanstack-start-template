/** 実レスポンスに乗っていることを求めるヘッダ 1 件 */
export interface ExpectedHeader {
  readonly name: string;
  readonly value: string;
}

/**
 * 期待するヘッダが実レスポンスに乗っているかを突き合わせ、違反を人が読める形で返す。
 *
 * 期待が空のときは throw する。空を許すと「1 件も検査していない」状態が違反ゼロと
 * 見分けられなくなり、走査対象を取り違えたまま緑になる。
 *
 * @param actual レスポンスヘッダ。名前の大文字小文字は問わない
 * @param expected 期待するヘッダ。1 件以上が要る
 */
export function findHeaderViolations(
  actual: Readonly<Record<string, string>>,
  expected: readonly ExpectedHeader[],
): string[] {
  if (expected.length === 0) {
    throw new Error("findHeaderViolations: 期待するヘッダが空です");
  }

  const received = new Map(
    Object.entries(actual).map(([name, value]) => [name.toLowerCase(), value]),
  );

  const violations: string[] = [];
  for (const { name, value } of expected) {
    const found = received.get(name.toLowerCase());
    if (found === undefined) {
      violations.push(`${name}: 欠落`);
    } else if (found !== value) {
      violations.push(`${name}: 期待 "${value}" / 実際 "${found}"`);
    }
  }
  return violations;
}
