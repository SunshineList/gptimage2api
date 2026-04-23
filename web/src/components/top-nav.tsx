"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import webConfig from "@/constants/common-env";
import { clearStoredAuthKey } from "@/store/auth";
import { cn } from "@/lib/utils";
import { fetchMe, MeResponse } from "@/lib/api";

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    if (pathname !== "/login") {
      fetchMe().then(setMe).catch(() => setMe({ role: "guest" }));
    }
  }, [pathname]);

  const handleLogout = async () => {
    await clearStoredAuthKey();
    router.replace("/login");
  };

  if (pathname === "/login") {
    return null;
  }

  // 根据角色过滤菜单
  const navItems = [
    { href: "/image", label: "画图", roles: ["admin", "user"] },
    { href: "/accounts", label: "号池管理", roles: ["admin"] },
    { href: "/users", label: "用户管理", roles: ["admin"] },
    { href: "/stats", label: "统计面板", roles: ["admin"] },
    { href: "/settings", label: "设置", roles: ["admin"] },
  ].filter((item) => item.roles.includes(me?.role || "user"));

  return (
    <header>
      <div className="flex h-12 items-start justify-between pt-1">
        <div className="flex flex-1 items-center gap-3">
          <Link
            href="/image"
            className="py-2 text-[15px] font-semibold tracking-tight text-stone-950 transition hover:text-stone-700"
          >
            gptimage2api
          </Link>
          {me?.role === "user" && (
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-600">
              剩余额度: {me.quota === -1 ? "无限制" : (me.quota || 0) - (me.used || 0)}
            </span>
          )}
        </div>
        <div className="flex justify-center gap-8">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative py-2 text-[15px] font-medium transition",
                  active ? "font-semibold text-stone-950" : "text-stone-500 hover:text-stone-900",
                )}
              >
                {item.label}
                {active ? <span className="absolute inset-x-0 -bottom-[3px] h-0.5 bg-stone-950" /> : null}
              </Link>
            );
          })}
        </div>
        <div className="flex flex-1 items-center justify-end gap-3">
          <span className="rounded-md bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-500">
            v{webConfig.appVersion}
          </span>
          <button
            type="button"
            className="py-2 text-sm text-stone-400 transition hover:text-stone-700"
            onClick={() => void handleLogout()}
          >
            退出
          </button>
        </div>
      </div>
    </header>
  );
}
