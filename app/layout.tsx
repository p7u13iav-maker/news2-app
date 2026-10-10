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

export const metadata: Metadata = {
  title: "毎朝ニュース | サイネージ",
  description:
    "日本の朝のニュース(NHK NEWS WEB の RSS)を、最新10件を10秒間隔のスライドショーで表示するデジタルサイネージ。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-dvh overflow-hidden bg-zinc-950 text-white">
        {children}
      </body>
    </html>
  );
}
