"use client";

import { LoaderCircle, MessageSquarePlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getImageConversationStats, type ImageConversation } from "@/store/image-conversations";

type ImageSidebarProps = {
  conversations: ImageConversation[];
  isLoadingHistory: boolean;
  selectedConversationId: string | null;
  onCreateDraft: () => void;
  onClearHistory: () => void | Promise<void>;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void | Promise<void>;
  formatConversationTime: (value: string) => string;
};

export function ImageSidebar({
  conversations,
  isLoadingHistory,
  selectedConversationId,
  onCreateDraft,
  onClearHistory,
  onSelectConversation,
  onDeleteConversation,
  formatConversationTime,
}: ImageSidebarProps) {
  return (
    <aside className="min-h-0 border-r border-border/50 pr-3">
      <div className="flex h-full min-h-0 flex-col gap-3 py-2">
        <div className="flex items-center gap-2">
          <Button className="h-10 flex-1 rounded-xl bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/90 hover:shadow-md" onClick={onCreateDraft}>
            <MessageSquarePlus className="size-4" />
            新建对话
          </Button>
          <Button
            variant="outline"
            className="h-10 rounded-xl border-border/80 bg-card px-3 text-muted-foreground shadow-sm transition hover:bg-secondary hover:text-foreground"
            onClick={() => void onClearHistory()}
            disabled={conversations.length === 0}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {isLoadingHistory ? (
            <div className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              正在读取会话记录
            </div>
          ) : conversations.length === 0 ? (
            <div className="rounded-lg px-3 py-3 text-sm leading-6 text-muted-foreground">还没有图片记录，输入提示词后会在这里显示。</div>
          ) : (
            conversations.map((conversation) => {
              const active = conversation.id === selectedConversationId;
              const stats = getImageConversationStats(conversation);
              return (
                <div
                  key={conversation.id}
                  className={cn(
                    "group relative w-full rounded-xl px-3 py-3 text-left transition-all",
                    active
                      ? "bg-primary/8 text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectConversation(conversation.id)}
                    className="block w-full pr-8 text-left"
                  >
                    <div className="truncate text-sm font-semibold">
                      <span className="truncate">{conversation.title}</span>
                    </div>
                    <div className={cn("mt-1 text-xs", active ? "text-muted-foreground" : "text-muted-foreground/60")}>
                      {conversation.turns.length} 轮 · {formatConversationTime(conversation.updatedAt)}
                    </div>
                    {stats.running > 0 || stats.queued > 0 ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        {stats.running > 0 ? (
                          <span className="rounded-full bg-blue-50 px-2 py-1 font-medium text-blue-600">处理中 {stats.running}</span>
                        ) : null}
                        {stats.queued > 0 ? (
                          <span className="rounded-full bg-amber-50 px-2 py-1 font-medium text-amber-700">排队 {stats.queued}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteConversation(conversation.id)}
                    className="absolute top-3 right-2 inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground/40 opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    aria-label="删除会话"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
