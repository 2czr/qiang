"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Plus, Send, Users } from "lucide-react";
import { authFetch, useAuth } from "@/lib/auth-context";

interface GroupInfo {
  id: string;
  name: string;
  owner_id: string;
  member_count: number;
  last_message: string;
  last_time: string;
  created_at: string;
}

interface GroupMessage {
  id: string;
  group_id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  users: {
    nickname: string;
    avatar_url: string | null;
    username?: string;
    role?: string;
  } | null;
}

interface FriendInfo {
  friendId: string;
  nickname: string;
  avatar_url: string | null;
}

interface MemberInfo {
  user_id: string;
  users: {
    id: string;
    nickname: string;
    avatar_url: string | null;
  } | null;
}

type PickerMode = "create" | "add";

export function GroupChat() {
  const { user, token } = useAuth();
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [activeGroup, setActiveGroup] = useState<GroupInfo | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ url: string; file: File } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const avatarColors = ["bg-[#07c160]", "bg-[#fa9d3b]", "bg-[#576b95]", "bg-[#f55f4e]", "bg-[#7c6edb]"];
  const getAvatarColor = (id: string) => avatarColors[Math.abs((id || "0").charCodeAt(0)) % avatarColors.length];

  const fetchGroups = useCallback(async () => {
    try {
      const res = await authFetch("/api/chat/groups");
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
      }
    } catch {
      // Polling and background refresh errors can be ignored in the UI.
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFriends = useCallback(async () => {
    try {
      const res = await authFetch("/api/friends/list");
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
      }
    } catch {
      // Ignore.
    }
  }, []);

  const fetchMembers = useCallback(async (groupId: string) => {
    try {
      const res = await authFetch(`/api/chat/groups/members?groupId=${groupId}`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch {
      // Ignore.
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!activeGroup) return;
    try {
      const res = await authFetch(`/api/chat/groups/messages?groupId=${activeGroup.id}&limit=80`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {
      // Ignore.
    }
  }, [activeGroup]);

  useEffect(() => {
    if (!user) return;
    void Promise.all([fetchGroups(), fetchFriends()]);
  }, [user, fetchGroups, fetchFriends]);

  useEffect(() => {
    if (!activeGroup) return;
    void fetchMessages();
    void fetchMembers(activeGroup.id);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(fetchMessages, 3000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [activeGroup, fetchMessages, fetchMembers]);

  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const checkNearBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const formatTimeShort = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    } catch {
      return "";
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const now = new Date();
      const date = new Date(dateStr);
      const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
      if (minutes < 1) return "now";
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h`;
      return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  const openPicker = (mode: PickerMode) => {
    setPickerMode(mode);
    setSelectedFriendIds([]);
    if (mode === "create") {
      setGroupName("");
    }
  };

  const closePicker = () => {
    setPickerMode(null);
    setSelectedFriendIds([]);
    setSaving(false);
  };

  const toggleFriend = (friendId: string) => {
    setSelectedFriendIds((prev) => (
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    ));
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedFriendIds.length === 0) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/chat/groups", {
        method: "POST",
        body: JSON.stringify({ name: groupName.trim(), memberIds: selectedFriendIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setGroups((prev) => [data.group, ...prev]);
      setActiveGroup(data.group);
      closePicker();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Create failed");
      setSaving(false);
    }
  };

  const handleAddMembers = async () => {
    if (!activeGroup || selectedFriendIds.length === 0) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/chat/groups/members", {
        method: "POST",
        body: JSON.stringify({ groupId: activeGroup.id, memberIds: selectedFriendIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Add failed");
      await Promise.all([fetchMembers(activeGroup.id), fetchGroups()]);
      setActiveGroup((prev) => prev ? { ...prev, member_count: prev.member_count + (data.added || 0) } : prev);
      closePicker();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Add failed");
      setSaving(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be smaller than 5MB");
      return;
    }
    setPendingImage({ url: URL.createObjectURL(file), file });
    e.target.value = "";
  };

  const uploadPendingImage = async () => {
    if (!pendingImage) return null;
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
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) throw new Error(uploadData.error || "Image upload failed");
      return uploadData.url || uploadData.imageUrl || null;
    } finally {
      URL.revokeObjectURL(pendingImage.url);
      setPendingImage(null);
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if (!activeGroup || (!newMessage.trim() && !pendingImage)) return;

    let imageUrl: string | null = null;
    try {
      imageUrl = await uploadPendingImage();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Image upload failed");
      return;
    }

    const content = newMessage.trim();
    setNewMessage("");
    try {
      const res = await authFetch("/api/chat/groups/messages", {
        method: "POST",
        body: JSON.stringify({ groupId: activeGroup.id, content, imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setMessages((prev) => [...prev, data.message]);
      isNearBottomRef.current = true;
      void fetchGroups();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Send failed");
    }
  };

  const unavailableFriendIds = new Set(members.map((member) => member.user_id));
  const selectableFriends = pickerMode === "add"
    ? friends.filter((friend) => !unavailableFriendIds.has(friend.friendId))
    : friends;

  if (loading) {
    return <div className="flex items-center justify-center h-full bg-[#f5f5f5]"><div className="w-6 h-6 border-2 border-[#07c160] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col h-full bg-[#f5f5f5]">
      {!activeGroup ? (
        <>
          <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-[#07c160]" />
              <span className="text-sm font-medium text-gray-800">Groups</span>
            </div>
            <button
              onClick={() => openPicker("create")}
              className="h-8 px-3 rounded-full bg-[#07c160] text-white text-xs font-medium flex items-center gap-1 active:bg-[#06ad56]"
            >
              <Plus size={14} />
              New
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                <Users size={52} strokeWidth={1} className="mb-2 opacity-40" />
                <p className="text-sm">No groups yet</p>
                <p className="text-xs mt-1">Create a small group from your friends</p>
              </div>
            ) : (
              <div className="bg-white mt-1">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => setActiveGroup(group)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 border-b border-gray-50 last:border-0 text-left active:bg-gray-50"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0 ${getAvatarColor(group.id)}`}>
                      {group.name[0] || "G"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-800 truncate">{group.name}</span>
                        <span className="text-[10px] text-gray-400 shrink-0 ml-2">{formatRelativeTime(group.last_time)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-gray-400 truncate">{group.last_message || "No messages yet"}</p>
                        <span className="text-[10px] text-gray-400 ml-2 shrink-0">{group.member_count} members</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-100 shrink-0">
            <button
              className="w-8 h-8 flex items-center justify-center text-gray-600"
              onClick={() => {
                setActiveGroup(null);
                setMessages([]);
                void fetchGroups();
              }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ${getAvatarColor(activeGroup.id)}`}>
              {activeGroup.name[0] || "G"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{activeGroup.name}</p>
              <p className="text-[10px] text-gray-400">{activeGroup.member_count} members</p>
            </div>
            <button
              onClick={() => openPicker("add")}
              className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center active:bg-gray-200"
              title="Add friends"
            >
              <Plus size={16} />
            </button>
          </div>

          <div ref={messagesContainerRef} onScroll={checkNearBottom} className="flex-1 overflow-y-auto px-3 py-2">
            <div className="space-y-3">
              {messages.map((msg) => {
                const isSelf = msg.user_id === user?.id;
                const nickname = msg.users?.nickname || "User";
                return (
                  <div key={msg.id} className={`flex gap-2 ${isSelf ? "flex-row-reverse" : ""}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0 ${getAvatarColor(msg.user_id)}`}>
                      {nickname[0] || "?"}
                    </div>
                    <div className={`max-w-[70%] ${isSelf ? "items-end" : "items-start"}`}>
                      <div className={`flex items-center gap-1 mb-0.5 ${isSelf ? "flex-row-reverse" : ""}`}>
                        <span className="text-[11px] text-gray-500">{nickname}</span>
                        <span className="text-[10px] text-gray-400">{formatTimeShort(msg.created_at)}</span>
                      </div>
                      <div className={`inline-block px-3 py-2 rounded-xl text-[13px] leading-5 shadow-sm ${
                        isSelf ? "bg-[#95ec69] text-gray-800 rounded-tr-sm" : "bg-white text-gray-800 rounded-tl-sm"
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

          <div className="bg-white border-t border-gray-100 px-3 py-2 shrink-0">
            {pendingImage && (
              <div className="mb-2 relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pendingImage.url} alt="" className="h-16 w-16 object-cover rounded-lg" />
                <button
                  onClick={() => {
                    URL.revokeObjectURL(pendingImage.url);
                    setPendingImage(null);
                  }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center text-xs"
                >
                  x
                </button>
              </div>
            )}
            <div className="flex gap-2 items-center">
              <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageSelect} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-8 h-8 flex items-center justify-center text-gray-400 shrink-0">
                <Image size={20} strokeWidth={1.8} />
              </button>
              <input
                placeholder="Message the group..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                className="flex-1 h-9 px-3 text-sm bg-[#f5f5f5] rounded-full outline-none focus:ring-1 focus:ring-[#07c160]"
              />
              <button
                onClick={() => void handleSend()}
                disabled={(!newMessage.trim() && !pendingImage) || uploading}
                className="w-8 h-8 flex items-center justify-center text-[#07c160] disabled:text-gray-300 shrink-0"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </>
      )}

      {pickerMode && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={closePicker}>
          <div className="w-full bg-white rounded-t-2xl max-h-[82vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-8 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="px-4 pb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-800">{pickerMode === "create" ? "Create group" : "Add friends"}</span>
                <span className="text-xs text-gray-400">Selected {selectedFriendIds.length}</span>
              </div>
              {pickerMode === "create" && (
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Group name"
                  className="w-full h-10 px-3 mb-3 text-sm bg-gray-50 rounded-lg outline-none focus:ring-1 focus:ring-[#07c160]"
                />
              )}
              <div className="max-h-72 overflow-y-auto border border-gray-100 rounded-lg">
                {selectableFriends.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-400">
                    {friends.length === 0 ? "No friends yet" : "No friends available"}
                  </div>
                ) : (
                  selectableFriends.map((friend) => {
                    const checked = selectedFriendIds.includes(friend.friendId);
                    return (
                      <button
                        key={friend.friendId}
                        onClick={() => toggleFriend(friend.friendId)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 border-b border-gray-50 last:border-0 text-left active:bg-gray-50"
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAvatarColor(friend.friendId)}`}>
                          {friend.nickname[0] || "?"}
                        </div>
                        <span className="flex-1 text-sm text-gray-800 truncate">{friend.nickname}</span>
                        <span className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          checked ? "bg-[#07c160] border-[#07c160]" : "border-gray-300"
                        }`}>
                          {checked && <span className="w-2 h-2 rounded-full bg-white" />}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={closePicker} className="flex-1 h-10 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium">
                  Cancel
                </button>
                <button
                  onClick={() => pickerMode === "create" ? void handleCreateGroup() : void handleAddMembers()}
                  disabled={saving || selectedFriendIds.length === 0 || (pickerMode === "create" && !groupName.trim())}
                  className="flex-1 h-10 rounded-lg bg-[#07c160] text-white text-sm font-medium disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {pickerMode === "create" ? "Create" : "Add"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
