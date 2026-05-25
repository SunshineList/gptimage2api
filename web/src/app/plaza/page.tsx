"use client";

import { useCallback, useEffect, useState } from "react";
import { PlazaPost, fetchPlaza } from "@/lib/api";
import { toast } from "sonner";
import { LoaderCircle, User, MessageSquareQuote, Calendar, Sparkles, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function PlazaPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<PlazaPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPlaza = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchPlaza();
      setPosts(res.items);
    } catch {
      toast.error("加载广场失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlaza();
  }, [loadPlaza]);

  return (
    <div className="mx-auto w-full max-w-7xl px-1 pb-16 pt-6 sm:px-6 sm:pt-10">
      {/* Header */}
      <div className="mb-10 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary/10 via-accent to-primary/10 px-4 py-1.5 text-[11px] font-semibold tracking-widest text-primary uppercase">
          <Sparkles className="size-3" />
          社区画廊
        </span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">创作广场</h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">发现全球用户分享的精美 AI 艺术作品及提示词</p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <Badge variant="secondary" className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground border-border/60">
            {posts.length} 件作品
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full border-border/80 bg-card text-xs shadow-sm transition hover:bg-secondary"
            onClick={() => router.push("/image")}
          >
            开始创作
            <ArrowRight className="ml-1 size-3" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <LoaderCircle className="size-8 animate-spin text-primary/60" />
        </div>
      ) : posts.length === 0 ? (
        <Card className="flex h-64 flex-col items-center justify-center gap-4 rounded-3xl border-dashed border-border/80 bg-secondary/30">
          <Sparkles className="size-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">广场目前空空如也，去发布您的第一件作品吧</p>
          <Button className="rounded-xl bg-primary text-sm font-semibold text-white shadow-sm" onClick={() => router.push("/image")}>
            去生图后台
            <ArrowRight className="ml-1 size-3.5" />
          </Button>
        </Card>
      ) : (
        <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4">
          {posts.map((post) => (
            <Card
              key={post.id}
              className="mb-5 break-inside-avoid overflow-hidden rounded-2xl border-border/40 bg-card shadow-sm ring-1 ring-border/20 transition-all hover:shadow-lg"
            >
              <div className="relative overflow-hidden">
                <img
                  src={post.image_url}
                  alt={post.prompt}
                  loading="lazy"
                  className="h-auto w-full object-cover transition duration-500 hover:scale-[1.03]"
                />
              </div>

              <div className="border-t border-border/30 p-4 sm:p-5">
                <div className="mb-3 flex items-start gap-2">
                  <MessageSquareQuote className="mt-0.5 size-3.5 shrink-0 text-primary/60" />
                  <p className="text-xs leading-relaxed text-foreground/80 italic line-clamp-3">
                    &ldquo;{post.prompt}&rdquo;
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-border/20 pt-3">
                  <div className="flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center rounded-full bg-secondary">
                      <User className="size-3 text-muted-foreground" />
                    </div>
                    <span className="text-[11px] font-medium text-foreground">{post.user_nickname}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {new Date(post.created_at).toLocaleDateString("zh-CN")}
                    </span>
                    <Badge variant="outline" className="rounded-md border-border/60 px-1.5 py-0 text-[10px] text-muted-foreground">
                      {post.model}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
