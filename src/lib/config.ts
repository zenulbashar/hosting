/**
 * Platform identity and ingress configuration.
 *
 * The deployment domain is the one value that genuinely varies per environment
 * (dev, staging, the real Zale edge), so it is read from the environment with a
 * sensible default. `NEXT_PUBLIC_` prefix so client components (which render
 * deployment URLs and DNS instructions) get it inlined at build time.
 */
export const APP_NAME = "Zale";

/** Base domain deployments are served under, e.g. `<slug>.zale.app`. */
export const APP_DOMAIN = process.env.NEXT_PUBLIC_ZALE_APP_DOMAIN ?? "zale.app";

/** CNAME target given to customers configuring a custom domain. */
export const CNAME_TARGET = `cname.${APP_DOMAIN}`;

/** A-record target given to customers configuring a custom domain. */
export const INGRESS_IP = process.env.NEXT_PUBLIC_ZALE_INGRESS_IP ?? "76.223.87.10";

/**
 * Platform operators, by email (comma-separated in ZALE_ADMIN_EMAILS). Only
 * these accounts may mutate global infrastructure state such as region health —
 * an ordinary tenant must never be able to mark the edge down. Server-only:
 * the variable has no NEXT_PUBLIC_ prefix, so it is empty in client bundles and
 * `isAdmin` is always false there (admin UI is gated by a server-passed prop).
 */
const ADMIN_EMAILS = (process.env.ZALE_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdmin(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}
