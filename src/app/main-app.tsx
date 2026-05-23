"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, MessageCircle, Shield, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import CampusWall from "./wall/campus-wall";
import { ChatRoom } from "./chat/chat-room";
import { GroupChat } from "./chat/group-chat";
import { PrivateChat } from "./chat/private-chat";
import { FriendsPanel } from "./friends/friends-panel";
import { AdminPanel } from "./admin/admin-panel";

type Tab = "wall" | "chat" | "private" | "groups" | "friends" | "admin";

export default function MainApp() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("wall");
  const [privatePeerId, setPrivatePeerId] = useState<string | null>(null);
  const [privatePeerName, setPrivatePeerName] = useState<string | null>(null);

  const isSuperAdmin = user?.role === "super_admin";

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ userId: string; nickname?: string }>).detail;
      setPrivatePeerId(detail.userId);
      setPrivatePeerName(detail.nickname || null);
      setActiveTab("private");
    };
    window.addEventListener("start-private-chat", handler);
    return () => window.removeEventListener("start-private-chat", handler);
  }, []);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "wall", label: "Wall", icon: <LayoutGrid size={20} /> },
    { key: "chat", label: "Chat", icon: <MessageCircle size={20} /> },
    { key: "private", label: "DM", icon: <MessageCircle size={20} /> },
    { key: "groups", label: "Groups", icon: <Users size={20} /> },
    { key: "friends", label: "Friends", icon: <UserPlus size={20} /> },
    ...(isSuperAdmin
      ? [{ key: "admin" as Tab, label: "Admin", icon: <Shield size={20} /> }]
      : []),
  ];

  return (
    <div className="flex flex-col h-dvh bg-[#f0f2f5] overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "wall" && <CampusWall />}
        {activeTab === "chat" && <ChatRoom />}
        {activeTab === "private" && (
          <PrivateChat
            initialPeer={privatePeerId ? { userId: privatePeerId, nickname: privatePeerName || "User" } : null}
            onClearPeer={() => {
              setPrivatePeerId(null);
              setPrivatePeerName(null);
            }}
          />
        )}
        {activeTab === "groups" && <GroupChat />}
        {activeTab === "friends" && <FriendsPanel />}
        {activeTab === "admin" && <AdminPanel />}
      </div>

      <nav className="flex-shrink-0 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="flex items-center justify-around h-12">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                activeTab === tab.key ? "text-[#07c160]" : "text-gray-400"
              }`}
            >
              {tab.icon}
              <span className="text-[10px] mt-0.5 leading-tight">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
