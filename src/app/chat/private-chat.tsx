"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth, type AuthUser, authFetch } from "@/lib/auth-context";

interface Conversation {
  peer_id: string;
  last_message: string;
  last_time: string;
  unread_count: number;
  peer: AuthUser | null;
}

interface PrivateMsg {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  image_url: string | null;
  is_read: boolean;
  created_at: string;
}

interface PrivateChatProps {
  initialPeer?: { userId: string; nickname: string } | null;
  onClearPeer?: () => void;
}

export function PrivateChat({ initialPeer, onClearPeer }: PrivateChatProps) {
  const { user, token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activePeerId, setActivePeerId] = useState<string | null>(null);
  const [activePeerNickname, setActivePeerNickname] = useState<string>("");
  const [messages, setMessages] = useState<PrivateMsg[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pendingImage, setPendingImage] = useState<{ url: string; file: File } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const avatarColors = ["bg-[#07c160]", "bg-[#fa9d3b]", "bg-[#576b95]", "bg-[#f55f4e]", "bg-[#7c6edb]"];
  const getAvatarColor = (id: string) => avatarColors[Math.abs(id.charCodeAt(0)) % avatarColors.length];

  const fetchConversations = useCallback(async () => {
    try {
      const res = await authFetch("/api/chat/private/list");
      if (res.ok) { const data = await res.json(); setConversations(data.conversations || []); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!activePeerId) return;
    try {
      const res = await authFetch(`/api/chat/private?peerId=${activePeerId}`);
      if (res.ok) { const data = await res.json(); setMessages(data.messages || []); }
    } catch { /* ignore */ }
  }, [activePeerId]);

  useEffect(() => {
    const handler = (e: CustomEvent<{ userId: string; nickname: string }>) => {
      const { userId, nickname } = e.detail;
      setActivePeerId(userId);
      setActivePeerNickname(nickname);
    };
    window.addEventListener("start-private-chat", handler as EventListener);
    return () => window.removeEventListener("start-private-chat", handler as EventListener);
  }, []);

  useEffect(() => {
    if (initialPeer) {
      setActivePeerId(initialPeer.userId);
      setActivePeerNickname(initialPeer.nickname);
      onClearPeer?.();
    }
  }, [initialPeer, onClearPeer]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    if (activePeerId) {
      fetchMessages();
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(fetchMessages, 3000);
      return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
    }
  }, [activePeerId, fetchMessages]);

  const isNearBottomRef = useRef(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const checkNearBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) { alert("图片不能超过5MB"); return; }
    setPendingImage({ url: URL.createObjectURL(file), file });
    e.target.value = "";
  };

  const handleSend = async () => {
    if (!activePeerId) return;
    if (!newMessage.trim() && !pendingImage) return;

    let imageUrl: string | null = null;
    if (pendingImage) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", pendingImage.file);
        const currentToken = token || localStorage.getItem("session_token");
        const uploadRes = await fetch("/api/upload/image", {
          method: "POST",
          body: formData,
          headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : {},
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          imageUrl = uploadData.url || uploadData.imageUrl;
        } else {
          const errData = await uploadRes.json().catch(() => ({}));
          alert(`图片上传失败: ${errData.error || "未知错误"}`);
        }
      } catch { /* ignore */ }
      URL.revokeObjectURL(pendingImage.url);
      setPendingImage(null);
      setUploading(false);
    }

    const content = newMessage.trim() || null;
    setNewMessage("");

    try {
      const res = await authFetch("/api/chat/private", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: activePeerId, content, imageUrl }),
      });
      if (res.ok) { const data = await res.json(); setMessages((prev) => [...prev, data.message]); fetchConversations(); }
    } catch { /* ignore */ }
  };

  const formatTimeShort = (dateStr: string) => {
    try { const d = new Date(dateStr); return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`; }
    catch { return ""; }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const now = new Date();
      const date = new Date(dateStr);
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return "刚刚";
      if (minutes < 60) return `${minutes}分钟前`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}小时前`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}天前`;
      return date.toLocaleDateString("zh-CN");
    } catch { return ""; }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-[#07c160] border-t-transparent rounded-full animate-spin" /></div>;
  }

  // Conversation list
  if (!activePeerId) {
    return (
      <div className="flex flex-col h-full bg-[#f5f5f5]">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <svg className="w-14 h-14 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm">暂无私信</p>
            <p className="text-xs mt-1">在聊天室点击头像可以发起私聊</p>
          </div>
        ) : (
          <div className="bg-white mt-1">
            {conversations.map((conv) => (
              <div
                key={conv.peer_id}
                className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-50 last:border-0 active:bg-gray-50 cursor-pointer"
                onClick={() => {
                  setActivePeerId(conv.peer_id);
                  setActivePeerNickname(conv.peer?.nickname || "用户");
                }}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0 ${getAvatarColor(conv.peer_id)}`}>
                  {conv.peer?.nickname?.[0] || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">{conv.peer?.nickname || "未知用户"}</span>
                    <span className="text-[10px] text-gray-400">{formatRelativeTime(conv.last_time)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-gray-400 truncate max-w-[200px]">{conv.last_message}</p>
                    {conv.unread_count > 0 && (
                      <span className="min-w-[16px] h-4 px-1 rounded-full bg-[#f55f4e] text-white text-[10px] flex items-center justify-center">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Chat view
  return (
    <div className="flex flex-col h-full bg-[#f5f5f5]">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2 bg-white border-b border-gray-100 shrink-0">
        <button
          className="w-8 h-8 flex items-center justify-center text-gray-600"
          onClick={() => { setActivePeerId(null); setActivePeerNickname(""); setMessages([]); fetchConversations(); }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium ${getAvatarColor(activePeerId)}`}>
          {activePeerNickname[0] || "?"}
        </div>
        <span className="text-sm font-medium text-gray-800">{activePeerNickname}</span>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} onScroll={checkNearBottom} className="flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-3">
        {messages.map((msg) => {
          const isSelf = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`flex gap-2 ${isSelf ? "flex-row-reverse" : ""}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0 ${isSelf ? getAvatarColor(user?.id || "") : getAvatarColor(activePeerId)}`}>
                {isSelf ? user?.nickname?.[0] || "?" : activePeerNickname[0] || "?"}
              </div>
              <div className={`max-w-[70%] ${isSelf ? "items-end" : "items-start"}`}>
                <div className={`flex items-center gap-1 mb-0.5 ${isSelf ? "flex-row-reverse" : ""}`}>
                  <span className="text-[10px] text-gray-400">{formatTimeShort(msg.created_at)}</span>
                </div>
                <div className={`inline-block px-3 py-2 rounded-xl text-[13px] leading-5 shadow-sm ${
                  isSelf
                    ? "bg-[#95ec69] text-gray-800 rounded-tr-sm"
                    : "bg-white text-gray-800 rounded-tl-sm"
                }`}>
                  {msg.content && <p>{msg.content}</p>}
                  {msg.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={msg.image_url} alt="" className="max-w-[180px] max-h-[180px] rounded-lg mt-1" onClick={() => window.open(msg.image_url!, "_blank")} />
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-100 px-3 py-2 shrink-0">
        {pendingImage && (
          <div className="mb-2 relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pendingImage.url} alt="" className="h-16 w-16 object-cover rounded-lg" />
            <button
              onClick={() => { URL.revokeObjectURL(pendingImage.url); setPendingImage(null); }}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center text-xs"
            >
              x
            </button>
          </div>
        )}
        <div className="flex gap-2 items-center">
          <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageSelect} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-8 h-8 flex items-center justify-center text-gray-400 shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <input
            placeholder="输入消息..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            className="flex-1 h-9 px-3 text-sm bg-[#f5f5f5] rounded-full outline-none focus:ring-1 focus:ring-[#07c160]"
          />
          <button
            onClick={handleSend}
            disabled={(!newMessage.trim() && !pendingImage) || uploading}
            className="w-8 h-8 flex items-center justify-center text-[#07c160] disabled:text-gray-300 shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
