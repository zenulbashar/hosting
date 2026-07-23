import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Zale — Deploy at the speed of thought",
    template: "%s — Zale",
  },
  description:
    "Zale is the platform for frontend developers. Build, preview and ship every project from git push to global edge.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
