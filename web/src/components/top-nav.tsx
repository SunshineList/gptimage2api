"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import webConfig from "@/constants/common-env";
import { clearStoredAuthKey } from "@/store/auth";
import { cn } from "@/lib/utils";
import { fetchMe, MeResponse } from "@/lib/api";

import { Menu, X, LogOut, Sparkles } from "lucide-react";

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const loadMe = async () => {
      try {
        const data = await fetchMe();
        setMe(data);
      } catch (error) {
        // Not logged in or error
      }
    };
    void loadMe();
  }, []);

  // 关闭菜单当路由变化时
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await clearStoredAuthKey();
    router.replace("/login");
  };

  if (pathname === "/login") {
    return null;
  }

  const navItems = [
    { href: "/image", label: "画图", roles: ["admin", "user"] },
    { href: "/gallery", label: "画廊", roles: ["admin", "user"] },
    { href: "/plaza", label: "广场", roles: ["admin", "user", "guest"] },
    { href: "/accounts", label: "号池管理", roles: ["admin"] },
    { href: "/users", label: "用户管理", roles: ["admin"] },
    { href: "/stats", label: "统计面板", roles: ["admin"] },
    { href: "/settings", label: "设置", roles: ["admin"] },
  ].filter((item) => item.roles.includes(me?.role || "guest"));

  return (
    <header className="relative z-50">
      <div className="flex h-14 items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          <Link
            href="/image"
            className="group flex items-center gap-2.5 py-2 transition-all"
          >
            <div className="flex size-8 items-center justify-center rounded-xl bg-stone-950 text-white shadow-lg shadow-stone-200 transition-transform group-hover:scale-105 sm:size-9">
              <Sparkles className="size-4 sm:size-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="bg-gradient-to-br from-stone-950 via-stone-800 to-stone-600 bg-clip-text text-[18px] font-bold tracking-tight text-transparent">
                  灵思绘境
                </span>
                <span className="mb-1 size-1 rounded-full bg-stone-950" />
              </div>
              <span className="text-[9px] font-medium tracking-[0.25em] text-stone-400 uppercase leading-none">
                Inspired Painting
              </span>
            </div>
          </Link>
          {me?.role === "user" && (
            <span className="hidden rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-600 sm:inline-block">
              剩余额度: {me.quota === -1 ? "无限制" : (me.quota || 0) - (me.used || 0)}
            </span>
          )}
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden justify-center gap-4 md:flex lg:gap-6">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative py-2 text-[14px] font-medium transition",
                  active ? "font-semibold text-stone-950" : "text-stone-500 hover:text-stone-900",
                )}
              >
                {item.label}
                {active ? <span className="absolute inset-x-0 -bottom-[1px] h-0.5 bg-stone-950" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-end gap-2 sm:gap-3">
          <span className="hidden rounded-md bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-500 sm:inline-block">
            v{webConfig.appVersion}
          </span>
          <button
            type="button"
            className="hidden py-2 text-sm text-stone-400 transition hover:text-stone-700 md:block"
            onClick={() => void handleLogout()}
          >
            退出
          </button>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-xl bg-stone-100 text-stone-600 md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 top-14 z-40 bg-white/95 backdrop-blur-md md:hidden">
          <nav className="flex max-h-[calc(100vh-3.5rem)] flex-col overflow-y-auto p-6 pb-12">
            {me?.role === "user" && (
              <div className="mb-6 rounded-2xl bg-stone-50 p-4">
                <div className="text-xs text-stone-400 uppercase tracking-wider mb-1">我的额度</div>
                <div className="text-lg font-semibold text-stone-900">
                  {me.quota === -1 ? "无限制" : (me.quota || 0) - (me.used || 0)}
                </div>
              </div>
            )}
            <div className="space-y-1">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center rounded-xl px-4 py-2.5 text-[15px] font-medium transition-all",
                      active ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="mt-8 border-t border-stone-100 pt-6">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-[16px] font-medium text-rose-500 hover:bg-rose-50"
                onClick={() => void handleLogout()}
              >
                <LogOut className="size-5" />
                退出登录
              </button>
              <div className="mt-4 px-4 text-xs text-stone-400">
                当前版本 v{webConfig.appVersion}
              </div>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

