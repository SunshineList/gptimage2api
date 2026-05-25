"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { 
  Sparkles, 
  Activity, 
  Users, 
  Clock, 
  Coins, 
  Image as ImageIcon, 
  Lock, 
  Eye, 
  Copy, 
  Download, 
  ArrowRight,
  LoaderCircle
} from "lucide-react";
import { getStoredAuthKey } from "@/store/auth";
import { fetchMe, fetchPlaza, fetchAccounts, PlazaPost, MeResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [posts, setPosts] = useState<PlazaPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    onlineUsers: 12,
    queueCount: 0,
    speed: "12.8",
    totalQuota: 2863,
    totalWorks: 23695
  });

  useEffect(() => {
    const initPage = async () => {
      setIsLoading(true);
      try {
        // Try fetching user auth
        const key = await getStoredAuthKey();
        if (key) {
          try {
            const userData = await fetchMe();
            setMe(userData);
            
            // If logged in, we can try to fetch real accounts quota
            const accountsData = await fetchAccounts();
            if (accountsData && accountsData.items) {
              const sumQuota = accountsData.items.reduce((sum, acc) => sum + (acc.quota || 0), 0);
              setStats(prev => ({ ...prev, totalQuota: sumQuota }));
            }
          } catch (e) {
            // Token expired or guest
          }
        }

        // Fetch public plaza posts
        const plazaData = await fetchPlaza();
        if (plazaData && plazaData.items) {
          setPosts(plazaData.items);
          setStats(prev => ({
            ...prev,
            totalWorks: prev.totalWorks + plazaData.items.length
          }));
        }
      } catch (error) {
        toast.error("加载数据失败");
      } finally {
        setIsLoading(false);
      }
    };

    void initPage();

    // Dynamically simulate online users & queue count client-side
    const interval = setInterval(() => {
      setStats(prev => {
        const randomShift = Math.random() > 0.5 ? 1 : -1;
        const newOnline = Math.max(8, Math.min(24, prev.onlineUsers + (Math.random() > 0.7 ? randomShift : 0)));
        const newQueue = Math.max(0, Math.min(2, Math.random() > 0.85 ? Math.floor(Math.random() * 3) : prev.queueCount));
        return {
          ...prev,
          onlineUsers: newOnline,
          queueCount: newQueue
        };
      });
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const handleCopyPrompt = (prompt: string) => {
    void navigator.clipboard.writeText(prompt);
    toast.success("提示词已复制到剪贴板");
  };

  const handleDownload = (imageUrl: string, id: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `art-${id}.png`;
    link.click();
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* 顶部副标题 */}
      <div className="mb-2 text-center">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold tracking-wider text-primary uppercase">
          AI PROMPT GALLERY @inspired
        </span>
      </div>

      {/* 创意大厅主标题 */}
      <div className="mb-8 text-center">
        <h1 className="bg-gradient-to-br from-foreground via-primary to-primary/80 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
          创意灵感画廊与生图大厅
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          探索社区创作的精彩瞬间。登录后即可加入生图队列，实时追踪排队、生成及状态流转。 作品将在本地保留 7 天，系统将根据可用资源智能调度。
        </p>
      </div>

      {/* 运行状态仪表盘 - 仿 image.oaichat.cc */}
      <div className="mb-12 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {/* WS 状态 */}
        <Card className="liquid-glass border-none p-4 transition-all hover:scale-[1.02]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">运行状态</span>
            <Activity className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2.5 flex items-center gap-1.5">
            <span className="relative flex h-2 size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 size-2 rounded-full bg-emerald-500"></span>
            </span>
            <span className="text-sm font-semibold text-emerald-600">WS 已连接</span>
          </div>
        </Card>

        {/* 在线人数 */}
        <Card className="liquid-glass border-none p-4 transition-all hover:scale-[1.02]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">在线人数</span>
            <Users className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            {stats.onlineUsers} <span className="text-[10px] font-normal text-muted-foreground">人</span>
          </div>
        </Card>

        {/* 排队中 + 生成中 */}
        <Card className="liquid-glass border-none p-4 transition-all hover:scale-[1.02]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">排队中 + 生成中</span>
            <Clock className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            {stats.queueCount} <span className="text-[10px] font-normal text-muted-foreground">个</span>
          </div>
        </Card>

        {/* 生成速度 */}
        <Card className="liquid-glass border-none p-4 transition-all hover:scale-[1.02]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">生成速度</span>
            <Sparkles className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            {stats.speed} <span className="text-[10px] font-normal text-muted-foreground">秒 / 张</span>
          </div>
        </Card>

        {/* 额度或作品数 */}
        <Card className="col-span-2 grid grid-cols-2 gap-2 border-none bg-primary p-4 text-white shadow-lg shadow-primary/10 transition-all hover:scale-[1.02] sm:col-span-1">
          <div>
            <div className="text-[9px] font-medium text-white/70 uppercase">总额度</div>
            <div className="mt-1.5 text-base font-bold leading-none">{stats.totalQuota}</div>
          </div>
          <div className="border-l border-white/20 pl-3">
            <div className="text-[9px] font-medium text-white/70 uppercase">已生成</div>
            <div className="mt-1.5 text-base font-bold leading-none">{stats.totalWorks}</div>
          </div>
        </Card>
      </div>

      {/* 大厅主操作区 */}
      <div className="mb-8 flex items-center justify-between border-b border-secondary pb-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Sparkles className="size-5 text-amber-500" />
          灵感画廊
        </h2>
        {me && (
          <Button 
            className="rounded-2xl bg-primary text-white shadow-sm hover:bg-primary/95 transition-all flex items-center gap-1.5"
            onClick={() => router.push("/image")}
          >
            开启生图后台
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <LoaderCircle className="size-8 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <Card className="flex h-64 flex-col items-center justify-center border-dashed border-border bg-white/50">
          <p className="text-muted-foreground">大厅内暂无发布的画作，发布第一张作品开启广场吧！</p>
        </Card>
      ) : (
        <div className="relative min-h-[400px]">
          {/* 瀑布流画廊网格 */}
          <div className="columns-1 gap-6 sm:columns-2 lg:columns-3 xl:columns-4">
            {posts.map((post) => (
              <Card 
                key={post.id} 
                className="mb-6 break-inside-avoid overflow-hidden border-none bg-white shadow-sm ring-1 ring-secondary/80 transition-all hover:shadow-md hover:ring-primary/20"
              >
                <div className="relative group overflow-hidden bg-slate-50">
                  <img
                    src={post.image_url}
                    alt={post.prompt}
                    className={`h-auto w-full object-cover transition-all duration-300 ${!me ? "blur-[5px] scale-[1.02]" : "group-hover:scale-105"}`}
                  />
                  {me && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex items-center justify-center gap-2">
                      <Button 
                        size="icon" 
                        variant="secondary" 
                        className="size-9 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/40 text-white border-none"
                        onClick={() => handleCopyPrompt(post.prompt)}
                      >
                        <Copy className="size-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="secondary" 
                        className="size-9 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/40 text-white border-none"
                        onClick={() => handleDownload(post.image_url, post.id)}
                      >
                        <Download className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* 仅登录用户可以查看完整的提示词与详情 */}
                {me && (
                  <div className="p-4">
                    <p className="text-xs text-foreground font-medium leading-relaxed italic line-clamp-3 mb-4">
                      "{post.prompt}"
                    </p>
                    <div className="flex items-center justify-between border-t border-secondary pt-3">
                      <span className="text-[10px] font-medium text-muted-foreground">
                        by {post.user_nickname}
                      </span>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded-md border-secondary text-muted-foreground">
                        {post.model}
                      </Badge>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* 访客登录墙 (未登录状态下的遮罩和卡片) */}
          {!me && (
            <div className="absolute inset-0 flex flex-col justify-start bg-gradient-to-t from-background via-background/90 to-transparent pt-16">
              <div className="sticky top-20 mx-auto grid max-w-4xl grid-cols-1 gap-6 p-4 sm:grid-cols-3">
                {/* 🔒 卡片一 */}
                <Card className="liquid-glass border-none p-6 text-center shadow-lg transition-transform hover:scale-[1.01]">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
                    <Lock className="size-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-foreground">登录后即可开启创作</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    加入社区，提交您的专属生图任务。登录后可完整查看全站任务动态。
                  </p>
                  <Button 
                    className="mt-6 w-full rounded-xl bg-primary text-white hover:bg-primary/95 text-xs py-1.5"
                    onClick={() => router.push("/login")}
                  >
                    立即登录
                  </Button>
                </Card>

                {/* 👁 卡片二 */}
                <Card className="liquid-glass border-none p-6 text-center shadow-lg transition-transform hover:scale-[1.01]">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600">
                    <Eye className="size-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-foreground">欢迎来到创意生图站</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    画廊与作品内容需登录后查看。请先登录，解锁社区画廊与完整任务。
                  </p>
                  <Button 
                    className="mt-6 w-full rounded-xl bg-primary text-white hover:bg-primary/95 text-xs py-1.5"
                    onClick={() => router.push("/login")}
                  >
                    立即登录
                  </Button>
                </Card>

                {/* 🔒 卡片三 */}
                <Card className="liquid-glass border-none p-6 text-center shadow-lg transition-transform hover:scale-[1.01]">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600">
                    <Lock className="size-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-foreground">登录后才可查看社区画廊</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    访客无法浏览图库细节。使用账号登录后，可查看全站任务与作品。
                  </p>
                  <Button 
                    className="mt-6 w-full rounded-xl bg-primary text-white hover:bg-primary/95 text-xs py-1.5"
                    onClick={() => router.push("/login")}
                  >
                    立即登录
                  </Button>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
