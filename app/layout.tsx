import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  title: "키워드머니 - 돈이 되는 키워드 AI",
  description:
    "네이버 블로거를 위한 수익성 키워드 분석 도구. AI가 검색량, CPC, 경쟁도를 분석해 수익 가능성이 높은 키워드를 찾아드립니다.",
  keywords: [
    "키워드 분석",
    "네이버 블로그",
    "SEO",
    "키워드 수익성",
    "블로그 수익화",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
