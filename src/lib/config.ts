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
