"use client";

import { useEffect, useState } from "react";
import { Copy, LoaderCircle, Pencil, Plus, Search, Trash2, UserPlus, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchUsers, createUser, deleteUser, updateUser, type User } from "@/lib/api";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserQuota, setNewUserQuota] = useState("-1");
  
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserQuota, setEditUserQuota] = useState("-1");
  const [editUserStatus, setEditUserStatus] = useState<"active" | "disabled">("active");

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

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserName(user.name);
    setEditUserQuota(user.quota.toString());
    setEditUserStatus(user.status);
    setShowEditDialog(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    if (!editUserName.trim()) {
      toast.error("请输入用户名");
      return;
    }
    setIsUpdating(true);
    try {
      await updateUser(editingUser.key, {
        name: editUserName,
        quota: Number(editUserQuota),
        status: editUserStatus,
      });
      toast.success("用户信息已更新");
      setShowEditDialog(false);
      void loadUsers();
    } catch (error) {
      toast.error("更新用户信息失败");
    } finally {
      setIsUpdating(false);
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

      {/* 创建对话框 */}
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

      {/* 编辑对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle>编辑用户信息</DialogTitle>
            <DialogDescription>
              修改用户的基本信息、额度或状态。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">用户名</label>
              <Input 
                placeholder="用户名" 
                value={editUserName}
                onChange={e => setEditUserName(e.target.value)}
                className="rounded-xl border-stone-200"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">额度 (画图次数，-1 为无限制)</label>
              <Input 
                type="number"
                value={editUserQuota}
                onChange={e => setEditUserQuota(e.target.value)}
                className="rounded-xl border-stone-200"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">账号状态</label>
              <select 
                value={editUserStatus}
                onChange={e => setEditUserStatus(e.target.value as any)}
                className="flex h-10 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-stone-950 focus:ring-offset-2"
              >
                <option value="active">正常</option>
                <option value="disabled">禁用</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowEditDialog(false)} className="rounded-xl">取消</Button>
            <Button onClick={() => void handleUpdateUser()} disabled={isUpdating} className="rounded-xl bg-stone-950 text-white">
              {isUpdating && <LoaderCircle className="mr-2 size-4 animate-spin" />}
              确认修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:max-w-sm">
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
                    <th className="px-6 py-4">状态</th>
                    <th className="px-6 py-4">创建时间</th>
                    <th className="px-6 py-4">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredUsers.map(user => (
                    <tr key={user.key} className="text-sm transition-colors hover:bg-stone-50/50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-stone-900">{user.name}</div>
                        <div className="mt-0.5 text-[10px] text-stone-400">{user.last_used_at ? `最后活跃: ${user.last_used_at}` : "尚未活跃"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">
                            {user.key.slice(0, 8)}...{user.key.slice(-4)}
                          </code>
                          <button 
                            className="text-stone-400 hover:text-stone-600 transition-colors"
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
                      <td className="px-6 py-4">
                        <Badge variant={user.status === "active" ? "outline" : "secondary"} className="rounded-md">
                          {user.status === "active" ? "正常" : "已禁用"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-stone-500">{user.created_at}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button 
                            className="text-stone-400 hover:text-stone-900 transition-colors"
                            onClick={() => handleEditUser(user)}
                            title="编辑"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button 
                            className="text-stone-400 hover:text-rose-500 transition-colors"
                            onClick={() => void handleDeleteUser(user.key)}
                            title="删除"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
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
