import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { TopNav } from "@/components/top-nav";

export const metadata: Metadata = {
  title: "灵思绘境 - AI 艺术创作平台",
  description: "Inspired Painting - ChatGPT 艺术创作与号池管理",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "灵思绘境",
  },
};

export const viewport: Viewport = {
  themeColor: "#1C1917",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className="antialiased"
        style={{
          fontFamily:
            '"SF Pro Display","SF Pro Text","PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif',
        }}
      >
        <Toaster position="top-center" richColors />
        <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(248,250,253,0.92),_rgba(241,245,249,0.96)_42%,_rgba(226,232,240,0.99)_100%)] px-2 py-2 text-foreground sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-3 sm:gap-5">
            <TopNav />
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
