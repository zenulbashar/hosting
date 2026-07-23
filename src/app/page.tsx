import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui";

const FEATURES = [
  {
    title: "Always-on AI agents",
    description:
      "Deploy long-running agents built with the Claude Agent SDK, LangGraph or FastAPI. Zale keeps them online with health checks and restarts.",
    icon: "M12 2a2 2 0 012 2v2h3a2 2 0 012 2v3h2v4h-2v3a2 2 0 01-2 2H7a2 2 0 01-2-2v-3H3v-4h2V8a2 2 0 012-2h3V4a2 2 0 012-2zM9 11h.01M15 11h.01M9 15h6",
  },
  {
    title: "Sydney-first hosting",
    description:
      "Our home region is syd1 in Sydney — single-digit millisecond latency for ANZ users and data that stays in Australia.",
    icon: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2",
  },
  {
    title: "Git-connected deploys",
    description:
      "Push to your repository and Zale builds, deploys and promotes automatically. Every branch gets its own preview URL.",
    icon: "M6 3v12M6 15a3 3 0 103 3M6 15a9 9 0 009-9 3 3 0 10-3-3",
  },
  {
    title: "Instant global edge",
    description:
      "Static assets and rendered pages are served from the region closest to your visitors — no configuration required.",
    icon: "M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2c3 3 4 6.5 4 10s-1 7-4 10c-3-3-4-6.5-4-10s1-7 4-10z",
  },
  {
    title: "Zero-config frameworks",
    description:
      "Next.js, Vite, Astro, SvelteKit, Remix, Nuxt and plain HTML are detected and built with sensible defaults.",
    icon: "M13 2L3 14h7l-1 8 11-13h-7l0.5-7z",
  },
  {
    title: "Live build logs",
    description:
      "Watch every install, compile and upload step stream in real time. Debug failed builds without leaving the dashboard.",
    icon: "M4 5h16M4 12h10M4 19h7",
  },
  {
    title: "Custom domains & TLS",
    description:
      "Bring your own domain, verify DNS in one click, and certificates are issued and renewed for you.",
    icon: "M12 2l7 4v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-4z",
  },
  {
    title: "Instant rollback",
    description:
      "Every deployment is immutable. Promote any previous build back to production in one click — no rebuild, no downtime.",
    icon: "M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8M3 3v5h5",
  },
  {
    title: "Environment variables",
    description:
      "Scope secrets to production, preview or development. Values are encrypted at rest and injected at build time.",
    icon: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.7 5.7L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.6a1 1 0 01.3-.7l5.9-5.9A6 6 0 1121 9z",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-forest-edge bg-forest/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-fg-muted md:flex">
            <a href="#features" className="hover:text-fg transition-colors">Features</a>
            <a href="#how" className="hover:text-fg transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-fg transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <ButtonLink href="/login" variant="ghost" size="sm">
              Log In
            </ButtonLink>
            <ButtonLink href="/signup" size="sm">
              Sign Up
            </ButtonLink>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="hero-grid absolute inset-0" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-24 text-center md:pt-32">
            <p className="mx-auto mb-6 w-fit rounded-full border border-edge-strong bg-surface px-4 py-1.5 text-[13px] text-fg-muted">
              Now in private beta — Sydney (syd1) datacenter coming soon 🇦🇺
            </p>
            <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
              Deploy at the speed of thought.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-fg-muted">
              Zale is the platform for websites and always-on AI agents.
              Connect a repository, push your code, and ship to Sydney and the
              global edge in seconds.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <ButtonLink href="/signup" size="lg">
                Start Deploying
              </ButtonLink>
              <ButtonLink href="/login" variant="secondary" size="lg">
                Live Demo
              </ButtonLink>
            </div>

            {/* Terminal mock */}
            <div className="mx-auto mt-20 max-w-2xl overflow-hidden rounded-xl border border-edge bg-[#0d0d0f] text-left shadow-2xl shadow-black/60">
              <div className="flex items-center gap-1.5 border-b border-edge px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                <span className="ml-3 text-xs text-fg-faint">terminal</span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-fg-muted">
{`$ git push origin main
`}<span className="text-fg">Zale</span>{` detected push to `}<span className="text-fg">main</span>{`
⚡ Building in Sydney, Australia (syd1)...
✓ Compiled successfully in 14s
✓ Agent online — health check passed
`}<span className="text-success">✓ Deployed to production</span>{`
→ `}<span className="text-[#52a8ff]">https://your-agent.zale.app</span>
              </pre>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-edge">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <h2 className="text-center text-3xl font-semibold tracking-tight md:text-4xl">
              Everything you need to ship
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-fg-muted">
              From first commit to global scale, without touching a server.
            </p>
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border border-edge bg-surface p-6 transition-colors hover:border-edge-strong"
                >
                  <svg
                    className="mb-4 h-6 w-6 text-fg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={f.icon} />
                  </svg>
                  <h3 className="font-medium">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-fg-muted">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-t border-edge">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <h2 className="text-center text-3xl font-semibold tracking-tight md:text-4xl">
              Ship in three steps
            </h2>
            <div className="mt-14 grid gap-10 md:grid-cols-3">
              {[
                ["01", "Import your repository", "Point Zale at any git repository. We detect your framework and configure the build for you."],
                ["02", "Push your code", "Every push builds automatically. Production branches promote on success; other branches get preview URLs."],
                ["03", "Scale globally", "Your site is distributed to edge regions worldwide with TLS, custom domains and instant rollbacks."],
              ].map(([step, title, body]) => (
                <div key={step}>
                  <div className="font-mono text-sm text-fg-faint">{step}</div>
                  <h3 className="mt-3 text-lg font-medium">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-fg-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-t border-edge">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <h2 className="text-center text-3xl font-semibold tracking-tight md:text-4xl">
              Simple pricing
            </h2>
            <div className="mx-auto mt-14 grid max-w-4xl gap-5 md:grid-cols-3">
              {[
                {
                  name: "Hobby",
                  price: "$0",
                  tagline: "For personal projects",
                  features: ["Unlimited deployments", "100 GB bandwidth", "Preview environments", "Community support"],
                  cta: "Start for Free",
                  highlight: false,
                },
                {
                  name: "Pro",
                  price: "$20",
                  tagline: "Per member / month",
                  features: ["Everything in Hobby", "1 TB bandwidth", "Custom domains + TLS", "Concurrent builds", "Email support"],
                  cta: "Start Free Trial",
                  highlight: true,
                },
                {
                  name: "Enterprise",
                  price: "Custom",
                  tagline: "For large teams",
                  features: ["Everything in Pro", "Dedicated infrastructure", "99.99% SLA", "SSO / SAML", "24×7 support"],
                  cta: "Contact Sales",
                  highlight: false,
                },
              ].map((tier) => (
                <div
                  key={tier.name}
                  className={`flex flex-col rounded-xl border p-6 ${
                    tier.highlight ? "border-fg/60 bg-surface" : "border-edge bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{tier.name}</h3>
                    {tier.highlight && (
                      <span className="rounded-full bg-fg px-2.5 py-0.5 text-xs font-medium text-background">
                        Popular
                      </span>
                    )}
                  </div>
                  <div className="mt-4 text-3xl font-semibold">{tier.price}</div>
                  <div className="text-sm text-fg-faint">{tier.tagline}</div>
                  <ul className="mt-5 flex-1 space-y-2.5 text-sm text-fg-muted">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5">
                        <svg className="h-4 w-4 shrink-0 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <ButtonLink
                    href="/signup"
                    variant={tier.highlight ? "primary" : "secondary"}
                    className="mt-6 w-full"
                  >
                    {tier.cta}
                  </ButtonLink>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-edge">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-10 text-sm text-fg-faint">
          <Logo />
          <p>© 2026 Zale Hosting. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-fg transition-colors">Log In</Link>
            <Link href="/signup" className="hover:text-fg transition-colors">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
