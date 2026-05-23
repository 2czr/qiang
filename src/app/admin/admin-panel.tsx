"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";

// ========== Toast ==========
function ToastOverlay({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 99999, pointerEvents: "none",
        backgroundColor: "rgba(0,0,0,0.75)", color: "#fff",
        padding: "12px 24px", borderRadius: "12px",
        fontSize: "15px", fontWeight: 500,
        maxWidth: "80vw", textAlign: "center",
      }}
    >
      {message}
    </div>
  );
}

// ========== Confirm Dialog ==========
function ConfirmDialog({
  open, title, message, onConfirm, onCancel,
}: {
  open: boolean; title: string; message: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 99998,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{
        backgroundColor: "#fff", borderRadius: "16px", padding: "24px",
        width: "80vw", maxWidth: "320px",
      }}>
        <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px", color: "#1f2937" }}>{title}</h3>
        <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "20px" }}>{message}</p>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: "10px 0", borderRadius: "8px", backgroundColor: "#f3f4f6", color: "#374151", fontSize: "14px", fontWeight: 500, border: "none" }}
          >取消</button>
          <button
            onClick={onConfirm}
            style={{ flex: 1, padding: "10px 0", borderRadius: "8px", backgroundColor: "#ef4444", color: "#fff", fontSize: "14px", fontWeight: 500, border: "none" }}
          >确认</button>
        </div>
      </div>
    </div>
  );
}

// ========== Ad Form Dialog ==========
function AdFormDialog({
  open, ad, onSave, onCancel,
}: {
  open: boolean;
  ad: { title: string; image_url: string; link_url: string; description: string; sort_order: number } | null;
  onSave: (data: { title: string; image_url: string; link_url: string; description: string; sort_order: number }) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: "", image_url: "", link_url: "", description: "", sort_order: 0,
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ad) {
      setForm({
        title: ad.title || "",
        image_url: ad.image_url || "",
        link_url: ad.link_url || "",
        description: ad.description || "",
        sort_order: ad.sort_order || 0,
      });
    } else {
      setForm({ title: "", image_url: "", link_url: "", description: "", sort_order: 0 });
    }
  }, [ad, open]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) { alert("图片不能超过5MB"); return; }
    setUploading(true);
    try {
      const token = localStorage.getItem("session_token");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/image", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        setForm(prev => ({ ...prev, image_url: data.url }));
      } else {
        alert(`上传失败: ${data.error || "未知错误"}`);
      }
    } catch { alert("上传失败"); }
    setUploading(false);
    e.target.value = "";
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 99998,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{
        backgroundColor: "#fff", borderRadius: "16px", padding: "20px",
        width: "88vw", maxWidth: "380px", maxHeight: "80vh", overflowY: "auto",
      }}>
        <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px", color: "#1f2937" }}>
          {ad ? "编辑广告" : "上架广告"}
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ fontSize: "13px", color: "#374151", fontWeight: 500, display: "block", marginBottom: "4px" }}>
              标题 *
            </label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="广告标题"
              style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "13px", color: "#374151", fontWeight: 500, display: "block", marginBottom: "4px" }}>
              广告图片
            </label>
            {form.image_url ? (
              <div style={{ position: "relative", borderRadius: "8px", overflow: "hidden", marginBottom: "8px" }}>
                <img src={form.image_url} alt="预览" style={{ width: "100%", maxHeight: "120px", objectFit: "cover" }} />
                <button
                  onClick={() => setForm({ ...form, image_url: "" })}
                  style={{ position: "absolute", top: "4px", right: "4px", width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.5)", color: "#fff", border: "none", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >x</button>
              </div>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px dashed #d1d5db", fontSize: "13px", color: uploading ? "#9ca3af" : "#6b7280", backgroundColor: "#fafafa", cursor: uploading ? "not-allowed" : "pointer" }}
            >
              {uploading ? "上传中..." : form.image_url ? "更换图片" : "+ 点击上传图片"}
            </button>
            <p style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>不上传图片则为纯文字广告</p>
          </div>

          <div>
            <label style={{ fontSize: "13px", color: "#374151", fontWeight: 500, display: "block", marginBottom: "4px" }}>
              链接URL
            </label>
            <input
              value={form.link_url}
              onChange={(e) => setForm({ ...form, link_url: e.target.value })}
              placeholder="https://example.com"
              style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "13px", color: "#374151", fontWeight: 500, display: "block", marginBottom: "4px" }}>
              描述
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="广告描述（可选）"
              rows={2}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", outline: "none", resize: "none", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "13px", color: "#374151", fontWeight: 500, display: "block", marginBottom: "4px" }}>
              排序权重
            </label>
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
              style={{ width: "80px", padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", outline: "none", boxSizing: "border-box" }}
            />
            <p style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>数字越大越靠前</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: "10px 0", borderRadius: "8px", backgroundColor: "#f3f4f6", color: "#374151", fontSize: "14px", fontWeight: 500, border: "none" }}
          >取消</button>
          <button
            onClick={() => {
              if (!form.title.trim()) return;
              onSave(form);
            }}
            style={{ flex: 1, padding: "10px 0", borderRadius: "8px", backgroundColor: "#07c160", color: "#fff", fontSize: "14px", fontWeight: 500, border: "none" }}
          >保存</button>
        </div>
      </div>
    </div>
  );
}

interface UserInfo {
  id: string;
  username: string;
  nickname: string;
  avatar_url: string | null;
  role: string;
  status: string;
  permissions: Record<string, boolean> | null;
  created_at: string;
}

interface AdInfo {
  id: string;
  title: string;
  image_url: string | null;
  link_url: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
}

export function AdminPanel() {
  const { user } = useAuth();
  const [mainTab, setMainTab] = useState<"users" | "ads">("users");
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [confirm, setConfirm] = useState<{ title: string; message: string; action: () => void } | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [userDetail, setUserDetail] = useState<{ posts: unknown[]; messages: unknown[] } | null>(null);
  const [detailTab, setDetailTab] = useState<"posts" | "messages">("posts");

  // Ads state
  const [ads, setAds] = useState<AdInfo[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [adFormOpen, setAdFormOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<AdInfo | null>(null);
  const [carouselInterval, setCarouselInterval] = useState(() => {
    const saved = localStorage.getItem("carousel_interval");
    return saved ? Number(saved) : 4000;
  });

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  }, []);

  // ========== User functions ==========
  const fetchUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem("session_token");
      const res = await fetch("/api/admin/users/list", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
        setTotal(data.total);
      }
    } catch (err) {
      console.error("获取用户列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const fetchUserDetail = async (u: UserInfo) => {
    setSelectedUser(u);
    setUserDetail(null);
    setDetailTab("posts");
    try {
      const token = localStorage.getItem("session_token");
      const [postsRes, messagesRes] = await Promise.all([
        fetch(`/api/admin/users/${u.id}/posts`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/admin/users/${u.id}/messages`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const postsData = await postsRes.json();
      const messagesData = await messagesRes.json();
      setUserDetail({ posts: postsData.posts || [], messages: messagesData.messages || [] });
    } catch (err) {
      console.error("获取用户详情失败:", err);
    }
  };

  const handleFreeze = (u: UserInfo) => {
    const isFrozen = u.status === "frozen";
    setConfirm({
      title: isFrozen ? "解封用户" : "封禁用户",
      message: isFrozen ? `确定要解封 ${u.nickname} 吗？` : `确定要封禁 ${u.nickname} 吗？封禁后该用户将无法登录。`,
      action: async () => {
        try {
          const token = localStorage.getItem("session_token");
          const res = await fetch(`/api/admin/users/${u.id}/freeze`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ freeze: !isFrozen }),
          });
          const data = await res.json();
          if (data.success || data.user) {
            showToast(isFrozen ? "已解封" : "已封禁");
            fetchUsers();
          } else {
            showToast(data.error || "操作失败");
          }
        } catch { showToast("操作失败"); }
        setConfirm(null);
      },
    });
  };

  const handleDelete = (u: UserInfo) => {
    setConfirm({
      title: "删除用户",
      message: `确定要删除用户 ${u.nickname}（${u.username}）吗？此操作不可撤销。`,
      action: async () => {
        try {
          const token = localStorage.getItem("session_token");
          const res = await fetch(`/api/admin/users/${u.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.success) {
            showToast("已删除");
            fetchUsers();
            setSelectedUser(null);
          } else {
            showToast(data.error || "删除失败");
          }
        } catch { showToast("操作失败"); }
        setConfirm(null);
      },
    });
  };

  const handleRoleChange = (u: UserInfo, newRole: string) => {
    setConfirm({
      title: "修改角色",
      message: `确定要将 ${u.nickname} 的角色从 ${u.role} 改为 ${newRole} 吗？`,
      action: async () => {
        try {
          const token = localStorage.getItem("session_token");
          const res = await fetch(`/api/admin/users/${u.id}/role`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ role: newRole }),
          });
          const data = await res.json();
          if (data.success || data.user) {
            showToast("角色已修改");
            fetchUsers();
          } else {
            showToast(data.error || "修改失败");
          }
        } catch { showToast("操作失败"); }
        setConfirm(null);
      },
    });
  };

  // ========== Ad functions ==========
  const fetchAds = useCallback(async () => {
    setAdsLoading(true);
    try {
      const token = localStorage.getItem("session_token");
      const res = await fetch("/api/admin/ads", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ads) setAds(data.ads);
    } catch (err) {
      console.error("获取广告列表失败:", err);
    } finally {
      setAdsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mainTab === "ads") fetchAds();
  }, [mainTab, fetchAds]);

  const handleCreateAd = async (formData: { title: string; image_url: string; link_url: string; description: string; sort_order: number }) => {
    try {
      const token = localStorage.getItem("session_token");
      const res = await fetch("/api/admin/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.ad) {
        showToast("广告已上架");
        setAdFormOpen(false);
        fetchAds();
      } else {
        showToast(data.error || "上架失败");
      }
    } catch { showToast("上架失败"); }
  };

  const handleUpdateAd = async (formData: { title: string; image_url: string; link_url: string; description: string; sort_order: number }) => {
    if (!editingAd) return;
    try {
      const token = localStorage.getItem("session_token");
      const res = await fetch(`/api/admin/ads/${editingAd.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.ad) {
        showToast("广告已更新");
        setAdFormOpen(false);
        setEditingAd(null);
        fetchAds();
      } else {
        showToast(data.error || "更新失败");
      }
    } catch { showToast("更新失败"); }
  };

  const handleToggleAd = (ad: AdInfo) => {
    const action = ad.is_active ? "下架" : "上架";
    setConfirm({
      title: `${action}广告`,
      message: `确定要${action}广告「${ad.title}」吗？`,
      action: async () => {
        try {
          const token = localStorage.getItem("session_token");
          const res = await fetch(`/api/admin/ads/${ad.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: "toggle" }),
          });
          const data = await res.json();
          if (data.ad) {
            showToast(ad.is_active ? "已下架" : "已上架");
            fetchAds();
          } else {
            showToast(data.error || "操作失败");
          }
        } catch { showToast("操作失败"); }
        setConfirm(null);
      },
    });
  };

  const handleDeleteAd = (ad: AdInfo) => {
    setConfirm({
      title: "删除广告",
      message: `确定要删除广告「${ad.title}」吗？此操作不可撤销。`,
      action: async () => {
        try {
          const token = localStorage.getItem("session_token");
          const res = await fetch(`/api/admin/ads/${ad.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.success) {
            showToast("已删除");
            fetchAds();
          } else {
            showToast(data.error || "删除失败");
          }
        } catch { showToast("操作失败"); }
        setConfirm(null);
      },
    });
  };



  if (user?.role !== "super_admin") {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        仅超级管理员可访问
      </div>
    );
  }

  // ========== User Detail View ==========
  if (selectedUser) {
    const posts = (userDetail?.posts || []) as { id: string; content: string; is_anonymous: boolean; created_at: string }[];
    const messages = (userDetail?.messages || []) as { id: string; content: string; room_id: string; created_at: string }[];

    return (
      <div className="h-full flex flex-col">
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedUser(null)} className="text-[#07c160] text-sm font-medium">← 返回</button>
            <span className="font-semibold text-gray-800">{selectedUser.nickname}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              selectedUser.status === "active" ? "bg-green-100 text-green-700" :
              selectedUser.status === "frozen" ? "bg-red-100 text-red-700" :
              "bg-gray-100 text-gray-500"
            }`}>
              {selectedUser.status === "active" ? "正常" : selectedUser.status === "frozen" ? "封禁" : "已删除"}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            账号: {selectedUser.username} · 角色: {selectedUser.role} · ID: {selectedUser.id.slice(0, 8)}...
          </div>
        </div>

        <div className="px-4 py-3 flex gap-2 border-b border-gray-100 bg-white">
          <button
            onClick={() => handleFreeze(selectedUser)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              selectedUser.status === "frozen" ? "bg-green-500 text-white" : "bg-orange-500 text-white"
            }`}
          >
            {selectedUser.status === "frozen" ? "解封" : "封禁"}
          </button>
          <button
            onClick={() => handleDelete(selectedUser)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white"
          >删除</button>
          {selectedUser.role !== "super_admin" && (
            <select
              value={selectedUser.role}
              onChange={(e) => handleRoleChange(selectedUser, e.target.value)}
              className="px-3 py-2 rounded-lg text-sm border border-gray-200 bg-white"
            >
              <option value="user">用户</option>
              <option value="admin">管理员</option>
              <option value="super_admin">超管</option>
            </select>
          )}
        </div>

        <div className="flex border-b border-gray-100 bg-white">
          <button
            onClick={() => setDetailTab("posts")}
            className={`flex-1 py-2 text-sm font-medium ${
              detailTab === "posts" ? "text-[#07c160] border-b-2 border-[#07c160]" : "text-gray-400"
            }`}
          >帖子 ({posts.length})</button>
          <button
            onClick={() => setDetailTab("messages")}
            className={`flex-1 py-2 text-sm font-medium ${
              detailTab === "messages" ? "text-[#07c160] border-b-2 border-[#07c160]" : "text-gray-400"
            }`}
          >消息 ({messages.length})</button>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50">
          {detailTab === "posts" ? (
            posts.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-8">暂无帖子</div>
            ) : posts.map((p) => (
              <div key={p.id} className="bg-white mx-3 mt-2 p-3 rounded-xl">
                <p className="text-sm text-gray-800">{p.content}</p>
                <div className="text-xs text-gray-400 mt-2">
                  {p.is_anonymous && <span className="text-orange-500 mr-2">匿名</span>}
                  {new Date(p.created_at).toLocaleString()}
                </div>
              </div>
            ))
          ) : (
            messages.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-8">暂无消息</div>
            ) : messages.map((m) => (
              <div key={m.id} className="bg-white mx-3 mt-2 p-3 rounded-xl">
                <p className="text-sm text-gray-800">{m.content}</p>
                <div className="text-xs text-gray-400 mt-2">{new Date(m.created_at).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>

        <ConfirmDialog
          open={!!confirm}
          title={confirm?.title || ""}
          message={confirm?.message || ""}
          onConfirm={confirm?.action || (() => {})}
          onCancel={() => setConfirm(null)}
        />
        <ToastOverlay message={toast} />
      </div>
    );
  }

  // ========== Main View ==========
  return (
    <div className="h-full flex flex-col">
      {/* Top tabs */}
      <div className="flex bg-white border-b border-gray-100">
        <button
          onClick={() => setMainTab("users")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            mainTab === "users"
              ? "text-[#07c160] border-b-2 border-[#07c160]"
              : "text-gray-400"
          }`}
        >用户管理</button>
        <button
          onClick={() => setMainTab("ads")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            mainTab === "ads"
              ? "text-[#07c160] border-b-2 border-[#07c160]"
              : "text-gray-400"
          }`}
        >广告管理</button>
      </div>

      {/* Content */}
      {mainTab === "users" ? (
        /* ========== User Tab ========== */
        <>
          <div className="bg-white mx-3 mt-3 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-800">{total}</div>
                <div className="text-xs text-gray-500 mt-0.5">注册用户数</div>
              </div>
              <div className="flex gap-3">
                <div className="text-center">
                  <div className="text-lg font-semibold text-green-600">{users.filter(u => u.status === "active").length}</div>
                  <div className="text-[10px] text-gray-400">正常</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-red-500">{users.filter(u => u.status === "frozen").length}</div>
                  <div className="text-[10px] text-gray-400">封禁</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-purple-600">{users.filter(u => u.role === "admin" || u.role === "super_admin").length}</div>
                  <div className="text-[10px] text-gray-400">管理员</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto mt-3">
            {loading ? (
              <div className="text-center text-gray-400 text-sm py-8">加载中...</div>
            ) : users.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-8">暂无用户</div>
            ) : (
              users.map((u) => (
                <div
                  key={u.id}
                  onClick={() => fetchUserDetail(u)}
                  className="bg-white mx-3 mt-2 p-3 rounded-xl flex items-center gap-3 active:bg-gray-50 cursor-pointer last:mb-4"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#07c160] to-[#04a04e] flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {(u.nickname || u.username).charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-800 truncate">{u.nickname}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        u.role === "super_admin" ? "bg-purple-100 text-purple-700" :
                        u.role === "admin" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-500"
                      }`}>
                        {u.role === "super_admin" ? "超管" : u.role === "admin" ? "管理" : "用户"}
                      </span>
                      {u.status === "frozen" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">封禁</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">@{u.username} · {new Date(u.created_at).toLocaleDateString()}</div>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        /* ========== Ads Tab ========== */
        <>
          {/* Add Ad Button */}
          <div className="px-3 mt-3">
            <button
              onClick={() => { setEditingAd(null); setAdFormOpen(true); }}
              className="w-full py-3 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #07c160, #04a04e)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              上架新广告
            </button>
          </div>

          {/* Ads Stats */}
          <div className="bg-white mx-3 mt-3 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-800">{ads.length}</div>
                <div className="text-xs text-gray-500 mt-0.5">广告总数</div>
              </div>
              <div className="flex gap-3">
                <div className="text-center">
                  <div className="text-lg font-semibold text-green-600">{ads.filter(a => a.is_active).length}</div>
                  <div className="text-[10px] text-gray-400">上架中</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-400">{ads.filter(a => !a.is_active).length}</div>
                  <div className="text-[10px] text-gray-400">已下架</div>
                </div>
              </div>
            </div>
            {/* 轮播间隔控制 */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">轮播间隔</span>
                <div className="flex items-center gap-2">
                  {[2000, 4000, 6000, 8000].map((ms) => (
                    <button
                      key={ms}
                      onClick={() => {
                        setCarouselInterval(ms);
                        localStorage.setItem("carousel_interval", String(ms));
                      }}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        carouselInterval === ms
                          ? "bg-[#07c160] text-white"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {ms / 1000}s
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Ads List */}
          <div className="flex-1 overflow-y-auto mt-3">
            {adsLoading ? (
              <div className="text-center text-gray-400 text-sm py-8">加载中...</div>
            ) : ads.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2 opacity-30">📢</div>
                <div className="text-gray-400 text-sm">暂无广告</div>
                <div className="text-gray-300 text-xs mt-1">点击上方按钮上架新广告</div>
              </div>
            ) : (
              ads.map((ad) => (
                <div key={ad.id} className="bg-white mx-3 mt-2 rounded-xl overflow-hidden shadow-sm last:mb-4">
                  {/* Ad preview */}
                  {ad.image_url && (
                    <div className="w-full" style={{ aspectRatio: "16/5" }}>
                      <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  {/* Ad info */}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-gray-800 truncate">{ad.title}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                            ad.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                          }`}>
                            {ad.is_active ? "上架中" : "已下架"}
                          </span>
                        </div>
                        {ad.description && (
                          <p className="text-xs text-gray-400 mt-1 line-clamp-1">{ad.description}</p>
                        )}
                        {ad.link_url && (
                          <p className="text-[11px] text-blue-400 mt-1 truncate">{ad.link_url}</p>
                        )}
                        <p className="text-[11px] text-gray-300 mt-1">
                          排序: {ad.sort_order} · {new Date(ad.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {/* Action buttons */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleToggleAd(ad)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${
                          ad.is_active
                            ? "bg-orange-50 text-orange-600 border border-orange-200"
                            : "bg-green-50 text-green-600 border border-green-200"
                        }`}
                      >
                        {ad.is_active ? "下架" : "上架"}
                      </button>
                      <button
                        onClick={() => { setEditingAd(ad); setAdFormOpen(true); }}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200"
                      >编辑</button>
                      <button
                        onClick={() => handleDeleteAd(ad)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-500 border border-red-200"
                      >删除</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>


        </>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ""}
        message={confirm?.message || ""}
        onConfirm={confirm?.action || (() => {})}
        onCancel={() => setConfirm(null)}
      />
      <AdFormDialog
        open={adFormOpen}
        ad={editingAd ? {
          title: editingAd.title,
          image_url: editingAd.image_url || "",
          link_url: editingAd.link_url || "",
          description: editingAd.description || "",
          sort_order: editingAd.sort_order,
        } : null}
        onSave={editingAd ? handleUpdateAd : handleCreateAd}
        onCancel={() => { setAdFormOpen(false); setEditingAd(null); }}
      />
      <ToastOverlay message={toast} />
    </div>
  );
}
