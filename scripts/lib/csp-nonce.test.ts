import { describe, expect, it } from "vite-plus/test";

import { type CspSample, findCspNonceViolations } from "./csp-nonce";

const EXPECTED_POLICY = "script-src 'nonce-{nonce}' 'strict-dynamic'; object-src 'none'";

function sample(nonce: string, scriptNonces: readonly (string | null)[] = [nonce]): CspSample {
  return {
    policy: `script-src 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'`,
    html: scriptNonces
      .map((value) => (value === null ? "<script>" : `<script nonce="${value}">`))
      .join(""),
  };
}

describe("findCspNonceViolations", () => {
  it("ポリシーが期待の形で、どの <script> もヘッダの nonce を持ち、nonce が応答ごとに違えば違反ゼロ", () => {
    expect(
      findCspNonceViolations([sample("a+/=", ["a+/=", "a+/="]), sample("b")], EXPECTED_POLICY),
    ).toEqual([]);
  });

  it("<script> の属性の並びや nonce 以外の属性に左右されない", () => {
    const html = `<script type="module" async="" src="/a.js" nonce="a"></script><script data-x="" nonce="a">`;
    expect(
      findCspNonceViolations([{ ...sample("a"), html }, sample("b")], EXPECTED_POLICY),
    ).toEqual([]);
  });

  it("ヘッダの欠落を報告する", () => {
    expect(
      findCspNonceViolations([{ policy: null, html: "<script>" }, sample("b")], EXPECTED_POLICY),
    ).toEqual(["応答 1: Content-Security-Policy が欠落"]);
  });

  it("nonce の無いポリシーを報告する", () => {
    const violations = findCspNonceViolations(
      [{ policy: "script-src 'self'", html: "<script>" }, sample("b")],
      EXPECTED_POLICY,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("nonce が無い");
  });

  it("nonce 以外の部分が期待と違うポリシーを、期待と実際の両方を添えて報告する", () => {
    const violations = findCspNonceViolations(
      [{ ...sample("a"), policy: "script-src 'nonce-a'; object-src 'none'" }, sample("b")],
      EXPECTED_POLICY,
    );
    expect(violations).toEqual([
      `応答 1: Content-Security-Policy が期待 "script-src 'nonce-a' 'strict-dynamic'; object-src 'none'" / 実際 "script-src 'nonce-a'; object-src 'none'"`,
    ]);
  });

  it("nonce を持たない <script> と、ヘッダと違う nonce の <script> を報告する", () => {
    const violations = findCspNonceViolations(
      [sample("a", ["a", null, "z"]), sample("b")],
      EXPECTED_POLICY,
    );
    expect(violations).toEqual([
      "応答 1: ヘッダの nonce を持たない <script>: <script>",
      `応答 1: ヘッダの nonce を持たない <script>: <script nonce="z">`,
    ]);
  });

  it("大文字で書いた <SCRIPT> も数え、nonce を持たなければ報告する", () => {
    const html = `<script nonce="a"></script><SCRIPT src="/x.js">`;
    expect(
      findCspNonceViolations([{ ...sample("a"), html }, sample("b")], EXPECTED_POLICY),
    ).toEqual(['応答 1: ヘッダの nonce を持たない <script>: <SCRIPT src="/x.js">']);
  });

  it("<script> が 1 つも無い HTML を報告する", () => {
    // nonce の突き合わせが 0 件のまま通ると、HTML を取り違えても緑になる
    const violations = findCspNonceViolations(
      [{ ...sample("a"), html: "<html></html>" }, sample("b")],
      EXPECTED_POLICY,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("<script> が無く");
  });

  it("応答のあいだで nonce が同じなら報告する", () => {
    expect(findCspNonceViolations([sample("a"), sample("a")], EXPECTED_POLICY)).toEqual([
      "nonce が応答ごとに変わっていない: a, a",
    ]);
  });

  it("応答が 2 件未満なら throw する", () => {
    // 1 件では固定の nonce を見分けられず、違反ゼロで通る
    expect(() => findCspNonceViolations([sample("a")], EXPECTED_POLICY)).toThrow("2 件以上");
  });

  it("期待するポリシーに {nonce} が無ければ throw する", () => {
    expect(() => findCspNonceViolations([sample("a"), sample("b")], "script-src 'self'")).toThrow(
      "{nonce} がありません",
    );
  });
});
