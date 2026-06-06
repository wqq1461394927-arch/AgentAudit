import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "CeatDAO | Bug Bounty Platform",
  description: "Decentralized Bug Bounty Audit Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
