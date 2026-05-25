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
    { href: "/", label: "生图大厅", roles: ["admin", "user", "guest"] },
    { href: "/image", label: "画图后台", roles: ["admin", "user"] },
    { href: "/gallery", label: "我的画廊", roles: ["admin", "user"] },
    { href: "/plaza", label: "创作广场", roles: ["admin", "user", "guest"] },
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
            href={me ? "/image" : "/"}
            className="group flex items-center gap-2.5 py-2 transition-all"
          >
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/10 transition-transform group-hover:scale-105 sm:size-9">
              <Sparkles className="size-4 sm:size-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="bg-gradient-to-br from-foreground via-primary to-primary/80 bg-clip-text text-[18px] font-bold tracking-tight text-transparent">
                  灵思绘境
                </span>
                <span className="mb-1 size-1 rounded-full bg-primary" />
              </div>
              <span className="text-[9px] font-medium tracking-[0.25em] text-muted-foreground uppercase leading-none">
                Inspired Painting
              </span>
            </div>
          </Link>
          {me?.role === "user" && (
            <span className="hidden rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-secondary-foreground sm:inline-block">
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
                  active ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                {active ? <span className="absolute inset-x-0 -bottom-[1px] h-0.5 bg-primary" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-end gap-2 sm:gap-3">
          <span className="hidden rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground sm:inline-block">
            v{webConfig.appVersion}
          </span>
          {me ? (
            <button
              type="button"
              className="hidden py-2 text-sm text-muted-foreground transition hover:text-foreground md:block"
              onClick={() => void handleLogout()}
            >
              退出
            </button>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-xl bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary/95 md:block"
            >
              立即登录
            </Link>
          )}

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-xl bg-secondary text-secondary-foreground md:hidden"
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
              <div className="mb-6 rounded-2xl bg-secondary p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">我的额度</div>
                <div className="text-lg font-semibold text-foreground">
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
                      active ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="mt-8 border-t border-secondary pt-6">
              {me ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-[16px] font-medium text-rose-500 hover:bg-rose-50"
                  onClick={() => void handleLogout()}
                >
                  <LogOut className="size-5" />
                  退出登录
                </button>
              ) : (
                <Link
                  href="/login"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-[16px] font-semibold text-white shadow-sm hover:bg-primary/95"
                >
                  立即登录
                </Link>
              )}
              <div className="mt-4 px-4 text-xs text-muted-foreground">
                当前版本 v{webConfig.appVersion}
              </div>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
