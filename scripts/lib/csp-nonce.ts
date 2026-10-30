/** 同じ URL を取得した 1 回分の応答 */
export interface CspSample {
  /** `Content-Security-Policy` の値。ヘッダが無ければ null */
  readonly policy: string | null;
  readonly html: string;
}

const NONCE_PLACEHOLDER = "{nonce}";
const NONCE_SOURCE = /'nonce-([^']+)'/;
const SCRIPT_TAG = /<script\b[^>]*>/g;
const NONCE_ATTRIBUTE = /\snonce="([^"]*)"/;

/**
 * nonce を使う CSP が応答に乗り、HTML の `<script>` に届いているかを突き合わせ、違反を人が読める形で返す。
 *
 * 見ることは 3 つある。ポリシーが `expectedPolicy` の `{nonce}` を nonce に置き換えた値と一致すること、
 * HTML のすべての `<script>` がヘッダと同じ nonce を持つこと、nonce が応答ごとに違うこと。
 *
 * 応答が 2 件未満のときは throw する。1 件では nonce が応答ごとに変わることを確かめられず、
 * 固定の nonce が違反ゼロで通る。
 *
 * @param samples 同じ URL を別々に取得した応答。2 件以上が要る
 * @param expectedPolicy 期待するポリシー。nonce の位置に `{nonce}` を書く
 */
export function findCspNonceViolations(
  samples: readonly CspSample[],
  expectedPolicy: string,
): string[] {
  if (samples.length < 2) {
    throw new Error(
      "findCspNonceViolations: nonce が応答ごとに変わるかを見るには応答が 2 件以上要ります",
    );
  }
  if (!expectedPolicy.includes(NONCE_PLACEHOLDER)) {
    throw new Error(`findCspNonceViolations: 期待するポリシーに ${NONCE_PLACEHOLDER} がありません`);
  }

  const violations: string[] = [];
  const nonces: string[] = [];
  for (const [index, { policy, html }] of samples.entries()) {
    const label = `応答 ${(index + 1).toString()}`;
    if (policy === null) {
      violations.push(`${label}: Content-Security-Policy が欠落`);
      continue;
    }
    const nonce = NONCE_SOURCE.exec(policy)?.[1];
    if (nonce === undefined) {
      violations.push(`${label}: Content-Security-Policy に nonce が無い "${policy}"`);
      continue;
    }
    nonces.push(nonce);

    const expected = expectedPolicy.replace(NONCE_PLACEHOLDER, nonce);
    if (policy !== expected) {
      violations.push(`${label}: Content-Security-Policy が期待 "${expected}" / 実際 "${policy}"`);
    }

    const scripts = html.match(SCRIPT_TAG) ?? [];
    if (scripts.length === 0) {
      violations.push(`${label}: HTML に <script> が無く、nonce が届いているかを確かめられない`);
    }
    for (const tag of scripts) {
      const found = NONCE_ATTRIBUTE.exec(tag)?.[1];
      if (found !== nonce) {
        violations.push(`${label}: ヘッダの nonce を持たない <script>: ${tag}`);
      }
    }
  }

  if (nonces.length >= 2 && new Set(nonces).size < nonces.length) {
    violations.push(`nonce が応答ごとに変わっていない: ${nonces.join(", ")}`);
  }
  return violations;
}
