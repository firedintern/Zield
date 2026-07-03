import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zield | Risk-Aware Yield Vault",
  description: "Automated, risk-adjusted yield optimization on Base. The keeper that doesn't chase raw APY.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col" style={{ background: 'var(--color-void)', color: 'var(--color-snow)' }}>
        <Providers>{children}</Providers>
        <Toaster theme="dark" position="bottom-right" richColors />
      </body>
    </html>
  );
}
