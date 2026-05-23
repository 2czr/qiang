"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth, authFetch } from "@/lib/auth-context";

interface FriendInfo {
  requestId: string;
  friendId: string;
  nickname: string;
  avatar_url: string | null;
  becameFriendsAt: string;
}

interface FriendRequestInfo {
  id: string;
  status: string;
  created_at: string;
  sender?: { id: string; nickname: string; avatar_url: string | null };
  receiver?: { id: string; nickname: string; avatar_url: string | null };
}

type SubTab = "friends" | "received" | "sent";

export function FriendsPanel() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<FriendRequestInfo[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequestInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<SubTab>("friends");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);

  const pendingCount = receivedRequests.filter((r) => r.status === "pending").length;

  const avatarColors = ["bg-[#07c160]", "bg-[#fa9d3b]", "bg-[#576b95]", "bg-[#f55f4e]", "bg-[#7c6edb]"];
  const getAvatarColor = (id: string) => avatarColors[Math.abs(id.charCodeAt(0)) % avatarColors.length];

  const fetchFriends = useCallback(async () => {
    try {
      const res = await authFetch("/api/friends/list");
      if (res.ok) { const data = await res.json(); setFriends(data.friends || []); }
    } catch { /* ignore */ }
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      const [receivedRes, sentRes] = await Promise.all([
        authFetch("/api/friends/request?type=received"),
        authFetch("/api/friends/request?type=sent"),
      ]);
      if (receivedRes.ok) { const data = await receivedRes.json(); setReceivedRequests(data.requests || []); }
      if (sentRes.ok) { const data = await sentRes.json(); setSentRequests(data.requests || []); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchFriends(), fetchRequests()]);
      setLoading(false);
    };
    if (user) load();
  }, [user, fetchFriends, fetchRequests]);

  const handleRespond = async (requestId: string, action: "accept" | "reject") => {
    try {
      const res = await authFetch("/api/friends/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      if (res.ok) { fetchFriends(); fetchRequests(); }
      else { const data = await res.json(); alert(data.error || "操作失败"); }
    } catch { alert("网络错误"); }
  };

  const handleRemoveFriend = async (friendId: string) => {
    setRemovingId(friendId);
    try {
      const res = await authFetch("/api/friends/list", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId }),
      });
      if (res.ok) { setFriends((prev) => prev.filter((f) => f.friendId !== friendId)); }
      else { const data = await res.json(); alert(data.error || "删除失败"); }
    } catch { alert("网络错误"); }
    finally { setRemovingId(null); setRemoveConfirm(null); }
  };

  const handleStartChat = (friendId: string, nickname: string) => {
    window.dispatchEvent(new CustomEvent("start-private-chat", { detail: { userId: friendId, nickname } }));
  };

  const formatTime = (dateStr: string) => {
    try { const d = new Date(dateStr); return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" }); }
    catch { return ""; }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full bg-[#f5f5f5]"><div className="w-6 h-6 border-2 border-[#07c160] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col h-full bg-[#f5f5f5]">
      {/* Sub-tabs */}
      <div className="flex bg-white border-b border-gray-100 shrink-0">
        <button onClick={() => setSubTab("friends")} className={`flex-1 h-10 text-xs font-medium relative ${subTab === "friends" ? "text-[#07c160]" : "text-gray-400"}`}>
          好友({friends.length})
          {subTab === "friends" && <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[#07c160] rounded-full" />}
        </button>
        <button onClick={() => setSubTab("received")} className={`flex-1 h-10 text-xs font-medium relative ${subTab === "received" ? "text-[#07c160]" : "text-gray-400"}`}>
          收到请求{pendingCount > 0 && <span className="ml-1 min-w-[16px] h-4 px-1 rounded-full bg-[#f55f4e] text-white text-[10px] inline-flex items-center justify-center">{pendingCount}</span>}
          {subTab === "received" && <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[#07c160] rounded-full" />}
        </button>
        <button onClick={() => setSubTab("sent")} className={`flex-1 h-10 text-xs font-medium relative ${subTab === "sent" ? "text-[#07c160]" : "text-gray-400"}`}>
          已发送
          {subTab === "sent" && <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[#07c160] rounded-full" />}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {subTab === "friends" && (
          friends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <svg className="w-12 h-12 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm">还没有好友</p>
              <p className="text-xs mt-1">去校园墙加好友吧</p>
            </div>
          ) : (
            <div className="bg-white mt-1">
              {friends.map((friend) => (
                <div key={friend.friendId} className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-50 last:border-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0 ${getAvatarColor(friend.friendId)}`}>
                    {friend.nickname?.[0] || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{friend.nickname}</p>
                    <p className="text-[10px] text-gray-400">好友于 {formatTime(friend.becameFriendsAt)}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button className="px-3 h-7 rounded-full text-xs font-medium bg-[#07c160]/10 text-[#07c160] active:bg-[#07c160]/20" onClick={() => handleStartChat(friend.friendId, friend.nickname)}>
                      私聊
                    </button>
                    <button className="w-7 h-7 rounded-full flex items-center justify-center text-gray-300 active:text-red-400" onClick={() => setRemoveConfirm(friend.friendId)} disabled={removingId === friend.friendId}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {subTab === "received" && (
          receivedRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <svg className="w-12 h-12 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-sm">暂无好友请求</p>
            </div>
          ) : (
            <div className="bg-white mt-1">
              {receivedRequests.map((req) => (
                <div key={req.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-50 last:border-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0 ${getAvatarColor(req.sender?.id || "")}`}>
                    {req.sender?.nickname?.[0] || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{req.sender?.nickname || "未知用户"}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {req.status === "pending" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#fa9d3b]/15 text-[#fa9d3b]">待处理</span>}
                      {req.status === "accepted" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#07c160]/15 text-[#07c160]">已接受</span>}
                      {req.status === "rejected" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">已拒绝</span>}
                      <span className="text-[10px] text-gray-400">{formatTime(req.created_at)}</span>
                    </div>
                  </div>
                  {req.status === "pending" && (
                    <div className="flex gap-1.5 shrink-0">
                      <button className="px-3 h-7 rounded-full text-xs font-medium bg-[#07c160] text-white active:bg-[#06ad56]" onClick={() => handleRespond(req.id, "accept")}>接受</button>
                      <button className="px-3 h-7 rounded-full text-xs font-medium bg-gray-100 text-gray-500 active:bg-gray-200" onClick={() => handleRespond(req.id, "reject")}>拒绝</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {subTab === "sent" && (
          sentRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <svg className="w-12 h-12 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <p className="text-sm">还没有发送过好友请求</p>
            </div>
          ) : (
            <div className="bg-white mt-1">
              {sentRequests.map((req) => (
                <div key={req.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-50 last:border-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0 ${getAvatarColor(req.receiver?.id || "")}`}>
                    {req.receiver?.nickname?.[0] || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{req.receiver?.nickname || "未知用户"}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {req.status === "pending" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#fa9d3b]/15 text-[#fa9d3b]">等待确认</span>}
                      {req.status === "accepted" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#07c160]/15 text-[#07c160]">已是好友</span>}
                      {req.status === "rejected" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-400">已拒绝</span>}
                      <span className="text-[10px] text-gray-400">{formatTime(req.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        <div className="h-4" />
      </div>

      {/* Remove friend confirmation */}
      {removeConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setRemoveConfirm(null)}>
          <div className="bg-white rounded-xl mx-6 w-72 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="py-5 px-4 text-center">
              <p className="text-sm text-gray-800">确定要删除此好友吗？</p>
            </div>
            <div className="flex border-t border-gray-100">
              <button onClick={() => setRemoveConfirm(null)} className="flex-1 h-10 text-sm text-gray-500 active:bg-gray-50">取消</button>
              <button onClick={() => handleRemoveFriend(removeConfirm)} className="flex-1 h-10 text-sm text-red-500 border-l border-gray-100 active:bg-gray-50">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
