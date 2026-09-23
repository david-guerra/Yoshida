import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yoshida — Caller",
  description: "Eine Reinigung. Ein Gespräch. Ihre Reinigungsanfrage mit Yoshida.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
