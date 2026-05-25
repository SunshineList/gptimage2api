"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageSquarePlus, X } from "lucide-react";

import { ImageComposer } from "@/app/image/components/image-composer";
import { ImageResults, type ImageLightboxItem } from "@/app/image/components/image-results";
import { ImageSidebar } from "@/app/image/components/image-sidebar";
import { ImageLightbox } from "@/components/image-lightbox";
import { cn } from "@/lib/utils";
import {
  editImage,
  fetchMe,
  generateImage,
  MeResponse,
  fetchConversations,
  saveConversation as apiSaveConversation,
  deleteConversation as apiDeleteConversation,
  clearConversations as apiClearConversations,
  fetchImagesBatch,
  matchOrphanImages,
} from "@/lib/api";
import { getStoredAuthKey } from "@/store/auth";
import {
  getImageConversationStats,
  type ImageConversation,
  type ImageConversationMode,
  type ImageTurn,
  type ImageTurnStatus,
  type StoredImage,
  type StoredReferenceImage,
} from "@/store/image-conversations";

const ACTIVE_CONVERSATION_STORAGE_KEY = "chatgpt2api:image_active_conversation_id";
const ACTIVE_TURNS_SESSION_KEY = "chatgpt2api:image_active_turns";
const activeConversationQueueIds = new Set<string>();

function buildConversationTitle(prompt: string) {
  const trimmed = prompt.trim();
  if (trimmed.length <= 12) {
    return trimmed;
  }
  return `${trimmed.slice(0, 12)}...`;
}

function formatConversationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}


function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取参考图失败"));
    reader.readAsDataURL(file);
  });
}

function dataUrlToFile(dataUrl: string, fileName: string, mimeType?: string) {
  const [header, content] = dataUrl.split(",", 2);
  const matchedMimeType = header.match(/data:(.*?);base64/)?.[1];
  const binary = atob(content || "");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], fileName, { type: mimeType || matchedMimeType || "image/png" });
}

function buildReferenceImageFromResult(image: StoredImage, fileName: string): StoredReferenceImage | null {
  if (!image.b64_json) {
    return null;
  }

  return {
    name: fileName,
    type: "image/png",
    dataUrl: `data:image/png;base64,${image.b64_json}`,
  };
}

function pickFallbackConversationId(conversations: ImageConversation[]) {
  const activeConversation = conversations.find((conversation) =>
    conversation.turns.some((turn) => turn.status === "queued" || turn.status === "generating"),
  );
  return activeConversation?.id ?? conversations[0]?.id ?? null;
}

function sortImageConversations(conversations: ImageConversation[]) {
  return [...conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function stripB64ForServerSync(conversation: ImageConversation): ImageConversation {
  return {
    ...conversation,
    turns: conversation.turns.map((turn) => ({
      ...turn,
      images: turn.images.map((img) => ({
        id: img.id,
        status: img.status,
        image_id: img.image_id,
        ...(img.error ? { error: img.error } : {}),
      })),
    })),
  };
}

async function hydrateConversations(
  conversations: ImageConversation[],
): Promise<ImageConversation[]> {
  // 收集所有缺少 b64_json 但有 image_id 的图片 ID
  const allMissingIds: string[] = [];
  for (const conv of conversations) {
    for (const turn of conv.turns) {
      for (const img of turn.images) {
        if (img.image_id && !img.b64_json) {
          allMissingIds.push(img.image_id);
        }
      }
    }
  }

  if (allMissingIds.length === 0) return conversations;

  let idToB64 = new Map<string, string>();
  try {
    const { items: batchItems } = await fetchImagesBatch(allMissingIds);
    for (const item of batchItems) {
      if (item.image_url) {
        const b64 = item.image_url.replace(/^data:image\/\w+;base64,/, "");
        idToB64.set(item.id, b64);
      }
    }
  } catch { /* hydration 失败不阻塞 */ }

  if (idToB64.size === 0) return conversations;

  return conversations.map((conv) => ({
    ...conv,
    turns: conv.turns.map((turn) => ({
      ...turn,
      images: turn.images.map((img) => {
        const b64 = img.image_id ? idToB64.get(img.image_id) : undefined;
        if (b64 && !img.b64_json) {
          return { ...img, b64_json: b64, status: img.status === "loading" ? "success" : img.status };
        }
        return img;
      }),
    })),
  }));
}

async function recoverConversationHistory(items: ImageConversation[]) {
  const activeTurnIds: string[] = (() => {
    try {
      if (typeof window === "undefined") return [];
      const raw = window.sessionStorage.getItem(ACTIVE_TURNS_SESSION_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  })();

  // 第一步：尝试为没有 image_id 的 generating turn 匹配孤立的图片
  let resolvedItems = items;
  const orphanQueries: { turnKey: string; prompt: string; after_time: string }[] = [];
  for (const conv of resolvedItems) {
    for (const turn of conv.turns) {
      if (turn.status !== "generating") continue;
      if (activeTurnIds.includes(turn.id)) continue;
      if (turn.images.some((img) => img.image_id)) continue;
      // 只有 loading 图片数匹配的才尝试（避免已将部分标为 error 的情况重复匹配）
      const loadingCount = turn.images.filter((img) => img.status === "loading").length;
      if (loadingCount === 0) continue;
      orphanQueries.push({
        turnKey: `${conv.id}::${turn.id}`,
        prompt: turn.prompt,
        after_time: turn.createdAt,
      });
    }
  }

  if (orphanQueries.length > 0) {
    try {
      const { matches } = await matchOrphanImages(
        orphanQueries.map((q) => ({ prompt: q.prompt, after_time: q.after_time })),
      );
      if (matches.length > 0) {
        // 按 prompt 分组
        const idsByPrompt = new Map<string, string[]>();
        for (const m of matches) {
          const existing = idsByPrompt.get(m.prompt) || [];
          existing.push(m.image_id);
          idsByPrompt.set(m.prompt, existing);
        }
        // 将匹配到的 image_id 分配给对应的 turn
        resolvedItems = resolvedItems.map((conv) => ({
          ...conv,
          turns: conv.turns.map((turn) => {
            const key = `${conv.id}::${turn.id}`;
            const query = orphanQueries.find((q) => q.turnKey === key);
            if (!query) return turn;
            const ids = idsByPrompt.get(query.prompt) || [];
            if (ids.length === 0) return turn;
            let assigned = 0;
            return {
              ...turn,
              images: turn.images.map((img) => {
                if (img.image_id || img.status !== "loading") return img;
                const matchedId = ids[assigned % ids.length];
                assigned++;
                return matchedId ? { ...img, image_id: matchedId } : img;
              }),
            };
          }),
        }));
      }
    } catch { /* 孤儿匹配失败不阻塞恢复 */ }
  }

  // 第二步：单次批量请求从后端 images 表恢复 b64_json
  const hydrated = await hydrateConversations(resolvedItems);

  const normalized = hydrated.map((conversation) => {
    let changed = false;

    const turns = conversation.turns.map((turn) => {
      if (turn.status !== "queued" && turn.status !== "generating") {
        return turn;
      }

      const loadingCount = turn.images.filter((image) => image.status === "loading").length;
      if (loadingCount === 0) {
        const failedCount = turn.images.filter((image) => image.status === "error").length;
        const successCount = turn.images.filter((image) => image.status === "success").length;
        const nextStatus: ImageTurnStatus =
          failedCount > 0 ? "error" : successCount > 0 ? "success" : "queued";
        const nextError = failedCount > 0 ? turn.error || `其中 ${failedCount} 张未成功生成` : undefined;
        if (nextStatus === turn.status && nextError === turn.error) return turn;
        changed = true;
        return { ...turn, status: nextStatus, error: nextError };
      }

      // 有 loading 状态的图片
      if (turn.status === "generating") {
        if (activeTurnIds.includes(turn.id)) {
          return turn;
        }
        const hasImageIdRef = turn.images.some((img) => img.image_id);
        if (hasImageIdRef) {
          const failedCount = turn.images.filter((img) => img.status === "error").length;
          const successCount = turn.images.filter((img) => img.status === "success").length;
          const orphanLoading = turn.images.filter(
            (img) => img.status === "loading" && !img.image_id,
          ).length;
          changed = true;
          const totalFailed = failedCount + orphanLoading;
          const resolvedStatus: ImageTurnStatus = totalFailed > 0 && successCount === 0 ? "error" : "success";
          return {
            ...turn,
            status: resolvedStatus,
            error: totalFailed > 0 ? `其中 ${totalFailed} 张未成功生成` : undefined,
            images: turn.images.map((img) =>
              img.status === "loading" && !img.image_id
                ? { ...img, status: "error" as const, error: "任务中断" }
                : img,
            ),
          };
        }
        // 非活跃且无 image_id，孤儿匹配也未找到 → 标记为失败
        changed = true;
        return {
          ...turn,
          status: "error" as ImageTurnStatus,
          error: "任务中断，未完成的图片已标记为失败",
          images: turn.images.map((image) =>
            image.status === "loading" ? { ...image, status: "error" as const, error: "任务中断" } : image,
          ),
        };
      }

      return turn;
    });

    if (!changed) return conversation;
    const lastTurn = turns.length > 0 ? turns[turns.length - 1] : null;
    return {
      ...conversation,
      turns,
      updatedAt: lastTurn?.createdAt || conversation.updatedAt,
    };
  });

  const changedConversations = normalized.filter((conv, index) => conv !== resolvedItems[index]);
  if (changedConversations.length > 0) {
    for (const conv of changedConversations) {
      await apiSaveConversation(stripB64ForServerSync(conv));
    }
  }

  return normalized;
}

export default function ImagePage() {
  const router = useRouter();
  const didLoadQuotaRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const conversationsRef = useRef<ImageConversation[]>([]);
  const resultsViewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imagePrompt, setImagePrompt] = useState("");
  const [imageCount, setImageCount] = useState("1");
  const [imageMode, setImageMode] = useState<ImageConversationMode>("generate");
  const [referenceImageFiles, setReferenceImageFiles] = useState<File[]>([]);
  const [referenceImages, setReferenceImages] = useState<StoredReferenceImage[]>([]);
  const [conversations, setConversations] = useState<ImageConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [availableQuota, setAvailableQuota] = useState("加载中...");
  const [lightboxImages, setLightboxImages] = useState<ImageLightboxItem[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const parsedCount = useMemo(() => Math.max(1, Math.min(10, Number(imageCount) || 1)), [imageCount]);
  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );
  const activeTaskCount = useMemo(
    () =>
      conversations.reduce((sum, conversation) => {
        const stats = getImageConversationStats(conversation);
        return sum + stats.queued + stats.running;
      }, 0),
    [conversations],
  );

  useEffect(() => {
    void getStoredAuthKey().then((key) => {
      if (!key) {
        router.replace("/login");
      }
    });
  }, [router]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      try {
        const { items } = await fetchConversations();
        const normalizedItems = await recoverConversationHistory(items);
        if (cancelled) {
          return;
        }

        conversationsRef.current = normalizedItems;
        setConversations(normalizedItems);
        const storedConversationId =
          typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_CONVERSATION_STORAGE_KEY) : null;
        const nextSelectedConversationId =
          (storedConversationId && normalizedItems.some((conversation) => conversation.id === storedConversationId)
            ? storedConversationId
            : null) ?? pickFallbackConversationId(normalizedItems);
        setSelectedConversationId(nextSelectedConversationId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "读取会话记录失败";
        toast.error(message);
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      }
    };

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadQuota = useCallback(async () => {
    try {
      const data = await fetchMe();
      if (data.role === "admin" || data.role === "operator") {
        setAvailableQuota(data.role === "admin" ? "管理员" : "运营");
      } else {
        const remaining = data.quota === -1 ? "无限制" : (data.quota || 0) - (data.used || 0);
        setAvailableQuota(String(remaining));
      }
    } catch {
      setAvailableQuota((prev) => (prev === "加载中..." ? "--" : prev));
    }
  }, []);

  useEffect(() => {
    if (didLoadQuotaRef.current) {
      return;
    }
    didLoadQuotaRef.current = true;

    const handleFocus = () => {
      void loadQuota();
    };

    void loadQuota();
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadQuota]);

  useEffect(() => {
    if (!selectedConversation) {
      return;
    }

    resultsViewportRef.current?.scrollTo({
      top: resultsViewportRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [selectedConversation?.updatedAt, selectedConversation?.turns.length, selectedConversation]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (selectedConversationId) {
      window.localStorage.setItem(ACTIVE_CONVERSATION_STORAGE_KEY, selectedConversationId);
    } else {
      window.localStorage.removeItem(ACTIVE_CONVERSATION_STORAGE_KEY);
    }
  }, [selectedConversationId]);

  // 关闭侧边栏当选择会话时 (仅移动端)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [selectedConversationId]);

  useEffect(() => {
    if (selectedConversationId && !conversations.some((conversation) => conversation.id === selectedConversationId)) {
      setSelectedConversationId(pickFallbackConversationId(conversations));
    }
  }, [conversations, selectedConversationId]);

  const persistConversation = async (conversation: ImageConversation) => {
    const nextConversations = sortImageConversations([
      conversation,
      ...conversationsRef.current.filter((item) => item.id !== conversation.id),
    ]);
    conversationsRef.current = nextConversations;
    setConversations(nextConversations);
    await apiSaveConversation(stripB64ForServerSync(conversation));
  };

  const updateConversation = useCallback(
    async (
      conversationId: string,
      updater: (current: ImageConversation | null) => ImageConversation,
      options: { persist?: boolean } = {},
    ) => {
      const current = conversationsRef.current.find((item) => item.id === conversationId) ?? null;
      const nextConversation = updater(current);
      const nextConversations = sortImageConversations([
        nextConversation,
        ...conversationsRef.current.filter((item) => item.id !== conversationId),
      ]);
      conversationsRef.current = nextConversations;
      setConversations(nextConversations);
      if (options.persist !== false) {
        await apiSaveConversation(stripB64ForServerSync(nextConversation));
      }
    },
    [],
  );

  const clearComposerInputs = useCallback(() => {
    setImagePrompt("");
    setImageCount("1");
    setReferenceImageFiles([]);
    setReferenceImages([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const resetComposer = useCallback(() => {
    setImageMode("generate");
    clearComposerInputs();
  }, [clearComposerInputs]);

  const handleCreateDraft = () => {
    setSelectedConversationId(null);
    resetComposer();
    textareaRef.current?.focus();
  };

  const handleDeleteConversation = async (id: string) => {
    const nextConversations = conversations.filter((item) => item.id !== id);
    conversationsRef.current = nextConversations;
    setConversations(nextConversations);
    if (selectedConversationId === id) {
      setSelectedConversationId(pickFallbackConversationId(nextConversations));
      resetComposer();
    }

    try {
      await apiDeleteConversation(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除会话失败";
      toast.error(message);
      const { items } = await fetchConversations();
      const hydrated = await hydrateConversations(items);
      conversationsRef.current = hydrated;
      setConversations(hydrated);
    }
  };

  const handleClearHistory = async () => {
    try {
      await apiClearConversations();
      conversationsRef.current = [];
      setConversations([]);
      setSelectedConversationId(null);
      resetComposer();
      toast.success("已清空历史记录");
    } catch (error) {
      const message = error instanceof Error ? error.message : "清空历史记录失败";
      toast.error(message);
    }
  };

  const appendReferenceImages = useCallback(async (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    try {
      const previews = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          type: file.type || "image/png",
          dataUrl: await readFileAsDataUrl(file),
        })),
      );

      setReferenceImageFiles((prev) => [...prev, ...files]);
      setReferenceImages((prev) => [...prev, ...previews]);
      setImageMode("edit");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "读取参考图失败";
      toast.error(message);
    }
  }, []);

  const handleReferenceImageChange = useCallback(
    async (files: File[]) => {
      if (files.length === 0) {
        return;
      }

      await appendReferenceImages(files);
    },
    [appendReferenceImages],
  );

  const handleRemoveReferenceImage = useCallback((index: number) => {
    setReferenceImageFiles((prev) => {
      const next = prev.filter((_, currentIndex) => currentIndex !== index);
      if (next.length === 0 && fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return next;
    });
    setReferenceImages((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  }, []);

  const handleContinueEdit = useCallback(
    (conversationId: string, image: StoredImage | StoredReferenceImage) => {
      const nextReferenceImage =
        "dataUrl" in image
          ? image
          : buildReferenceImageFromResult(image, `conversation-${conversationId}-${Date.now()}.png`);
      if (!nextReferenceImage) {
        return;
      }

      setSelectedConversationId(conversationId);
      setImageMode("edit");
      setReferenceImages((prev) => [...prev, nextReferenceImage]);
      setReferenceImageFiles((prev) => [
        ...prev,
        dataUrlToFile(nextReferenceImage.dataUrl, nextReferenceImage.name, nextReferenceImage.type),
      ]);
      setImagePrompt("");
      textareaRef.current?.focus();
      toast.success("已加入当前参考图，继续输入描述即可编辑");
    },
    [],
  );

  const openLightbox = useCallback((images: ImageLightboxItem[], index: number) => {
    if (images.length === 0) {
      return;
    }

    setLightboxImages(images);
    setLightboxIndex(Math.max(0, Math.min(index, images.length - 1)));
    setLightboxOpen(true);
  }, []);

  const runConversationQueue = useCallback(
    async (conversationId: string) => {
      if (activeConversationQueueIds.has(conversationId)) {
        return;
      }

      const snapshot = conversationsRef.current.find((conversation) => conversation.id === conversationId);
      // 找到第一个需要处理的 turn：status 为 generating 且有 loading 图片待生成
      const pendingTurn = snapshot?.turns.find(
        (turn) => turn.status === "generating" && turn.images.some((img) => img.status === "loading" && !img.image_id),
      );
      if (!snapshot || !pendingTurn) {
        return;
      }

      activeConversationQueueIds.add(conversationId);
      // 记录活跃轮次到 sessionStorage，用于页面重载时判断 zombie 是否存活
      try {
        const active = JSON.parse(window.sessionStorage.getItem(ACTIVE_TURNS_SESSION_KEY) || "[]") as string[];
        active.push(pendingTurn.id);
        window.sessionStorage.setItem(ACTIVE_TURNS_SESSION_KEY, JSON.stringify(active));
      } catch { /* ignore */ }

      try {
        const referenceFiles = pendingTurn.referenceImages.map((image, index) =>
          dataUrlToFile(image.dataUrl, image.name || `${pendingTurn.id}-${index + 1}.png`, image.type),
        );
        const pendingImages = pendingTurn.images.filter((image) => image.status === "loading");

        if (pendingTurn.mode === "edit" && referenceFiles.length === 0) {
          throw new Error("未找到可用于继续编辑的参考图");
        }

        if (pendingImages.length === 0) {
          const existingFailedCount = pendingTurn.images.filter((image) => image.status === "error").length;
          const existingSuccessCount = pendingTurn.images.filter((image) => image.status === "success").length;
          await updateConversation(conversationId, (current) => {
            const conversation = current ?? snapshot;
            return {
              ...conversation,
              updatedAt: new Date().toISOString(),
              turns: conversation.turns.map((turn) =>
                turn.id === pendingTurn.id
                  ? {
                    ...turn,
                    status: existingFailedCount > 0 ? "error" : existingSuccessCount > 0 ? "success" : "queued",
                    error: existingFailedCount > 0 ? `其中 ${existingFailedCount} 张未成功生成` : undefined,
                  }
                  : turn,
              ),
            };
          });
          return;
        }

        // 单次 API 调用生成所有图片，避免离开页面后中断
        const data =
          pendingTurn.mode === "edit"
            ? await editImage(referenceFiles, pendingTurn.prompt, undefined, pendingImages.length)
            : await generateImage(pendingTurn.prompt, undefined, pendingImages.length);

        const results = data.data || [];

        // 立即持久化 image_id，确保页面刷新后可通过 images 表恢复
        const imageIdByPendingId = new Map<string, string>();
        for (let i = 0; i < pendingImages.length; i++) {
          const result = results[i];
          if (result?.image_id) {
            imageIdByPendingId.set(pendingImages[i].id, result.image_id);
          }
        }
        if (imageIdByPendingId.size > 0) {
          await updateConversation(conversationId, (current) => {
            const conversation = current ?? snapshot;
            return {
              ...conversation,
              updatedAt: new Date().toISOString(),
              turns: conversation.turns.map((turn) =>
                turn.id === pendingTurn.id
                  ? {
                      ...turn,
                      images: turn.images.map((image) =>
                        imageIdByPendingId.has(image.id)
                          ? { ...image, image_id: imageIdByPendingId.get(image.id) }
                          : image,
                      ),
                    }
                  : turn,
              ),
            };
          });
        }

        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < pendingImages.length; i++) {
          const pendingImage = pendingImages[i];
          const result = results[i];
          if (result?.b64_json) {
            successCount += 1;
            const nextImage: StoredImage = {
              id: pendingImage.id,
              status: "success",
              b64_json: result.b64_json,
              image_id: result.image_id,
            };
            await updateConversation(
              conversationId,
              (current) => {
                const conversation = current ?? snapshot;
                return {
                  ...conversation,
                  updatedAt: new Date().toISOString(),
                  turns: conversation.turns.map((turn) =>
                    turn.id === pendingTurn.id
                      ? {
                        ...turn,
                        images: turn.images.map((image) => (image.id === nextImage.id ? nextImage : image)),
                      }
                      : turn,
                  ),
                };
              },
            );
          } else {
            failedCount += 1;
            const failedImage: StoredImage = {
              id: pendingImage.id,
              status: "error",
              error: "未返回图片数据",
            };
            await updateConversation(
              conversationId,
              (current) => {
                const conversation = current ?? snapshot;
                return {
                  ...conversation,
                  updatedAt: new Date().toISOString(),
                  turns: conversation.turns.map((turn) =>
                    turn.id === pendingTurn.id
                      ? {
                        ...turn,
                        images: turn.images.map((image) => (image.id === failedImage.id ? failedImage : image)),
                      }
                      : turn,
                  ),
                };
              },
              { persist: false },
            );
          }
        }

        const existingSuccessCount = pendingTurn.images.filter((image) => image.status === "success").length;
        const existingFailedCount = pendingTurn.images.filter((image) => image.status === "error").length;
        const totalSuccess = existingSuccessCount + successCount;
        const totalFailed = existingFailedCount + failedCount;

        await updateConversation(conversationId, (current) => {
          const conversation = current ?? snapshot;
          return {
            ...conversation,
            updatedAt: new Date().toISOString(),
            turns: conversation.turns.map((turn) =>
              turn.id === pendingTurn.id
                ? {
                  ...turn,
                  status: totalFailed > 0 && totalSuccess === 0 ? "error" : "success",
                  error: totalFailed > 0 ? `其中 ${totalFailed} 张未成功生成` : undefined,
                }
                : turn,
            ),
          };
        });

        await loadQuota();
      } catch (error) {
        const message = error instanceof Error ? error.message : "生成图片失败";
        await updateConversation(conversationId, (current) => {
          const conversation = current ?? snapshot;
          return {
            ...conversation,
            updatedAt: new Date().toISOString(),
            turns: conversation.turns.map((turn) =>
              turn.id === pendingTurn.id
                ? {
                  ...turn,
                  status: "error",
                  error: message,
                  images: turn.images.map((image) =>
                    image.status === "loading" ? { ...image, status: "error", error: message } : image,
                  ),
                }
                : turn,
            ),
          };
        });
        toast.error(message);
      } finally {
        activeConversationQueueIds.delete(conversationId);
        // 清理 sessionStorage 中的活跃轮次记录
        try {
          const raw = window.sessionStorage.getItem(ACTIVE_TURNS_SESSION_KEY);
          const active = raw ? (JSON.parse(raw) as string[]) : [];
          const filtered = active.filter((id) => id !== pendingTurn.id);
          if (filtered.length > 0) {
            window.sessionStorage.setItem(ACTIVE_TURNS_SESSION_KEY, JSON.stringify(filtered));
          } else {
            window.sessionStorage.removeItem(ACTIVE_TURNS_SESSION_KEY);
          }
        } catch { /* ignore */ }

        for (const conversation of conversationsRef.current) {
          if (
            !activeConversationQueueIds.has(conversation.id) &&
            conversation.turns.some(
              (turn) => turn.status === "generating" && turn.images.some((img) => img.status === "loading" && !img.image_id),
            )
          ) {
            void runConversationQueue(conversation.id);
          }
        }
      }
    },
    [loadQuota, updateConversation],
  );

  useEffect(() => {
    for (const conversation of conversations) {
      if (
        !activeConversationQueueIds.has(conversation.id) &&
        conversation.turns.some(
          (turn) => turn.status === "generating" && turn.images.some((img) => img.status === "loading" && !img.image_id),
        )
      ) {
        void runConversationQueue(conversation.id);
      }
    }
  }, [conversations, runConversationQueue]);

  const handleSubmit = async () => {
    if (isSubmittingRef.current) return;
    const prompt = imagePrompt.trim();
    if (!prompt) {
      toast.error("请输入提示词");
      return;
    }

    if (imageMode === "edit" && referenceImageFiles.length === 0) {
      toast.error("请先上传参考图");
      return;
    }

    isSubmittingRef.current = true;

    try {
    const targetConversation = selectedConversationId
      ? conversationsRef.current.find((conversation) => conversation.id === selectedConversationId) ?? null
      : null;
    const now = new Date().toISOString();
    const conversationId = targetConversation?.id ?? createId();
    const turnId = createId();
    const draftTurn: ImageTurn = {
      id: turnId,
      prompt,
      model: "auto",
      mode: imageMode,
      referenceImages: imageMode === "edit" ? referenceImages : [],
      count: parsedCount,
      images: Array.from({ length: parsedCount }, (_, index) => ({
        id: `${turnId}-${index}`,
        status: "loading" as const,
      })),
      createdAt: now,
      status: "generating",
    };

    const baseConversation: ImageConversation = targetConversation
      ? {
        ...targetConversation,
        updatedAt: now,
        turns: [...targetConversation.turns, draftTurn],
      }
      : {
        id: conversationId,
        title: buildConversationTitle(prompt),
        createdAt: now,
        updatedAt: now,
        turns: [draftTurn],
      };

    setSelectedConversationId(conversationId);
    clearComposerInputs();

    await persistConversation(baseConversation);
    void runConversationQueue(conversationId);

    const targetStats = getImageConversationStats(baseConversation);
    if (targetStats.running > 0 || targetStats.queued > 1) {
      toast.success("已加入当前对话队列");
    } else if (!targetConversation) {
      toast.success("已创建新对话并开始处理");
    } else {
      toast.success("已发送到当前对话");
    }
    } finally {
      isSubmittingRef.current = false;
    }
  };

  return (
    <>
      <section className="mx-auto grid h-[calc(100vh-5.5rem)] min-h-0 w-full max-w-[1380px] grid-cols-1 gap-3 px-1 pb-4 sm:px-3 sm:pb-6 lg:h-[calc(100vh-5rem)] lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className={cn(
          "fixed inset-0 z-[100] bg-background transition-all lg:relative lg:inset-auto lg:z-0 lg:block lg:bg-transparent",
          isSidebarOpen ? "block" : "hidden"
        )}>
          <div className="flex h-full flex-col px-4 pt-6 lg:p-0">
            <div className="mb-4 flex items-center justify-between lg:hidden">
              <span className="text-lg font-bold text-foreground">历史对话</span>
              <button
                type="button"
                className="flex size-9 items-center justify-center rounded-xl bg-secondary text-muted-foreground"
                onClick={() => setIsSidebarOpen(false)}
              >
                <X className="size-5" />
              </button>
            </div>
            <ImageSidebar
              conversations={conversations}
              isLoadingHistory={isLoadingHistory}
              selectedConversationId={selectedConversationId}
              onCreateDraft={handleCreateDraft}
              onClearHistory={handleClearHistory}
              onSelectConversation={setSelectedConversationId}
              onDeleteConversation={handleDeleteConversation}
              formatConversationTime={formatConversationTime}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3 sm:gap-4">
          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              className="flex h-10 items-center gap-2 rounded-xl bg-card px-4 text-sm font-medium text-muted-foreground shadow-sm border border-border/60 transition hover:bg-secondary hover:text-foreground"
              onClick={() => setIsSidebarOpen(true)}
            >
              <MessageSquarePlus className="size-4" />
              历史记录
            </button>
            {selectedConversation && (
              <div className="truncate text-sm font-semibold text-foreground">
                {selectedConversation.title}
              </div>
            )}
          </div>
          <div
            ref={resultsViewportRef}
            className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-3 sm:px-4 sm:py-4"
          >
            <ImageResults
              selectedConversation={selectedConversation}
              onOpenLightbox={openLightbox}
              onContinueEdit={handleContinueEdit}
              formatConversationTime={formatConversationTime}
            />
          </div>

          <ImageComposer
            mode={imageMode}
            prompt={imagePrompt}
            imageCount={imageCount}
            availableQuota={availableQuota}
            activeTaskCount={activeTaskCount}
            referenceImages={referenceImages}
            textareaRef={textareaRef}
            fileInputRef={fileInputRef}
            onModeChange={setImageMode}
            onPromptChange={setImagePrompt}
            onImageCountChange={setImageCount}
            onSubmit={handleSubmit}
            onPickReferenceImage={() => fileInputRef.current?.click()}
            onReferenceImageChange={handleReferenceImageChange}
            onRemoveReferenceImage={handleRemoveReferenceImage}
          />
        </div>
      </section>

      <ImageLightbox
        images={lightboxImages}
        currentIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        onIndexChange={setLightboxIndex}
      />
    </>
  );
}
