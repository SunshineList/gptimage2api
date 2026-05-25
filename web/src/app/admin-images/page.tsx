"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LoaderCircle, Eye, ImageIcon, User, Calendar, Cpu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchAdminImages, type ImageHistory } from "@/lib/api";

const PAGE_SIZE = 20;

export default function AdminImagesPage() {
  const [images, setImages] = useState<ImageHistory[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageHistory | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadPage = useCallback(
    async (pageNum: number, append = false) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      try {
        const data = await fetchAdminImages(pageNum, PAGE_SIZE);
        if (append) {
          setImages((prev) => [...prev, ...data.items]);
        } else {
          setImages(data.items);
        }
        setPage(data.page);
        setTotalPages(data.total_pages);
        setTotal(data.total);
      } catch {
        toast.error("加载图片失败");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  // 懒加载：IntersectionObserver 监听底部哨兵
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && page < totalPages) {
          loadPage(page + 1, true);
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [page, totalPages, isLoadingMore, loadPage]);

  return (
    <div className="mx-auto w-full max-w-7xl px-1 pb-16 pt-6 sm:px-6 sm:pt-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            图片管理
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            查看所有用户生成的图片，共 {total} 张
          </p>
        </div>
        <Button
          onClick={() => loadPage(1)}
          variant="outline"
          className="rounded-xl border-border/80 bg-card text-sm shadow-sm transition hover:bg-secondary"
        >
          刷新
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <LoaderCircle className="size-8 animate-spin text-primary/60" />
        </div>
      ) : images.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border/80 bg-secondary/30">
          <ImageIcon className="size-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">暂无图片记录</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {images.map((img) => (
              <div
                key={img.id}
                className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card shadow-sm ring-1 ring-border/20 transition-all hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="aspect-square overflow-hidden bg-secondary/50">
                  <img
                    src={img.image_url}
                    alt={img.prompt}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                  />
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 opacity-0 transition-all duration-300 group-hover:opacity-100">
                  <p className="line-clamp-2 mb-3 text-sm text-white/90">
                    {img.prompt}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className="inline-flex size-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition hover:bg-white/35"
                      onClick={() => setSelectedImage(img)}
                      aria-label="查看详情"
                    >
                      <Eye className="size-4" />
                    </button>
                    <div className="flex-1" />
                    <Badge className="rounded-full bg-white/15 text-[10px] text-white/80 backdrop-blur-md border-none">
                      {img.model}
                    </Badge>
                  </div>
                </div>

                {/* User key badge */}
                <div className="absolute left-3 top-3">
                  <Badge className="rounded-full bg-black/40 text-[10px] text-white/90 backdrop-blur-md border-none shadow-sm">
                    <User className="mr-1 size-3" />
                    {img.user_key?.slice(0, 12)}...
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {/* 懒加载哨兵 */}
          <div ref={sentinelRef} className="flex h-20 items-center justify-center">
            {isLoadingMore ? (
              <LoaderCircle className="size-6 animate-spin text-primary/60" />
            ) : page >= totalPages ? (
              <p className="text-xs text-muted-foreground">已加载全部 {total} 张图片</p>
            ) : null}
          </div>
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl overflow-hidden rounded-[28px] border-border/40 bg-card p-0 shadow-2xl">
          <div className="grid md:grid-cols-2">
            <div className="bg-secondary/50">
              <img
                src={selectedImage?.image_url}
                alt=""
                className="h-full w-full object-contain"
              />
            </div>
            <div className="flex flex-col p-6 sm:p-8">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-foreground">
                  图片详情
                </DialogTitle>
              </DialogHeader>
              <div className="mt-6 space-y-5 flex-1">
                <div>
                  <h4 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    提示词
                  </h4>
                  <div className="rounded-2xl bg-secondary/70 p-4 text-sm leading-relaxed text-foreground">
                    {selectedImage?.prompt}
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <div>
                    <span className="block text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      模型
                    </span>
                    <Badge variant="outline" className="rounded-lg border-border/60 text-xs">
                      <Cpu className="mr-1 size-3" />
                      {selectedImage?.model}
                    </Badge>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      用户
                    </span>
                    <Badge variant="outline" className="rounded-lg border-border/60 text-xs">
                      <User className="mr-1 size-3" />
                      {selectedImage?.user_key?.slice(0, 16)}...
                    </Badge>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      生成时间
                    </span>
                    <span className="flex items-center gap-1 text-sm text-foreground">
                      <Calendar className="size-3.5 text-muted-foreground" />
                      {selectedImage?.created_at &&
                        new Date(selectedImage.created_at).toLocaleString("zh-CN")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
