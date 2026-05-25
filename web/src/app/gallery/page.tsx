"use client";

import { useCallback, useEffect, useState } from "react";
import { ImageHistory, fetchImageHistory, deleteImageHistory, publishToPlaza, unpublishFromPlaza } from "@/lib/api";
import { toast } from "sonner";
import { LoaderCircle, Trash2, Share2, Eye, Download, Sparkles, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function GalleryPage() {
  const router = useRouter();
  const [images, setImages] = useState<ImageHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<ImageHistory | null>(null);

  const loadImages = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchImageHistory();
      setImages(res.items);
    } catch {
      toast.error("加载历史失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这张图片吗？")) return;
    try {
      await deleteImageHistory(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
      toast.success("已删除");
    } catch {
      toast.error("删除失败");
    }
  };

  const handleTogglePlaza = async (img: ImageHistory) => {
    try {
      if (img.is_public) {
        await unpublishFromPlaza(img.id);
        toast.success("已从广场下架");
      } else {
        await publishToPlaza(img.id);
        toast.success("已发布到广场");
      }
      loadImages();
    } catch {
      toast.error("操作失败");
    }
  };

  const handleDownload = (img: ImageHistory) => {
    const link = document.createElement("a");
    link.href = img.image_url;
    link.download = `generated-${img.id}.png`;
    link.click();
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-1 pb-16 pt-6 sm:px-6 sm:pt-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">我的画廊</h1>
          <p className="mt-2 text-sm text-muted-foreground">管理您生成的所有图片作品，发布到广场或随时下载。</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadImages} variant="outline" className="rounded-xl border-border/80 bg-card text-sm shadow-sm transition hover:bg-secondary">
            刷新
          </Button>
          <Button className="rounded-xl bg-primary text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90" onClick={() => router.push("/image")}>
            <Sparkles className="size-4" />
            开始创作
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <LoaderCircle className="size-8 animate-spin text-primary/60" />
        </div>
      ) : images.length === 0 ? (
        <Card className="flex h-64 flex-col items-center justify-center gap-4 rounded-3xl border-dashed border-border/80 bg-secondary/30">
          <Sparkles className="size-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">暂无图片记录</p>
          <Button className="rounded-xl bg-primary text-sm font-semibold text-white shadow-sm" onClick={() => router.push("/image")}>
            去生成一张
            <ArrowRight className="ml-1 size-3.5" />
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {images.map((img) => (
            <Card
              key={img.id}
              className="group relative overflow-hidden rounded-2xl border-border/40 bg-card shadow-sm ring-1 ring-border/20 transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
              <div className="aspect-square overflow-hidden bg-secondary/50">
                <img
                  src={img.image_url}
                  alt={img.prompt}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                />
              </div>

              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 opacity-0 transition-all duration-300 group-hover:opacity-100">
                <p className="line-clamp-2 text-sm text-white/90 mb-3">{img.prompt}</p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="inline-flex size-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition hover:bg-white/35"
                    onClick={() => setSelectedImage(img)}
                    aria-label="查看详情"
                  >
                    <Eye className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition hover:bg-white/35"
                    onClick={() => handleTogglePlaza(img)}
                    aria-label={img.is_public ? "从广场移除" : "发布到广场"}
                  >
                    <Share2 className={`size-4 ${img.is_public ? "text-emerald-400" : ""}`} />
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition hover:bg-white/35"
                    onClick={() => handleDownload(img)}
                    aria-label="下载"
                  >
                    <Download className="size-4" />
                  </button>
                  <div className="flex-1" />
                  <button
                    type="button"
                    className="inline-flex size-9 items-center justify-center rounded-full bg-rose-500/70 text-white backdrop-blur-md transition hover:bg-rose-500"
                    onClick={() => handleDelete(img.id)}
                    aria-label="删除"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              {img.is_public && (
                <Badge className="absolute left-3 top-3 rounded-full bg-emerald-500/85 text-[10px] text-white backdrop-blur-md border-none shadow-sm">
                  已发布到广场
                </Badge>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl overflow-hidden rounded-[28px] border-border/40 bg-card p-0 shadow-2xl">
          <div className="grid md:grid-cols-2">
            <div className="bg-secondary/50">
              <img src={selectedImage?.image_url} alt="" className="h-full w-full object-contain" />
            </div>
            <div className="flex flex-col p-6 sm:p-8">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-foreground">图片详情</DialogTitle>
              </DialogHeader>
              <div className="mt-6 space-y-5 flex-1">
                <div>
                  <h4 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">提示词</h4>
                  <div className="rounded-2xl bg-secondary/70 p-4 text-sm leading-relaxed text-foreground">
                    {selectedImage?.prompt}
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <div>
                    <span className="block text-xs text-muted-foreground uppercase tracking-wider mb-1">模型</span>
                    <Badge variant="outline" className="rounded-lg border-border/60 text-xs">{selectedImage?.model}</Badge>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground uppercase tracking-wider mb-1">生成时间</span>
                    <span className="text-sm text-foreground">
                      {selectedImage?.created_at && new Date(selectedImage.created_at).toLocaleString("zh-CN")}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex gap-3 pt-6 border-t border-border/40">
                <Button className="flex-1 rounded-xl bg-primary text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90" onClick={() => selectedImage && handleDownload(selectedImage)}>
                  <Download className="size-4" />
                  下载
                </Button>
                <Button
                  variant="outline"
                  className={`flex-1 rounded-xl text-sm font-medium shadow-sm transition ${
                    selectedImage?.is_public
                      ? "border-rose-200 text-rose-600 hover:bg-rose-50"
                      : "border-border/80 hover:bg-secondary"
                  }`}
                  onClick={() => selectedImage && handleTogglePlaza(selectedImage)}
                >
                  {selectedImage?.is_public ? "从广场移除" : "发布到广场"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
