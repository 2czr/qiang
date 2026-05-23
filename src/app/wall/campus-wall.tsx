"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { AdCarousel } from "./ad-carousel";
import {
  Heart, MessageCircle, Pin, MoreVertical, Trash2, ImagePlus, X, Send, UserPlus, UserCheck, Clock, Shield
} from "lucide-react";

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  is_anonymous: boolean;
  is_pinned: boolean;
  created_at: string;
  user_id: string | null;
  users: { nickname: string; avatar_url: string | null };
}

interface Comment {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  user_id: string;
  users: { nickname: string; avatar_url: string | null };
}

// ========== Auth Fetch ==========
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("session_token");
}

async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {};
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((v, k) => { headers[k] = v; });
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([k, v]) => { headers[k] = v; });
    } else {
      Object.assign(headers, options.headers as Record<string, string>);
    }
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

// ========== Toast ==========
function ToastOverlay({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 99999, pointerEvents: "none" }}>
      <div style={{ backgroundColor: "rgba(0,0,0,0.75)", color: "#fff", padding: "14px 24px", borderRadius: "12px", fontSize: "15px", fontWeight: 500, textAlign: "center", maxWidth: "80vw", lineHeight: 1.5 }}>
        {message}
      </div>
    </div>
  );
}

export default function CampusWall() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [userLikedPostIds, setUserLikedPostIds] = useState<string[]>([]);
  const [newContent, setNewContent] = useState("");
  const [newImage, setNewImage] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Record<string, Comment[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentImages, setCommentImages] = useState<Record<string, string | null>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [friendStatuses, setFriendStatuses] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpenPostId, setMenuOpenPostId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const [activeCommentImage, setActiveCommentImage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  // ========== Fetch Posts ==========
  const fetchPosts = useCallback(async () => {
    try {
      const res = await apiFetch("/api/wall/posts?page=1");
      const data = await res.json();
      if (data.posts) {
        setPosts(data.posts);
        setLikeCounts(data.likeCounts || {});
        setCommentCounts(data.commentCounts || {});
        setUserLikedPostIds(data.userLikedPostIds || []);
      }
    } catch (err) {
      console.error("获取帖子失败:", err);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // ========== Fetch Friend Statuses ==========
  useEffect(() => {
    if (!user) return;
    const userIds = [...new Set(
      posts
        .filter(p => {
          if (!p.user_id) return false;
          if (p.user_id === user.id) return false;
          if (!p.is_anonymous) return true;
          if (p.is_anonymous && user.role === "super_admin") return true;
          return false;
        })
        .map(p => p.user_id!)
    )];
    if (userIds.length === 0) return;

    Promise.all(userIds.map(async (uid) => {
      try {
        const res = await apiFetch(`/api/friends/status?userId=${uid}`);
        if (res.ok) {
          const data = await res.json();
          return { uid, status: data.status };
        }
        return null;
      } catch { return null; }
    })).then(results => {
      const statuses: Record<string, string> = {};
      results.forEach(r => { if (r) statuses[r.uid] = r.status; });
      setFriendStatuses(prev => ({ ...prev, ...statuses }));
    });
  }, [posts, user]);

  // Close menu on outside click
  useEffect(() => {
    const handler = () => setMenuOpenPostId(null);
    if (menuOpenPostId) {
      document.addEventListener("click", handler);
      return () => document.removeEventListener("click", handler);
    }
  }, [menuOpenPostId]);

  // ========== Image Upload ==========
  const handleImageUpload = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiFetch("/api/upload/image", { method: "POST", body: formData });
      const data = await res.json();
      return data.url || null;
    } catch { return null; }
  };

  // ========== Submit Post ==========
  const handleSubmit = async () => {
    if (!newContent.trim() && !newImage) return;
    setSubmitting(true);
    try {
      const imageUrl = newImage;
      const res = await apiFetch("/api/wall/posts", {
        method: "POST",
        body: JSON.stringify({ content: newContent, is_anonymous: isAnonymous, image_url: imageUrl }),
      });
      const data = await res.json();
      if (data.post) {
        setNewContent(""); setNewImage(null); setIsAnonymous(false);
        showToast("发布成功"); fetchPosts();
      } else { showToast(data.error || "发布失败"); }
    } catch { showToast("发布失败"); }
    setSubmitting(false);
  };

  // ========== Delete Post ==========
  const handleDeletePost = async (postId: string) => {
    try {
      const res = await apiFetch("/api/wall/posts/delete", { method: "POST", body: JSON.stringify({ postId }) });
      const data = await res.json();
      if (data.success) { setDeleteConfirm(null); showToast("已撤回"); fetchPosts(); }
      else { showToast(data.error || "撤回失败"); }
    } catch { showToast("网络错误"); }
  };

  // ========== Like ==========
  const handleLike = async (postId: string) => {
    try {
      const res = await apiFetch("/api/wall/likes", { method: "POST", body: JSON.stringify({ postId }) });
      const data = await res.json();
      if (data.liked !== undefined) {
        setLikeCounts(prev => ({ ...prev, [postId]: data.likeCount || 0 }));
        setUserLikedPostIds(prev => data.liked ? [...prev, postId] : prev.filter(id => id !== postId));
      }
    } catch {}
  };

  // ========== Pin ==========
  const handlePin = async (postId: string, pinned: boolean) => {
    try {
      const res = await apiFetch("/api/wall/pin", { method: "POST", body: JSON.stringify({ postId, pinned }) });
      const data = await res.json();
      if (data.post || data.pinned !== undefined) {
        showToast(pinned ? "已置顶" : "已取消置顶");
        setMenuOpenPostId(null); fetchPosts();
      } else { showToast(data.error || "操作失败"); }
    } catch { showToast("操作失败"); }
  };

  // ========== Comment ==========
  const handleComment = async (postId: string) => {
    const content = commentInputs[postId] || "";
    const imageUrl = commentImages[postId] || null;
    if (!content.trim() && !imageUrl) return;
    try {
      const res = await apiFetch("/api/wall/comments", { method: "POST", body: JSON.stringify({ postId, content, image_url: imageUrl }) });
      const data = await res.json();
      if (data.comment) {
        setCommentInputs(prev => ({ ...prev, [postId]: "" }));
        setCommentImages(prev => ({ ...prev, [postId]: null }));
        fetchComments(postId); fetchPosts();
      } else { showToast(data.error || "评论失败"); }
    } catch {}
  };

  const fetchComments = async (postId: string) => {
    try {
      const res = await fetch(`/api/wall/comments?postId=${postId}`);
      const data = await res.json();
      if (data.comments) {
        const comments = data.comments as Comment[];
        setExpandedComments(prev => ({ ...prev, [postId]: comments }));
        if (user) {
          const userIds = [...new Set(comments.map((comment) => comment.user_id).filter((id) => id && id !== user.id))];
          Promise.all(userIds.map(async (uid) => {
            try {
              const statusRes = await apiFetch(`/api/friends/status?userId=${uid}`);
              if (!statusRes.ok) return null;
              const statusData = await statusRes.json();
              return { uid, status: statusData.status as string };
            } catch {
              return null;
            }
          })).then((results) => {
            const statuses: Record<string, string> = {};
            results.forEach((result) => {
              if (result) statuses[result.uid] = result.status;
            });
            setFriendStatuses((prev) => ({ ...prev, ...statuses }));
          });
        }
      }
    } catch {}
  };

  const toggleComments = (postId: string) => {
    if (!expandedComments[postId]) {
      fetchComments(postId);
    } else {
      setExpandedComments(prev => {
        const next = {...prev};
        delete next[postId];
        return next;
      });
    }
  };

  // ========== Add Friend ==========
  const handleAddFriend = async (receiverId: string) => {
    try {
      const res = await apiFetch("/api/friends/request", { method: "POST", body: JSON.stringify({ receiverId }) });
      const data = await res.json();
      if (data.request) {
        if (data.autoAccepted) {
          setFriendStatuses(prev => ({ ...prev, [receiverId]: "friends" }));
          showToast("已添加好友");
        } else {
          setFriendStatuses(prev => ({ ...prev, [receiverId]: "sent" }));
          showToast("好友请求已发送");
        }
      } else { showToast(data.error || "请求失败"); }
    } catch { showToast("请求失败"); }
  };

  // ========== File Select ==========
  const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = await handleImageUpload(file);
      if (url) setNewImage(url); else showToast("图片上传失败");
    }
    e.target.value = "";
  };

  const onCommentFileSelect = async (postId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = await handleImageUpload(file);
      if (url) setCommentImages(prev => ({ ...prev, [postId]: url }));
      else showToast("图片上传失败");
    }
    e.target.value = "";
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  const isSuperAdmin = user?.role === "super_admin";

  const renderFriendButton = (post: Post) => {
    if (!post.user_id || post.user_id === user?.id) return null;
    if (post.is_anonymous && !isSuperAdmin) return null;
    const status = friendStatuses[post.user_id];
    if (status === "friends") return <span className="flex items-center gap-1 text-xs text-green-600"><UserCheck size={13} />好友</span>;
    if (status === "pending" || status === "sent") return <span className="flex items-center gap-1 text-xs text-yellow-500"><Clock size={13} />已申请</span>;
    return (
      <button onClick={(e) => { e.stopPropagation(); handleAddFriend(post.user_id!); }} className="flex items-center gap-1 text-xs text-[#07c160] active:scale-95">
        <UserPlus size={13} />加好友
      </button>
    );
  };

  // 分离置顶帖和普通帖
  const pinnedPosts = posts.filter(p => p.is_pinned);
  const normalPosts = posts.filter(p => !p.is_pinned);

  return (
    <div className="flex flex-col h-full bg-[#f5f5f5]">
      {/* 发帖区 */}
      <div className="bg-white px-3 py-2.5 shadow-sm flex-shrink-0">
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#07c160] to-[#06ad56] flex items-center justify-center text-white text-sm font-medium flex-shrink-0 mt-0.5">
            {user?.nickname?.[0] || "我"}
          </div>
          <div className="flex-1 min-w-0">
            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="说点什么吧..."
              className="w-full resize-none border-0 bg-gray-50 rounded-lg px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:bg-gray-100 transition-colors"
              rows={2}
            />
            {newImage && (
              <div className="relative mt-1.5 inline-block">
                <img src={newImage} alt="" className="w-16 h-16 object-cover rounded-lg" />
                <button onClick={() => setNewImage(null)} className="absolute -top-1 -right-1 bg-black/60 text-white rounded-full w-4 h-4 flex items-center justify-center"><X size={10} /></button>
              </div>
            )}
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-4">
                <button onClick={() => fileInputRef.current?.click()} className="text-gray-400 active:text-[#07c160]"><ImagePlus size={18} /></button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileSelect} />
                <button onClick={() => setIsAnonymous(!isAnonymous)} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className={`w-7 h-3.5 rounded-full transition-colors flex items-center ${isAnonymous ? "bg-[#07c160]" : "bg-gray-300"}`}>
                    <div className={`w-3 h-3 bg-white rounded-full transition-transform mx-0.25 ${isAnonymous ? "translate-x-3" : ""}`} />
                  </div>
                  匿名
                </button>
              </div>
              <button onClick={handleSubmit} disabled={submitting || (!newContent.trim() && !newImage)} className="bg-[#07c160] text-white px-4 py-1.5 rounded-full text-xs font-medium disabled:opacity-40 active:scale-95 transition-transform">
                发布
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 帖子列表 */}
      <div className="flex-1 overflow-y-auto">
        {/* 置顶广告区 - 独立区块 */}
        <AdCarousel token={localStorage.getItem("session_token")} interval={Number(localStorage.getItem("carousel_interval")) || 4000} />

        {/* 置顶帖子 */}
        {pinnedPosts.map(post => (
          <PostCard key={post.id} post={post} user={user} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin}
            likeCounts={likeCounts} commentCounts={commentCounts} userLikedPostIds={userLikedPostIds}
            friendStatuses={friendStatuses} menuOpenPostId={menuOpenPostId}
            setMenuOpenPostId={setMenuOpenPostId} deleteConfirm={deleteConfirm} setDeleteConfirm={setDeleteConfirm}
            expandedComments={expandedComments} commentInputs={commentInputs} commentImages={commentImages}
            onLike={handleLike} onPin={handlePin} onDelete={handleDeletePost} onComment={handleComment}
            onToggleComments={toggleComments} onFileSelect={onCommentFileSelect}
            onAddFriend={handleAddFriend}
            setCommentInputs={setCommentInputs} setCommentImages={setCommentImages}
            commentFileInputRef={commentFileInputRef} activeCommentImage={activeCommentImage}
            setActiveCommentImage={setActiveCommentImage} renderFriendButton={renderFriendButton}
            formatTime={formatTime}
          />
        ))}

        {/* 分割线 */}
        {pinnedPosts.length > 0 && normalPosts.length > 0 && (
          <div className="flex items-center gap-2 mx-3 my-1">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[10px] text-gray-400">以下为最新动态</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        )}

        {/* 普通帖子 */}
        {normalPosts.map(post => (
          <PostCard key={post.id} post={post} user={user} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin}
            likeCounts={likeCounts} commentCounts={commentCounts} userLikedPostIds={userLikedPostIds}
            friendStatuses={friendStatuses} menuOpenPostId={menuOpenPostId}
            setMenuOpenPostId={setMenuOpenPostId} deleteConfirm={deleteConfirm} setDeleteConfirm={setDeleteConfirm}
            expandedComments={expandedComments} commentInputs={commentInputs} commentImages={commentImages}
            onLike={handleLike} onPin={handlePin} onDelete={handleDeletePost} onComment={handleComment}
            onToggleComments={toggleComments} onFileSelect={onCommentFileSelect}
            onAddFriend={handleAddFriend}
            setCommentInputs={setCommentInputs} setCommentImages={setCommentImages}
            commentFileInputRef={commentFileInputRef} activeCommentImage={activeCommentImage}
            setActiveCommentImage={setActiveCommentImage} renderFriendButton={renderFriendButton}
            formatTime={formatTime}
          />
        ))}

        {/* 底部留白 */}
        <div className="h-4" />
      </div>

      <ToastOverlay message={toast} />
    </div>
  );
}

// ========== 帖子卡片组件 ==========
interface PostCardProps {
  post: Post;
  user: { id: string; role: string; nickname: string } | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  likeCounts: Record<string, number>;
  commentCounts: Record<string, number>;
  userLikedPostIds: string[];
  friendStatuses: Record<string, string>;
  menuOpenPostId: string | null;
  setMenuOpenPostId: (id: string | null) => void;
  deleteConfirm: string | null;
  setDeleteConfirm: (id: string | null) => void;
  expandedComments: Record<string, Comment[]>;
  commentInputs: Record<string, string>;
  commentImages: Record<string, string | null>;
  onLike: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
  onComment: (id: string) => void;
  onToggleComments: (id: string) => void;
  onFileSelect: (postId: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddFriend: (userId: string) => void;
  setCommentInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setCommentImages: React.Dispatch<React.SetStateAction<Record<string, string | null>>>;
  commentFileInputRef: React.RefObject<HTMLInputElement | null>;
  activeCommentImage: string | null;
  setActiveCommentImage: (id: string | null) => void;
  renderFriendButton: (post: Post) => React.ReactNode;
  formatTime: (d: string) => string;
}

function PostCard({
  post, user, isAdmin, isSuperAdmin, likeCounts, commentCounts, userLikedPostIds,
  friendStatuses,
  menuOpenPostId, setMenuOpenPostId, deleteConfirm, setDeleteConfirm,
  expandedComments, commentInputs, commentImages,
  onLike, onPin, onDelete, onComment, onToggleComments, onFileSelect, onAddFriend,
  setCommentInputs, setCommentImages, commentFileInputRef, activeCommentImage, setActiveCommentImage,
  renderFriendButton, formatTime
}: PostCardProps) {
  return (
    <div className="bg-white mx-2 mb-2 rounded-xl shadow-sm overflow-hidden">
      {/* 置顶标签 */}
      {post.is_pinned && (
        <div className="flex items-center gap-1 px-3 pt-2 text-[10px] text-orange-500 font-medium">
          <Pin size={10} />已置顶
        </div>
      )}

      {/* 头像+昵称+时间+菜单 */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-1">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
          {post.users?.nickname?.[0] || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-gray-800 truncate">{post.users?.nickname || "匿名用户"}</span>
            {post.is_anonymous && isSuperAdmin && <Shield size={10} className="text-orange-500" />}
            {renderFriendButton(post)}
          </div>
          <span className="text-[10px] text-gray-400">{formatTime(post.created_at)}</span>
        </div>
        {isAdmin && (
          <button onClick={(e) => { e.stopPropagation(); setMenuOpenPostId(menuOpenPostId === post.id ? null : post.id); }}
            className="p-1 text-gray-400 active:text-gray-600 active:bg-gray-100 rounded-full">
            <MoreVertical size={16} />
          </button>
        )}
      </div>

      {/* 管理菜单 */}
      {isAdmin && menuOpenPostId === post.id && (
        <div className="mx-3 mb-1 bg-gray-50 rounded-lg py-0.5">
          <button onClick={() => onPin(post.id, !post.is_pinned)} className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 active:bg-gray-200 w-full text-left">
            <Pin size={12} />{post.is_pinned ? "取消置顶" : "置顶"}
          </button>
        </div>
      )}

      {/* 内容 */}
      <div className="px-3 pb-2">
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{post.content}</p>
        {post.image_url && (
          <img src={post.image_url} alt="" className="mt-2 rounded-lg max-w-full max-h-56 object-cover" loading="lazy" />
        )}
      </div>

      {/* 操作栏 */}
      <div className="flex items-center justify-between px-3 pb-2 pt-0.5 border-t border-gray-50">
        <div className="flex items-center gap-5">
          <button onClick={() => onLike(post.id)} className="flex items-center gap-1 text-xs text-gray-500 active:scale-95">
            <Heart size={14} className={userLikedPostIds.includes(post.id) ? "fill-red-500 text-red-500" : ""} />
            <span>{likeCounts[post.id] || 0}</span>
          </button>
          <button onClick={() => onToggleComments(post.id)} className="flex items-center gap-1 text-xs text-gray-500 active:scale-95">
            <MessageCircle size={14} />
            <span>{commentCounts[post.id] || 0}</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          {renderFriendButton(post)}
          {(post.user_id === user?.id || isAdmin) && (
            <button onClick={() => setDeleteConfirm(post.id)} className="text-[10px] text-red-400 active:text-red-600 active:scale-95">
              撤回
            </button>
          )}
        </div>
      </div>

      {/* 评论区 */}
      {expandedComments[post.id] && (
        <div className="border-t border-gray-100 bg-gray-50/80">
          <div className="px-3 py-1.5 space-y-1.5">
            {(expandedComments[post.id] || []).map(comment => (
              <div key={comment.id} className="flex gap-1.5">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-[8px] font-medium flex-shrink-0 mt-0.5">
                  {comment.users?.nickname?.[0] || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-medium text-gray-600">{comment.users?.nickname}</span>
                    {comment.user_id !== user?.id && (
                      <button
                        onClick={() => onAddFriend(comment.user_id)}
                        disabled={friendStatuses[comment.user_id] === "friends" || friendStatuses[comment.user_id] === "sent" || friendStatuses[comment.user_id] === "pending"}
                        className="text-[10px] text-[#07c160] active:opacity-80 disabled:text-gray-400"
                      >
                        {friendStatuses[comment.user_id] === "friends"
                          ? "Friend"
                          : friendStatuses[comment.user_id] === "sent" || friendStatuses[comment.user_id] === "pending"
                            ? "Sent"
                            : "Add"}
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed">{comment.content}</p>
                  {comment.image_url && <img src={comment.image_url} alt="" className="mt-0.5 rounded max-w-[100px] max-h-20 object-cover" />}
                </div>
              </div>
            ))}
          </div>
          <div className="px-3 pb-2">
            {commentImages[post.id] && (
              <div className="relative inline-block mb-1">
                <img src={commentImages[post.id]!} alt="" className="w-12 h-12 object-cover rounded" />
                <button onClick={() => setCommentImages(prev => ({...prev, [post.id]: null}))} className="absolute -top-1 -right-1 bg-black/60 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center"><X size={8} /></button>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <input value={commentInputs[post.id] || ""} onChange={e => setCommentInputs(prev => ({...prev, [post.id]: e.target.value}))}
                placeholder="写评论..." className="flex-1 bg-white rounded-full px-3 py-1 text-[11px] border border-gray-200 focus:outline-none focus:border-[#07c160]"
                onKeyDown={e => { if (e.key === "Enter") onComment(post.id); }} />
              <button onClick={() => { setActiveCommentImage(post.id); commentFileInputRef.current?.click(); }} className="text-gray-400 active:text-[#07c160]"><ImagePlus size={14} /></button>
              <button onClick={() => onComment(post.id)} className="text-[#07c160] font-medium text-[11px]">发送</button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      {deleteConfirm === post.id && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99998, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setDeleteConfirm(null)}>
          <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "20px", margin: "0 24px", width: "260px", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}
            onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: "15px", fontWeight: 600, color: "#1f2937", textAlign: "center", marginBottom: "16px" }}>确定撤回这条帖子？</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "8px 0", borderRadius: "8px", backgroundColor: "#f3f4f6", color: "#4b5563", fontSize: "13px", fontWeight: 500, border: "none" }}>取消</button>
              <button onClick={() => onDelete(post.id)} style={{ flex: 1, padding: "8px 0", borderRadius: "8px", backgroundColor: "#ef4444", color: "#fff", fontSize: "13px", fontWeight: 500, border: "none" }}>撤回</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
