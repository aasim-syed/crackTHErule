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

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";
const description = "A secret rule controls the door. Race an AI to figure it out, then make a rule to stump your friends.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Crack the Rule",
  description,
  openGraph: { title: "Crack the Rule: can you out-think an AI?", description, siteName: "Crack the Rule", type: "website" },
  twitter: { card: "summary_large_image", title: "Crack the Rule: can you out-think an AI?", description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
