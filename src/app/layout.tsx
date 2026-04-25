import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  variable: "--font-sans-jp",
  display: "swap"
});

export const metadata: Metadata = {
  title: "LINE投稿 漫画化エージェント",
  description: "LINE投稿から4コマ漫画とA4縦漫画を自動生成するWebアプリ"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={notoSansJp.variable}>
      <body className={notoSansJp.className}>{children}</body>
    </html>
  );
}
