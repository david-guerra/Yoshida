import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cleaner Desk",
  description: "Voice-agent front desk for cleaners — calls, bookings, clients.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-canvas text-label">{children}</body>
    </html>
  );
}
