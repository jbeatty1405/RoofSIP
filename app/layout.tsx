import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_DESC =
  "RoofSIP watches your not-ready roofs for storms. When one hits, it texts the homeowner, books the inspection, and drops it on your calendar. You just show up.";

export const metadata: Metadata = {
  metadataBase: new URL("https://roofsip.vercel.app"),
  title: "RoofSIP",
  description: SITE_DESC,
  openGraph: {
    title: "Storm hits. RoofSIP texts. You get the job.",
    description: SITE_DESC,
    url: "https://roofsip.vercel.app",
    siteName: "RoofSIP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Storm hits. RoofSIP texts. You get the job.",
    description: SITE_DESC,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-200">{children}</body>
    </html>
  );
}
