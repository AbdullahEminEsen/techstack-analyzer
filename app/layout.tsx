import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tech Stack Analyzer",
  description: "Bir web sitesinin teknoloji altyapısını analiz et",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
