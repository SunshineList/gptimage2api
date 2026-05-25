"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LoaderCircle, Download, ImageIcon, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageLightbox } from "@/components/image-lightbox";
import { fetchAdminImages, type ImageHistory } from "@/lib/api";

const PAGE_SIZE = 20;

type LightboxImage = {
  id: string;
  src: string;
};

export default function AdminImagesPage() {
  const [images, setImages] = useState<ImageHistory[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

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

  // 懒加载
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && page < totalPages) {
          loadPage(page + 1, true);
        }
      },
      { rootMargin: "300px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [page, totalPages, isLoadingMore, loadPage]);

  // 构建灯箱图片列表
  const lightboxImages: LightboxImage[] = images.map((img) => ({
    id: img.id,
    src: img.image_url,
  }));

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const handleDownload = (img: ImageHistory) => {
    const link = document.createElement("a");
    link.href = img.image_url;
    link.download = `image-${img.id}.png`;
    link.click();
  };

  // 骨架屏
  const SkeletonCard = () => (
    <div className="overflow-hidden rounded-2xl border border-border/40 bg-card">
      <div className="aspect-square animate-pulse bg-secondary/50" />
      <div className="space-y-2 p-3">
        <div className="h-3 w-3/4 animate-pulse rounded-full bg-secondary" />
        <div className="flex items-center justify-between">
          <div className="h-2.5 w-1/3 animate-pulse rounded-full bg-secondary" />
          <div className="h-2.5 w-1/4 animate-pulse rounded-full bg-secondary" />
        </div>
      </div>
    </div>
  );

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : images.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border/80 bg-secondary/30">
          <ImageIcon className="size-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">暂无图片记录</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {images.map((img, index) => (
              <div
                key={img.id}
                className="group overflow-hidden rounded-2xl border border-border/40 bg-card shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
              >
                {/* Image */}
                <button
                  type="button"
                  className="relative block aspect-square w-full overflow-hidden bg-secondary/50 cursor-zoom-in"
                  onClick={() => openLightbox(index)}
                >
                  <img
                    src={img.image_url}
                    alt={img.prompt}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-transparent to-transparent p-3 opacity-0 transition-all duration-300 group-hover:opacity-100">
                    <p className="line-clamp-3 text-[12px] leading-5 text-white/90">
                      {img.prompt}
                    </p>
                  </div>
                </button>

                {/* Info bar */}
                <div className="p-3 space-y-2">
                  <p
                    className="line-clamp-2 text-[13px] font-medium leading-5 text-foreground"
                    title={img.prompt}
                  >
                    {img.prompt}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Badge variant="outline" className="shrink-0 rounded-md border-border/60 px-1.5 py-0 text-[10px] text-muted-foreground">
                        {img.model}
                      </Badge>
                      <span className="truncate text-[11px] text-muted-foreground flex items-center gap-1">
                        <User className="size-3 shrink-0" />
                        {img.user_key?.slice(0, 10)}...
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] text-muted-foreground/70">
                        {img.created_at && new Date(img.created_at).toLocaleDateString("zh-CN")}
                      </span>
                      <button
                        type="button"
                        className="inline-flex size-7 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition hover:bg-primary hover:text-primary-foreground"
                        onClick={() => handleDownload(img)}
                        aria-label="下载"
                      >
                        <Download className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 懒加载哨兵 */}
          <div ref={sentinelRef} className="flex h-20 items-center justify-center">
            {isLoadingMore ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                加载更多...
              </div>
            ) : page >= totalPages ? (
              <p className="text-xs text-muted-foreground">已加载全部 {total} 张图片</p>
            ) : null}
          </div>
        </>
      )}

      {/* Lightbox */}
      <ImageLightbox
        images={lightboxImages}
        currentIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        onIndexChange={setLightboxIndex}
      />
    </div>
  );
}
