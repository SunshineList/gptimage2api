"use client";

import { useEffect, useState } from "react";
import { ImageHistory, fetchImageHistory, deleteImageHistory, publishToPlaza, unpublishFromPlaza } from "@/lib/api";
import { toast } from "sonner";
import { LoaderCircle, Trash2, Share2, Eye, Download, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function GalleryPage() {
  const [images, setImages] = useState<ImageHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<ImageHistory | null>(null);

  const loadImages = async () => {
    setIsLoading(true);
    try {
      const res = await fetchImageHistory();
      setImages(res.items);
    } catch (error) {
      toast.error("加载历史失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadImages();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这张图片吗？")) return;
    try {
      await deleteImageHistory(id);
      setImages(images.filter((img) => img.id !== id));
      toast.success("已删除");
    } catch (error) {
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
    } catch (error) {
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
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="bg-gradient-to-br from-foreground via-primary to-primary/80 bg-clip-text text-3xl font-bold tracking-tight text-transparent">我的画廊</h1>
          <p className="mt-2 text-muted-foreground text-sm">查看并分享您生成的所有图片作品。</p>
        </div>
        <Button onClick={loadImages} variant="outline" className="rounded-xl border-border">
          刷新
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <LoaderCircle className="size-8 animate-spin text-primary" />
        </div>
      ) : images.length === 0 ? (
        <Card className="flex h-64 flex-col items-center justify-center border-dashed border-border bg-white/50">
          <p className="text-muted-foreground">暂无图片记录</p>
          <Button variant="link" className="text-primary hover:text-primary/90" onClick={() => window.location.href = "/image"}>去生成一张吧</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {images.map((img) => (
            <Card key={img.id} className="group relative overflow-hidden rounded-[24px] border-none bg-white shadow-sm ring-1 ring-secondary/80 transition-all hover:shadow-md hover:-translate-y-1">
              <div className="aspect-square overflow-hidden bg-secondary">
                <img
                  src={img.image_url}
                  alt={img.prompt}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </div>
              
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <p className="line-clamp-2 text-sm text-white/90 mb-3">{img.prompt}</p>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="secondary" className="size-9 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/40 text-white border-none" onClick={() => setSelectedImage(img)}>
                    <Eye className="size-4" />
                  </Button>
                  <Button size="icon" variant="secondary" className="size-9 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/40 text-white border-none" onClick={() => handleTogglePlaza(img)}>
                    <Share2 className={`size-4 ${img.is_public ? "text-green-400" : ""}`} />
                  </Button>
                  <Button size="icon" variant="secondary" className="size-9 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/40 text-white border-none" onClick={() => handleDownload(img)}>
                    <Download className="size-4" />
                  </Button>
                  <div className="flex-1" />
                  <Button size="icon" variant="destructive" className="size-9 rounded-full bg-red-500/80 backdrop-blur-md hover:bg-red-500 text-white border-none" onClick={() => handleDelete(img.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              
              {img.is_public && (
                <Badge className="absolute right-3 top-3 bg-emerald-500/80 backdrop-blur-md text-white border-none rounded-full">已发布到广场</Badge>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl overflow-hidden rounded-[32px] border-none p-0 bg-white/95 backdrop-blur-xl">
          <div className="grid md:grid-cols-2">
            <div className="bg-secondary">
              <img src={selectedImage?.image_url} alt="" className="h-full w-full object-contain" />
            </div>
            <div className="flex flex-col p-8">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-foreground">详情</DialogTitle>
                <DialogDescription className="mt-4 text-muted-foreground leading-relaxed">
                  <div className="space-y-6">
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                        <Info className="size-4 text-primary" /> 提示词
                      </h4>
                      <div className="rounded-2xl bg-secondary p-4 text-sm border border-border/60">
                        {selectedImage?.prompt}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1 uppercase tracking-wider">生成模型</span>
                        <Badge variant="outline" className="rounded-lg border-secondary">{selectedImage?.model}</Badge>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1 uppercase tracking-wider">生成时间</span>
                        <span className="text-sm text-foreground">{selectedImage?.created_at && new Date(selectedImage.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <div className="mt-auto pt-8 flex gap-3">
                <Button className="flex-1 rounded-2xl bg-primary text-white hover:bg-primary/95" onClick={() => selectedImage && handleDownload(selectedImage)}>
                  下载图片
                </Button>
                <Button 
                  variant="outline" 
                  className={`flex-1 rounded-2xl border-border ${selectedImage?.is_public ? "text-red-500 border-red-100 hover:bg-red-50" : "hover:bg-secondary"}`}
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
