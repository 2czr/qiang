"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth, authFetch } from "@/lib/auth-context";
import { Switch } from "@/components/ui/switch";

interface ChatRoomInfo {
  id: string;
  name: string;
  description: string | null;
}

interface ChatMessage {
  id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  user_id: string;
  users: { nickname: string; avatar_url: string | null; username?: string; role?: string };
}

interface UserInfoDialog {
  open: boolean;
  user: {
    id: string;
    nickname: string;
    avatar_url: string | null;
    username?: string;
    role?: string;
    status?: string;
    permissions?: Record<string, boolean>;
  } | null;
}

type FriendRelation = "none" | "friends" | "sent" | "pending" | "rejected" | "loading";

function UserPostsPanel({ userId, nickname }: { userId: string; nickname: string }) {
  useAuth(); // for context subscription
  const [posts, setPosts] = useState<{ id: string; content: string; is_anonymous: boolean; is_pinned: boolean; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await authFetch(`/api/admin/users/${userId}/posts?pageSize=20`);
        if (res.ok) { const data = await res.json(); setPosts(data.posts || []); }
      } catch { /* ignore */ } finally { setLoading(false); }
    };
    if (userId) fetchPosts();
  }, [userId]);

  if (loading) return <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-[#07c160] border-t-transparent rounded-full animate-spin" /></div>;
  if (posts.length === 0) return <p className="text-xs text-gray-400 text-center py-4">{nickname} 还没有发过帖子</p>;

  return (
    <div className="space-y-1.5 max-h-48 overflow-y-auto">
      {posts.map((post) => (
        <div key={post.id} className="rounded-lg bg-gray-50 p-2">
          <div className="flex items-center gap-1 mb-0.5">
            {post.is_pinned && <span className="text-[10px] px-1 py-0.5 rounded bg-[#fa9d3b]/15 text-[#fa9d3b]">置顶</span>}
            {post.is_anonymous && <span className="text-[10px] px-1 py-0.5 rounded bg-gray-100 text-gray-500">匿名</span>}
            <span className="text-[10px] text-gray-400">{new Date(post.created_at).toLocaleString("zh-CN")}</span>
          </div>
          <p className="text-xs line-clamp-2">{post.content}</p>
        </div>
      ))}
    </div>
  );
}

function UserMessagesPanel({ userId, nickname }: { userId: string; nickname: string }) {
  useAuth(); // for context subscription
  const [chatMessages, setChatMessages] = useState<{ id: string; content: string; room_id: string; created_at: string; chat_rooms: { name: string } | null }[]>([]);
  const [privateMessages, setPrivateMessages] = useState<{ id: string; content: string; sender_id: string; receiver_id: string; created_at: string; sender: { nickname: string } | null; receiver: { nickname: string } | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"chat" | "private">("chat");

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await authFetch(`/api/admin/users/${userId}/messages?limit=30`);
        if (res.ok) { const data = await res.json(); setChatMessages(data.chatMessages || []); setPrivateMessages(data.privateMessages || []); }
      } catch { /* ignore */ } finally { setLoading(false); }
    };
    if (userId) fetchMessages();
  }, [userId]);

  if (loading) return <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-[#07c160] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <button onClick={() => setTab("chat")} className={`px-3 py-1 rounded-full text-xs ${tab === "chat" ? "bg-[#07c160] text-white" : "bg-gray-100 text-gray-500"}`}>
          聊天室 ({chatMessages.length})
        </button>
        <button onClick={() => setTab("private")} className={`px-3 py-1 rounded-full text-xs ${tab === "private" ? "bg-[#07c160] text-white" : "bg-gray-100 text-gray-500"}`}>
          私信 ({privateMessages.length})
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto space-y-1">
        {tab === "chat" ? (
          chatMessages.length === 0 ? <p className="text-xs text-gray-400 text-center py-3">暂无聊天室消息</p> :
          chatMessages.map((msg) => (
            <div key={msg.id} className="rounded-lg bg-gray-50 p-2">
              <span className="text-[10px] text-gray-400">{msg.chat_rooms?.name} · {new Date(msg.created_at).toLocaleString("zh-CN")}</span>
              <p className="text-xs line-clamp-2 mt-0.5">{msg.content}</p>
            </div>
          ))
        ) : (
          privateMessages.length === 0 ? <p className="text-xs text-gray-400 text-center py-3">暂无私信记录</p> :
          privateMessages.map((msg) => (
            <div key={msg.id} className="rounded-lg bg-gray-50 p-2">
              <span className="text-[10px] text-gray-400">{msg.sender?.nickname} → {msg.receiver?.nickname} · {new Date(msg.created_at).toLocaleString("zh-CN")}</span>
              <p className="text-xs line-clamp-2 mt-0.5">{msg.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function ChatRoom() {
  const { user, token } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "admin" || isSuperAdmin;
  const [rooms, setRooms] = useState<ChatRoomInfo[]>([]);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userInfoDialog, setUserInfoDialog] = useState<UserInfoDialog>({ open: false, user: null });
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [detailPanel, setDetailPanel] = useState<"none" | "posts" | "messages">("none");
  const [friendRelation, setFriendRelation] = useState<FriendRelation>("none");
  const [chatFriendStatuses, setChatFriendStatuses] = useState<Record<string, FriendRelation>>({});
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pendingImage, setPendingImage] = useState<{ url: string; file: File } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const avatarColors = ["bg-[#07c160]", "bg-[#fa9d3b]", "bg-[#576b95]", "bg-[#f55f4e]", "bg-[#7c6edb]"];
  const getAvatarColor = (id: string) => avatarColors[Math.abs(id.charCodeAt(0)) % avatarColors.length];

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await fetch("/api/chat/rooms");
        if (res.ok) {
          const data = await res.json();
          setRooms(data.rooms || []);
          if (data.rooms?.length > 0 && !activeRoom) setActiveRoom(data.rooms[0].id);
        }
      } catch { /* ignore */ } finally { setLoading(false); }
    };
    fetchRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!activeRoom) return;
    try {
      const res = await fetch(`/api/chat/messages?roomId=${activeRoom}&limit=50`);
      if (res.ok) { const data = await res.json(); setMessages(data.messages || []); }
    } catch { /* ignore */ }
  }, [activeRoom]);

  useEffect(() => {
    fetchMessages();
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    const currentRoom = activeRoom;
    pollIntervalRef.current = setInterval(() => {
      if (currentRoom) {
        fetch(`/api/chat/messages?roomId=${currentRoom}&limit=50`)
          .then((res) => res.json())
          .then((data) => { if (data.messages?.length > 0) setMessages(data.messages); })
          .catch(() => {});
      }
    }, 3000);
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [activeRoom, fetchMessages]);

  // 智能滚动：仅当用户已在底部附近或自己发消息时才自动滚到底部
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

  useEffect(() => {
    if (!user) return;
    const userIds = [...new Set(messages.map((msg) => msg.user_id).filter((id) => id !== user.id && !chatFriendStatuses[id]))];
    if (userIds.length === 0) return;

    Promise.all(userIds.map(async (uid) => {
      try {
        const res = await authFetch(`/api/friends/status?userId=${uid}`);
        if (!res.ok) return null;
        const data = await res.json();
        return { uid, status: (data.status || "none") as FriendRelation };
      } catch {
        return null;
      }
    })).then((results) => {
      const statuses: Record<string, FriendRelation> = {};
      results.forEach((result) => {
        if (result) statuses[result.uid] = result.status;
      });
      setChatFriendStatuses((prev) => ({ ...prev, ...statuses }));
    });
  }, [messages, user, chatFriendStatuses]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) { alert("图片不能超过5MB"); return; }
    setPendingImage({ url: URL.createObjectURL(file), file });
    e.target.value = "";
  };

  const handleSend = async () => {
    if (!activeRoom) return;
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
      const res = await authFetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: activeRoom, content, imageUrl }),
      });
      if (res.ok) { const data = await res.json(); setMessages((prev) => [...prev, data.message]); isNearBottomRef.current = true; }
    } catch { /* ignore */ }
  };

  const handleAvatarClick = async (msgUser: ChatMessage["users"], msgUserId: string) => {
    if (msgUserId === user?.id) return;
    setDetailPanel("none");
    const basicInfo: UserInfoDialog["user"] = { ...msgUser, id: msgUserId };
    setUserInfoDialog({ open: true, user: basicInfo });
    setFriendRelation("loading");

    try {
      const res = await authFetch(`/api/friends/status?userId=${msgUserId}`);
      if (res.ok) {
        const data = await res.json();
        setFriendRelation(data.status || "none");
      } else {
        setFriendRelation("none");
      }
    } catch {
      setFriendRelation("none");
    }

    if (isSuperAdmin) {
      try {
        const res = await authFetch(`/api/admin/users/${msgUserId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUserInfoDialog({
              open: true,
              user: { id: data.user.id, nickname: data.user.nickname, avatar_url: data.user.avatar_url, username: data.user.username, role: data.user.role, status: data.user.status, permissions: data.user.permissions },
            });
          }
        }
      } catch { /* keep basic */ }
    }
  };

  const handleFreezeUser = async () => {
    if (!userInfoDialog.user?.id || !isSuperAdmin) return;
    setAdminActionLoading(true);
    try {
      const res = await authFetch(`/api/admin/users/${userInfoDialog.user.id}/freeze`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const newStatus = data.status || (userInfoDialog.user.status === "frozen" ? "active" : "frozen");
        setUserInfoDialog({ open: true, user: { ...userInfoDialog.user!, status: newStatus } });
      } else { alert(data.error || "操作失败"); }
    } catch { alert("操作失败"); } finally { setAdminActionLoading(false); }
  };

  const handleDeleteUser = async () => {
    if (!userInfoDialog.user?.id || !isSuperAdmin) return;
    setAdminActionLoading(true);
    try {
      const res = await authFetch(`/api/admin/users/${userInfoDialog.user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) { setUserInfoDialog({ open: false, user: null }); } else { alert(data.error || "操作失败"); }
    } catch { alert("操作失败"); } finally { setAdminActionLoading(false); }
  };

  const handleSetRole = async (role: "user" | "admin") => {
    if (!userInfoDialog.user?.id || !isSuperAdmin) return;
    setAdminActionLoading(true);
    try {
      const res = await authFetch(`/api/admin/users/${userInfoDialog.user.id}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (res.ok) { setUserInfoDialog({ open: true, user: { ...userInfoDialog.user!, role } }); }
      else { alert(data.error || "操作失败"); }
    } catch { alert("操作失败"); } finally { setAdminActionLoading(false); }
  };

  const formatTimeShort = (dateStr: string) => {
    try { const d = new Date(dateStr); return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`; }
    catch { return ""; }
  };

  const handleAddFriend = async (receiverId: string) => {
    try {
      const res = await authFetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId }),
      });
      const data = await res.json();
      if (res.ok && data.request) {
        const nextStatus = data.autoAccepted ? "friends" : "sent";
        setFriendRelation(nextStatus);
        setChatFriendStatuses((prev) => ({ ...prev, [receiverId]: nextStatus }));
      } else {
        alert(data.error || "发送好友请求失败");
      }
    } catch {
      alert("发送好友请求失败");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-[#07c160] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Room tabs */}
      <div className="flex gap-2 px-3 py-2 bg-white border-b border-gray-100 shrink-0">
        {rooms.map((room) => (
          <button
            key={room.id}
            onClick={() => setActiveRoom(room.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeRoom === room.id ? "bg-[#07c160] text-white" : "bg-gray-100 text-gray-500"
            }`}
          >
            {room.name}
          </button>
        ))}
      </div>

      {/* Super admin notice */}
      {isSuperAdmin && (
        <div className="px-3 py-1.5 bg-[#fa9d3b]/10 text-[#fa9d3b] text-[11px] shrink-0">
          超管模式：可查看所有用户信息
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={checkNearBottom}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-3 bg-[#f5f5f5]"
        key={activeRoom || "default"}
      >
        {messages.map((msg) => {
          const isSelf = msg.user_id === user?.id;
          return (
            <div key={msg.id} className={`flex gap-2 ${isSelf ? "flex-row-reverse" : ""}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0 cursor-pointer ${isSelf ? getAvatarColor(user?.id || "") : getAvatarColor(msg.user_id)}`}
                onClick={() => handleAvatarClick(msg.users, msg.user_id)}
              >
                {msg.users?.nickname?.[0] || "?"}
              </div>
              <div className={`max-w-[70%] ${isSelf ? "items-end" : "items-start"}`}>
                <div className={`flex items-center gap-1 mb-0.5 ${isSelf ? "flex-row-reverse" : ""}`}>
                  <span className="text-[11px] text-gray-500">{msg.users?.nickname || "未知"}</span>
                  {isAdmin && msg.users?.username && (
                    <span className="text-[10px] text-[#fa9d3b]">@{msg.users.username}</span>
                  )}
                  <span className="text-[10px] text-gray-400">{formatTimeShort(msg.created_at)}</span>
                  {!isSelf && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddFriend(msg.user_id);
                      }}
                      disabled={chatFriendStatuses[msg.user_id] === "friends" || chatFriendStatuses[msg.user_id] === "sent"}
                      className="text-[10px] text-[#07c160] disabled:text-gray-400"
                    >
                      {chatFriendStatuses[msg.user_id] === "friends"
                        ? "好友"
                        : chatFriendStatuses[msg.user_id] === "sent"
                          ? "已申请"
                          : chatFriendStatuses[msg.user_id] === "pending"
                            ? "接受"
                            : "加好友"}
                    </button>
                  )}
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

      {/* Input bar */}
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

      {/* User Info Dialog - mobile bottom sheet style */}
      {userInfoDialog.open && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => { setUserInfoDialog({ open: false, user: null }); setDetailPanel("none"); }}>
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[80vh] overflow-y-auto animate-slide-up" onClick={(e) => e.stopPropagation()}>
            {/* Handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-8 h-1 bg-gray-200 rounded-full" />
            </div>

            {userInfoDialog.user && (
              <div className="px-4 pb-6 space-y-3">
                {/* User basic info */}
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-medium ${
                    userInfoDialog.user.status === "frozen" ? "bg-gray-400" : getAvatarColor(userInfoDialog.user.id)
                  }`}>
                    {userInfoDialog.user.nickname?.[0] || "?"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{userInfoDialog.user.nickname}</span>
                      {userInfoDialog.user.status === "frozen" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">已封禁</span>
                      )}
                    </div>
                    {isSuperAdmin && userInfoDialog.user.username && (
                      <span className="text-xs text-gray-400">账号: {userInfoDialog.user.username}</span>
                    )}
                  </div>
                </div>

                {/* Super admin info */}
                {isSuperAdmin && (
                  <div className="flex gap-2">
                    <div className="flex-1 bg-gray-50 rounded-lg p-2.5">
                      <span className="text-[10px] text-gray-400">角色</span>
                      <p className="text-xs font-medium text-gray-700">
                        {userInfoDialog.user.role === "super_admin" ? "超级管理员" : userInfoDialog.user.role === "admin" ? "管理员" : "普通用户"}
                      </p>
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-lg p-2.5">
                      <span className="text-[10px] text-gray-400">账号</span>
                      <p className="text-xs font-medium text-gray-700">{userInfoDialog.user.username || "不可见"}</p>
                    </div>
                  </div>
                )}

                {/* Private chat button */}
                <button
                  className="w-full h-10 bg-[#07c160] text-white rounded-lg text-sm font-medium active:bg-[#06ad56]"
                  onClick={() => {
                    if (userInfoDialog.user?.id) {
                      window.dispatchEvent(new CustomEvent("start-private-chat", { detail: { userId: userInfoDialog.user.id, nickname: userInfoDialog.user.nickname } }));
                      setUserInfoDialog({ open: false, user: null });
                    }
                  }}
                >
                  发起私聊
                </button>

                {friendRelation !== "loading" && userInfoDialog.user?.id !== user?.id && (
                  <button
                    className="w-full h-10 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 active:bg-gray-200"
                    onClick={() => handleAddFriend(userInfoDialog.user!.id)}
                    disabled={friendRelation === "friends" || friendRelation === "sent"}
                  >
                    {friendRelation === "friends"
                      ? "已是好友"
                      : friendRelation === "sent"
                        ? "已发送申请"
                        : friendRelation === "pending"
                          ? "接受好友申请"
                          : "加好友"}
                  </button>
                )}

                {/* Super admin: View content */}
                {isSuperAdmin && userInfoDialog.user.role !== "super_admin" && (
                  <>
                    <div className="border-t border-gray-100 pt-3">
                      <p className="text-xs text-gray-400 mb-2">查看用户内容</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDetailPanel(detailPanel === "posts" ? "none" : "posts")}
                          className={`flex-1 h-8 rounded-lg text-xs font-medium ${
                            detailPanel === "posts" ? "bg-[#07c160] text-white" : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          查看帖子
                        </button>
                        <button
                          onClick={() => setDetailPanel(detailPanel === "messages" ? "none" : "messages")}
                          className={`flex-1 h-8 rounded-lg text-xs font-medium ${
                            detailPanel === "messages" ? "bg-[#07c160] text-white" : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          查看聊天
                        </button>
                      </div>
                    </div>

                    {detailPanel === "posts" && userInfoDialog.user.id && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <UserPostsPanel userId={userInfoDialog.user.id} nickname={userInfoDialog.user.nickname} />
                      </div>
                    )}
                    {detailPanel === "messages" && userInfoDialog.user.id && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <UserMessagesPanel userId={userInfoDialog.user.id} nickname={userInfoDialog.user.nickname} />
                      </div>
                    )}

                    {/* Role management */}
                    <div className="border-t border-gray-100 pt-3">
                      <p className="text-xs text-gray-400 mb-2">角色管理</p>
                      <div className="flex gap-2">
                        <button
                          className={`flex-1 h-8 rounded-lg text-xs font-medium ${
                            userInfoDialog.user.role === "user" ? "bg-[#07c160] text-white" : "bg-gray-100 text-gray-600"
                          }`}
                          disabled={adminActionLoading || userInfoDialog.user.role === "user"}
                          onClick={() => handleSetRole("user")}
                        >
                          普通用户
                        </button>
                        <button
                          className={`flex-1 h-8 rounded-lg text-xs font-medium ${
                            userInfoDialog.user.role === "admin" ? "bg-[#07c160] text-white" : "bg-gray-100 text-gray-600"
                          }`}
                          disabled={adminActionLoading || userInfoDialog.user.role === "admin"}
                          onClick={() => handleSetRole("admin")}
                        >
                          管理员
                        </button>
                      </div>
                    </div>

                    {/* Permissions - only for admin role */}
                    {userInfoDialog.user.role === "admin" && (
                      <div className="border-t border-gray-100 pt-3">
                        <p className="text-xs text-gray-400 mb-2">管理员权限配置</p>
                        <div className="space-y-1">
                          {[
                            { key: "canPin", label: "置顶帖子" },
                            { key: "canDelete", label: "删除内容" },
                            { key: "canViewUser", label: "查看用户信息" },
                            { key: "canManageRole", label: "角色管理" },
                          ].map((perm) => (
                            <label key={perm.key} className="flex items-center justify-between py-1.5">
                              <span className="text-xs text-gray-700">{perm.label}</span>
                              <Switch
                                checked={!!userInfoDialog.user?.permissions?.[perm.key]}
                                onCheckedChange={(checked: boolean) => {
                                  const currentPerms = userInfoDialog.user?.permissions ?? {};
                                  setUserInfoDialog(prev => prev?.user ? {
                                    ...prev,
                                    user: { ...prev.user, permissions: { ...currentPerms, [perm.key]: checked } }
                                  } : prev);
                                }}
                                disabled={adminActionLoading}
                              />
                            </label>
                          ))}
                          <button
                            className="w-full h-8 bg-[#07c160] text-white rounded-lg text-xs font-medium mt-2 active:bg-[#06ad56]"
                            disabled={adminActionLoading}
                            onClick={async () => {
                              setAdminActionLoading(true);
                              try {
                                const perms = userInfoDialog.user?.permissions ?? {};
                                const uid = userInfoDialog.user?.id;
                                if (!uid) return;
                                const res = await authFetch("/api/admin/users/" + uid + "/permissions", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ permissions: perms }),
                                });
                                const data = await res.json();
                                if (!res.ok) throw new Error(data.error);
                              } catch (err: unknown) {
                                alert("权限更新失败: " + (err instanceof Error ? err.message : "未知错误"));
                              } finally {
                                setAdminActionLoading(false);
                              }
                            }}
                          >
                            保存权限
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Account management */}
                    <div className="border-t border-gray-100 pt-3">
                      <p className="text-xs text-gray-400 mb-2">账号管理</p>
                      <div className="flex gap-2">
                        <button
                          className="flex-1 h-8 rounded-lg text-xs font-medium bg-blue-50 text-blue-600"
                          disabled={adminActionLoading}
                          onClick={handleFreezeUser}
                        >
                          {userInfoDialog.user.status === "frozen" ? "解封" : "封禁"}
                        </button>
                        <button
                          className="flex-1 h-8 rounded-lg text-xs font-medium bg-red-50 text-red-500"
                          disabled={adminActionLoading}
                          onClick={handleDeleteUser}
                        >
                          删除账号
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
