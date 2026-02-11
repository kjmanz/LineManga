import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LINE投稿 漫画化エージェント",
  description: "LINE投稿から4コマ漫画とA4縦漫画を自動生成するWebアプリ"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
