"use client";

import { useEffect, useState } from "react";
import { BarChart3, CheckCircle2, TrendingUp, XCircle } from "lucide-react";
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
      } catch (error) {
        toast.error("加载统计数据失败");
      } finally {
        setIsLoading(false);
      }
    };
    void loadStats();
  }, []);

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-stone-500">正在加载统计数据...</div>;
  }

  const dailyData = Object.entries(stats?.daily || {})
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 14);

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <div className="text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">
          System Statistics
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">统计面板</h1>
      </section>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-stone-500">总成功次数</CardTitle>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-stone-900">{stats?.total_success || 0}</div>
            <p className="text-xs text-stone-400 mt-1">系统累计生成的图片总数</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-stone-500">总失败次数</CardTitle>
            <XCircle className="size-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-stone-900">{stats?.total_fail || 0}</div>
            <p className="text-xs text-stone-400 mt-1">上游报错或超时的总次数</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-stone-500">平均成功率</CardTitle>
            <TrendingUp className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-stone-900">
              {stats ? (((stats.total_success) / (stats.total_success + stats.total_fail || 1)) * 100).toFixed(1) : 0}%
            </div>
            <p className="text-xs text-stone-400 mt-1">系统的整体健康度表现</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="size-5" />
            最近 14 天使用趋势
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-stone-100 text-[11px] text-stone-400 uppercase tracking-[0.18em]">
                <tr>
                  <th className="px-6 py-4">日期</th>
                  <th className="px-6 py-4">成功</th>
                  <th className="px-6 py-4">失败</th>
                  <th className="px-6 py-4">成功率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm">
                {dailyData.map(([date, data]) => (
                  <tr key={date} className="transition-colors hover:bg-stone-50/50">
                    <td className="px-6 py-4 font-medium">{date}</td>
                    <td className="px-6 py-4 text-emerald-600">{data.success}</td>
                    <td className="px-6 py-4 text-rose-500">{data.fail}</td>
                    <td className="px-6 py-4">
                      {((data.success / (data.success + data.fail || 1)) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
                {dailyData.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-stone-400">
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
