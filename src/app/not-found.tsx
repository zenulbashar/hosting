import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="flex items-center gap-5">
        <span className="text-4xl font-bold">404</span>
        <span className="h-12 w-px bg-edge-strong" />
        <div className="text-left">
          <h1 className="font-medium">Page not found</h1>
          <p className="mt-1 max-w-sm text-sm text-fg-muted">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>
      </div>
      <Link
        href="/dashboard"
        className="mt-10 text-sm text-[#52a8ff] underline-offset-4 hover:underline"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
