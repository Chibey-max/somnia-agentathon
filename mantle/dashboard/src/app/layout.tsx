import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/shared/Providers";
import { Navbar } from "@/components/shared/Navbar";

export const metadata: Metadata = {
  title: "Mantle Agent Kit — Agentic Wallet Economy",
  description:
    "The first verifiable AI agent wallet economy on Mantle — autonomous, policy-enforced, ERC-8004 identity-native",
  keywords: ["Mantle", "AI agent", "DeFi", "wallet", "MNT", "mETH", "ERC-8004"],
  themeColor: "#0a0a0f",
  openGraph: {
    title: "Mantle Agent Kit",
    description: "Autonomous AI agent wallet on Mantle",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-mantle-dark min-h-screen font-sans antialiased">
        {/* Ambient background gradients */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 20% 0%, rgba(0,212,170,0.06) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(124,58,237,0.06) 0%, transparent 60%)",
          }}
        />
        {/* Grid background */}
        <div className="fixed inset-0 grid-bg pointer-events-none opacity-50" />

        <Providers>
          <div className="relative z-10 flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1 pt-16">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
