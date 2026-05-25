"use client";

import { useEffect, useState } from "react";
import { BarChart3, CheckCircle2, TrendingUp, XCircle, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchStats, type Stats } from "@/lib/api";

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await fetchStats();
        setStats(data);
      } catch {
        toast.error("加载统计数据失败");
      } finally {
        setIsLoading(false);
      }
    };
    void loadStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoaderCircle className="size-8 animate-spin text-primary/60" />
      </div>
    );
  }

  const dailyData = Object.entries(stats?.daily || {})
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 14);

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <div className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          系统统计
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">统计面板</h1>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">总成功次数</CardTitle>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats?.total_success || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">系统累计生成的图片总数</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">总失败次数</CardTitle>
            <XCircle className="size-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats?.total_fail || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">上游报错或超时的总次数</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">平均成功率</CardTitle>
            <TrendingUp className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats ? (((stats.total_success) / (stats.total_success + stats.total_fail || 1)) * 100).toFixed(1) : 0}%
            </div>
            <p className="mt-1 text-xs text-muted-foreground">系统的整体健康度表现</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/40 bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-foreground">
            <BarChart3 className="size-5 text-primary/70" />
            最近 14 天使用趋势
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-border/60 text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
                <tr>
                  <th className="px-4 py-4 sm:px-6">日期</th>
                  <th className="px-4 py-4 sm:px-6">成功</th>
                  <th className="px-4 py-4 sm:px-6">失败</th>
                  <th className="px-4 py-4 sm:px-6">成功率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-sm">
                {dailyData.map(([date, data]) => (
                  <tr key={date} className="transition-colors hover:bg-secondary/50">
                    <td className="px-4 py-4 font-medium text-foreground sm:px-6">{date}</td>
                    <td className="px-4 py-4 text-emerald-600 sm:px-6">{data.success}</td>
                    <td className="px-4 py-4 text-rose-500 sm:px-6">{data.fail}</td>
                    <td className="px-4 py-4 text-foreground sm:px-6">
                      {((data.success / (data.success + data.fail || 1)) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
                {dailyData.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-muted-foreground">
                      暂无趋势数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
