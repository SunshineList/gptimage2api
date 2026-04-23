"use client";

import { useEffect, useState } from "react";
import { PlazaPost, fetchPlaza } from "@/lib/api";
import { toast } from "sonner";
import { LoaderCircle, User, MessageSquareQuote, Layers, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PlazaPage() {
  const [posts, setPosts] = useState<PlazaPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPlaza = async () => {
    setIsLoading(true);
    try {
      const res = await fetchPlaza();
      setPosts(res.items);
    } catch (error) {
      toast.error("加载广场失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPlaza();
  }, []);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-stone-950 font-['Fira_Code'] sm:text-5xl">创作广场</h1>
        <p className="mt-4 text-lg text-stone-500 font-['Fira_Sans']">发现全球用户分享的精美 AI 艺术作品及提示词。</p>
        <div className="mt-6 flex justify-center gap-2">
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-100 px-3 py-1">活跃社区</Badge>
            <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 px-3 py-1">{posts.length} 件作品</Badge>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <LoaderCircle className="size-8 animate-spin text-purple-500" />
        </div>
      ) : posts.length === 0 ? (
        <Card className="flex h-64 flex-col items-center justify-center border-dashed border-stone-200 bg-stone-50/50">
          <p className="text-stone-400">广场目前空空如也，去发布您的第一件作品吧！</p>
        </Card>
      ) : (
        <div className="columns-1 gap-6 sm:columns-2 lg:columns-3 xl:columns-4">
          {posts.map((post) => (
            <Card key={post.id} className="mb-6 break-inside-avoid overflow-hidden rounded-[28px] border-none bg-white shadow-sm ring-1 ring-stone-100 transition-all hover:shadow-2xl hover:ring-purple-200">
              <div className="relative group overflow-hidden">
                <img
                  src={post.image_url}
                  alt={post.prompt}
                  className="h-auto w-full object-cover"
                />
                <div className="absolute inset-0 bg-black/5 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
              </div>
              
              <div className="p-5">
                <div className="mb-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <MessageSquareQuote className="size-4 mt-1 text-purple-500 shrink-0" />
                    <p className="text-sm text-stone-700 leading-relaxed italic">"{post.prompt}"</p>
                  </div>
                </div>
                
                <div className="flex flex-col gap-3 pt-4 border-t border-stone-50">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <div className="size-6 rounded-full bg-stone-100 flex items-center justify-center">
                          <User className="size-3 text-stone-500" />
                        </div>
                        <span className="text-xs font-medium text-stone-600">{post.user_nickname}</span>
                     </div>
                     <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-md border-stone-100 text-stone-400">
                        {post.model}
                     </Badge>
                   </div>
                   <div className="flex items-center gap-4 text-[10px] text-stone-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {new Date(post.created_at).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <Layers className="size-3" />
                        GPT-Image
                      </div>
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
