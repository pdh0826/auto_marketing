import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blog Growth Agent",
  description: "Blogger content planning, quality checking, and scheduled publishing platform"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
