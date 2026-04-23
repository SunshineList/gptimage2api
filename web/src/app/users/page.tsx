"use client";

import { useEffect, useState } from "react";
import { Copy, LoaderCircle, Plus, Search, Trash2, UserPlus, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchUsers, createUser, deleteUser, type User } from "@/lib/api";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserQuota, setNewUserQuota] = useState("-1");

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
        } catch (err) {
          throw new Error("无法复制文本");
        }
        document.body.removeChild(textArea);
      }
      toast.success("已复制到剪贴板");
    } catch (err) {
      toast.error("复制失败，请手动选择复制");
    }
  };

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await fetchUsers();
      setUsers(data.items);
    } catch (error) {
      toast.error("加载用户失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleCreateUser = async () => {
    if (!newUserName.trim()) {
      toast.error("请输入用户名");
      return;
    }
    setIsCreating(true);
    try {
      await createUser(newUserName, Number(newUserQuota));
      toast.success("用户创建成功");
      setShowAddDialog(false);
      setNewUserName("");
      setNewUserQuota("-1");
      void loadUsers();
    } catch (error) {
      toast.error("创建用户失败");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (key: string) => {
    if (!confirm("确定要删除该用户吗？")) return;
    try {
      await deleteUser(key);
      toast.success("用户已删除");
      void loadUsers();
    } catch (error) {
      toast.error("删除用户失败");
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(query.toLowerCase()) || 
    u.key.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">
            User Management
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">用户管理</h1>
        </div>
        <Button 
          className="h-10 rounded-xl bg-stone-950 px-4 text-white hover:bg-stone-800"
          onClick={() => setShowAddDialog(true)}
        >
          <UserPlus className="mr-2 size-4" />
          创建新用户
        </Button>
      </section>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle>创建新用户</DialogTitle>
            <DialogDescription>
              为普通用户生成一个新的 API Key 并配置额度。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">用户名</label>
              <Input 
                placeholder="例如：张三" 
                value={newUserName}
                onChange={e => setNewUserName(e.target.value)}
                className="rounded-xl border-stone-200"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">额度 (画图次数，-1 为无限制)</label>
              <Input 
                type="number"
                value={newUserQuota}
                onChange={e => setNewUserQuota(e.target.value)}
                className="rounded-xl border-stone-200"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowAddDialog(false)} className="rounded-xl">取消</Button>
            <Button onClick={() => void handleCreateUser()} disabled={isCreating} className="rounded-xl bg-stone-950 text-white">
              {isCreating && <LoaderCircle className="mr-2 size-4 animate-spin" />}
              立即创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="搜索用户名或 Key"
              className="h-10 rounded-xl border-stone-200 bg-white/85 pl-10"
            />
          </div>
        </div>

        <Card className="overflow-hidden rounded-2xl border-white/80 bg-white/90 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-stone-100 text-[11px] text-stone-400 uppercase tracking-[0.18em]">
                  <tr>
                    <th className="px-6 py-4">用户名</th>
                    <th className="px-6 py-4">API Key</th>
                    <th className="px-6 py-4">已用 / 总计</th>
                    <th className="px-6 py-4">创建时间</th>
                    <th className="px-6 py-4">最后使用</th>
                    <th className="px-6 py-4">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredUsers.map(user => (
                    <tr key={user.key} className="text-sm transition-colors hover:bg-stone-50/50">
                      <td className="px-6 py-4 font-medium text-stone-900">{user.name}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">
                            {user.key.slice(0, 8)}...{user.key.slice(-4)}
                          </code>
                          <button 
                            className="text-stone-400 hover:text-stone-600"
                            onClick={() => void copyToClipboard(user.key)}
                          >
                            <Copy className="size-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={user.quota === -1 ? "info" : (user.used >= user.quota ? "danger" : "success")} className="rounded-md">
                          {user.used} / {user.quota === -1 ? "∞" : user.quota}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-stone-500">{user.created_at}</td>
                      <td className="px-6 py-4 text-stone-500">{user.last_used_at || "从未"}</td>
                      <td className="px-6 py-4">
                        <button 
                          className="text-stone-400 hover:text-rose-500 transition-colors"
                          onClick={() => void handleDeleteUser(user.key)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-stone-400">
                        暂无用户数据
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
