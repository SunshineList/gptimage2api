"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Clock, Coins, ImageIcon, ArrowRight, LoaderCircle } from "lucide-react";
import { getStoredAuthKey } from "@/store/auth";
import { fetchMe, fetchPlaza, fetchAccounts, type PlazaPost, type MeResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function HomePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [posts, setPosts] = useState<PlazaPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [realStats, setRealStats] = useState({
    totalQuota: 0,
    totalWorks: 0,
  });

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const key = await getStoredAuthKey();
        if (key) {
          try {
            const userData = await fetchMe();
            setMe(userData);
            if (userData.role === "admin") {
              try {
                const accounts = await fetchAccounts();
                const sum = accounts.items.reduce((s, a) => s + (a.quota || 0), 0);
                setRealStats((prev) => ({ ...prev, totalQuota: sum }));
              } catch {
                // non-admin can't fetch accounts
              }
            }
          } catch {
            // token invalid, stay as guest
          }
        }
        try {
          const plaza = await fetchPlaza();
          if (plaza?.items) {
            setPosts(plaza.items);
            setRealStats((prev) => ({ ...prev, totalWorks: plaza.items.length }));
          }
        } catch {
          // plaza may require auth
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };
    void init();
  }, []);

  const handleCopyPrompt = useCallback((prompt: string) => {
    void navigator.clipboard.writeText(prompt);
    toast.success("提示词已复制");
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:px-8">
      {/* Hero */}
      <div className="mb-10 text-center sm:mb-14">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary/10 via-accent to-primary/10 px-4 py-1.5 text-[11px] font-semibold tracking-widest text-primary uppercase">
          <Sparkles className="size-3" />
          AI 图像实验室
        </span>
        <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          创意灵感画廊
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          探索 AI 生成的精彩作品。登录后即可开始创作，体验实时生图。
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          {me ? (
            <Button
              className="rounded-2xl bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 hover:shadow-xl"
              onClick={() => router.push("/image")}
            >
              开始创作
              <ArrowRight className="ml-1.5 size-4" />
            </Button>
          ) : (
            <Button
              className="rounded-2xl bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 hover:shadow-xl"
              onClick={() => router.push("/login")}
            >
              立即登录
              <ArrowRight className="ml-1.5 size-4" />
            </Button>
          )}
          <Button
            variant="outline"
            className="rounded-2xl border-border/80 bg-card px-6 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition hover:bg-secondary hover:text-foreground"
            onClick={() => router.push("/plaza")}
          >
            浏览广场
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Card className="soft-gradient border-border/40 p-4 shadow-sm transition-all hover:shadow-md sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 sm:size-10">
              <Coins className="size-4 text-primary sm:size-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-muted-foreground">可用额度</div>
              <div className="text-lg font-bold text-foreground sm:text-xl">
                {me?.role === "admin" ? "无限制" : me ? ((me.quota === -1 ? "无限" : (me.quota || 0) - (me.used || 0))) : "--"}
              </div>
            </div>
          </div>
        </Card>

        <Card className="soft-gradient border-border/40 p-4 shadow-sm transition-all hover:shadow-md sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 sm:size-10">
              <ImageIcon className="size-4 text-emerald-600 sm:size-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-muted-foreground">广场作品</div>
              <div className="text-lg font-bold text-foreground sm:text-xl">{realStats.totalWorks}</div>
            </div>
          </div>
        </Card>

        {me?.role === "admin" && (
          <Card className="soft-gradient border-border/40 p-4 shadow-sm transition-all hover:shadow-md sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 sm:size-10">
                <Coins className="size-4 text-amber-600 sm:size-5" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-muted-foreground">总额度池</div>
                <div className="text-lg font-bold text-foreground sm:text-xl">{realStats.totalQuota.toLocaleString()}</div>
              </div>
            </div>
          </Card>
        )}

        <Card className="soft-gradient border-border/40 p-4 shadow-sm transition-all hover:shadow-md sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-violet-500/10 sm:size-10">
              <Clock className="size-4 text-violet-600 sm:size-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-muted-foreground">状态</div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                服务运行中
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Gallery Header */}
      <div className="mb-6 flex items-center justify-between border-b border-border/60 pb-4">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground sm:text-xl">
          <Sparkles className="size-4 text-primary sm:size-5" />
          灵感画廊
        </h2>
        {me && (
          <Button
            className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary/90 sm:text-sm"
            onClick={() => router.push("/image")}
          >
            开始创作
            <ArrowRight className="ml-1 size-3.5" />
          </Button>
        )}
      </div>

      {/* Gallery Grid */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <LoaderCircle className="size-8 animate-spin text-primary/60" />
        </div>
      ) : posts.length === 0 ? (
        <Card className="flex h-48 flex-col items-center justify-center gap-3 border-dashed border-border/80 bg-secondary/30 sm:h-64">
          <ImageIcon className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">暂无发布的作品，去生图后台开始创作吧</p>
          {me && (
            <Button
              variant="outline"
              className="rounded-xl border-border/80 text-xs"
              onClick={() => router.push("/image")}
            >
              前往创作
              <ArrowRight className="ml-1 size-3" />
            </Button>
          )}
        </Card>
      ) : (
        <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4">
          {posts.map((post) => (
            <Card
              key={post.id}
              className="mb-5 break-inside-avoid overflow-hidden border-border/40 bg-card shadow-sm ring-1 ring-border/20 transition-all hover:shadow-md hover:ring-primary/10"
            >
              <div className="group relative overflow-hidden bg-secondary/50">
                <img
                  src={post.image_url}
                  alt={post.prompt}
                  className="h-auto w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                {me && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/30 group-hover:opacity-100">
                    <button
                      type="button"
                      className="inline-flex size-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition hover:bg-white/35"
                      onClick={() => handleCopyPrompt(post.prompt)}
                      aria-label="复制提示词"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                  </div>
                )}
              </div>
              {me && (
                <div className="border-t border-border/30 bg-secondary/30 p-3 sm:p-4">
                  <p className="text-xs leading-relaxed text-foreground/80 italic line-clamp-2">
                    &ldquo;{post.prompt}&rdquo;
                  </p>
                  <div className="mt-3 flex items-center justify-between border-t border-border/20 pt-3">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {post.user_nickname}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {post.model}
                    </span>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Guest overlay for unauthenticated users who can see blurred images */}
      {!me && posts.length > 0 && (
        <div className="mt-6 flex flex-col items-center gap-4 rounded-3xl bg-gradient-to-b from-transparent via-background to-background p-8 text-center">
          <p className="text-sm text-muted-foreground">登录后查看完整画廊并开始创作</p>
          <Button
            className="rounded-2xl bg-primary px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90"
            onClick={() => router.push("/login")}
          >
            立即登录
            <ArrowRight className="ml-1.5 size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
