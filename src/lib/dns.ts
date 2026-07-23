/**
 * Real custom-domain verification via live DNS lookups.
 *
 * A domain is considered verified when the owner has proven either:
 *   1. Control — a TXT record `_zale-challenge.<domain>` whose value is the
 *      per-domain challenge `zale-verify=<token>`, or
 *   2. Routing — the domain already points at our edge: an A record equal to
 *      the ingress IP, or a CNAME to our target.
 *
 * The network-facing lookup and the pure decision are split: `decideVerification`
 * takes already-resolved records so the matching rules are unit-testable without
 * touching DNS, and `verifyDomainDns` accepts an injectable resolver so tests can
 * drive both branches deterministically. Missing records are a normal
 * "not verified yet" outcome (DNS may not have propagated), never an error.
 */
import { CNAME_TARGET, INGRESS_IP } from "./config";

/** The TXT hostname a domain owner adds to prove control. */
export function challengeHost(domain: string): string {
  return `_zale-challenge.${domain}`;
}

/** The exact TXT value expected at the challenge host. */
export function challengeValue(token: string): string {
  return `zale-verify=${token}`;
}

export type DnsResolver = {
  resolveTxt(host: string): Promise<string[][]>;
  resolve4(host: string): Promise<string[]>;
  resolveCname(host: string): Promise<string[]>;
};

/** Node's DNS resolver, loaded lazily so this module stays importable in any
 *  runtime; only the live path (server route) actually touches the network. */
async function nodeResolver(): Promise<DnsResolver> {
  const { promises: dns } = await import("node:dns");
  return {
    resolveTxt: (h) => dns.resolveTxt(h),
    resolve4: (h) => dns.resolve4(h),
    resolveCname: (h) => dns.resolveCname(h),
  };
}

/** A missing/NXDOMAIN record is a normal negative result, not a failure. */
async function safe<T>(p: Promise<T[]>): Promise<T[]> {
  try {
    return await p;
  } catch {
    return [];
  }
}

const normalizeHost = (h: string) => h.replace(/\.$/, "").toLowerCase();

export type VerificationMethod = "txt" | "a-record" | "cname";

export type VerificationChecks = {
  txtHost: string;
  txtExpected: string;
  txtFound: string[];
  aRecords: string[];
  cnames: string[];
  expectedIp: string;
  expectedCname: string;
};

export type VerificationResult = {
  verified: boolean;
  method: VerificationMethod | null;
  checks: VerificationChecks;
};

/** Pure matcher — decides verification from already-resolved records. */
export function decideVerification(args: {
  token: string;
  txtRecords: string[];
  aRecords: string[];
  cnames: string[];
}): { verified: boolean; method: VerificationMethod | null } {
  const expectedTxt = challengeValue(args.token);
  if (args.txtRecords.some((r) => r.trim() === expectedTxt)) {
    return { verified: true, method: "txt" };
  }
  if (args.aRecords.includes(INGRESS_IP)) {
    return { verified: true, method: "a-record" };
  }
  const target = normalizeHost(CNAME_TARGET);
  if (args.cnames.some((c) => normalizeHost(c) === target)) {
    return { verified: true, method: "cname" };
  }
  return { verified: false, method: null };
}

/** Live DNS check. Resolves the three record types in parallel and applies the
 *  pure matcher. `resolver` is injectable for tests. */
export async function verifyDomainDns(
  domain: string,
  token: string,
  resolver?: DnsResolver
): Promise<VerificationResult> {
  const r = resolver ?? (await nodeResolver());
  const host = challengeHost(domain);
  const [txtRaw, aRecords, cnames] = await Promise.all([
    safe(r.resolveTxt(host)),
    safe(r.resolve4(domain)),
    safe(r.resolveCname(domain)),
  ]);
  // resolveTxt returns string[][] — each record may arrive as multiple chunks.
  const txtRecords = txtRaw.map((chunks) => chunks.join(""));
  const { verified, method } = decideVerification({ token, txtRecords, aRecords, cnames });
  return {
    verified,
    method,
    checks: {
      txtHost: host,
      txtExpected: challengeValue(token),
      txtFound: txtRecords,
      aRecords,
      cnames,
      expectedIp: INGRESS_IP,
      expectedCname: CNAME_TARGET,
    },
  };
}
