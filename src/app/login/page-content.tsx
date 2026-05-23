"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Eye, EyeOff } from "lucide-react";

export function LoginContent() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 生成设备指纹
  const getDeviceId = () => {
    let id = localStorage.getItem("campus_device_id");
    if (!id) {
      const nav = navigator;
      const screen = window.screen;
      const raw = [
        nav.language,
        screen.width,
        screen.height,
        screen.colorDepth,
        nav.hardwareConcurrency || 0,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        nav.platform,
      ].join("|");
      // 简单hash
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        const c = raw.charCodeAt(i);
        hash = ((hash << 5) - hash) + c;
        hash |= 0;
      }
      id = "dev_" + Math.abs(hash).toString(36) + "_" + Date.now().toString(36);
      localStorage.setItem("campus_device_id", id);
    }
    return id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isLogin) {
        await login(username, password);
      } else {
        if (!nickname.trim()) {
          setError("请输入昵称");
          setLoading(false);
          return;
        }
        const deviceId = getDeviceId();
        await register(username, password, nickname, deviceId);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-[#07c160] via-[#06ad56] to-[#059648]">
      {/* 主内容区 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* Logo区域 */}
        <div className="mb-6 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
            <span className="text-3xl">🎓</span>
          </div>
          <h1 className="text-2xl font-bold text-white">校园墙</h1>
          <p className="text-white/70 text-sm mt-1">发现校园新鲜事</p>
        </div>

        {/* 表单卡片 */}
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {isLogin ? "登录" : "注册"}
          </h2>

          {error && (
            <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <input
                type="text"
                placeholder="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#07c160] focus:ring-1 focus:ring-[#07c160]/30 transition-colors"
                required
              />
            </div>

            {!isLogin && (
              <div>
                <input
                  type="text"
                  placeholder="昵称（显示名称）"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#07c160] focus:ring-1 focus:ring-[#07c160]/30 transition-colors"
                  required
                />
              </div>
            )}

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#07c160] focus:ring-1 focus:ring-[#07c160]/30 pr-10 transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#07c160] hover:bg-[#06ad56] text-white font-medium rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {loading ? "处理中..." : isLogin ? "登录" : "注册"}
            </button>
          </form>

          <div className="mt-3 text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setError(""); }}
              className="text-[#07c160] text-xs hover:underline"
            >
              {isLogin ? "没有账号？去注册" : "已有账号？去登录"}
            </button>
          </div>
        </div>
      </div>

      {/* 免责声明 - 底部固定 */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
          <p className="text-white/90 text-[11px] leading-relaxed text-center">
            ⚠️ 免责声明：用户发布言论仅代表个人观点，与本校园墙平台无关。严禁发布违规违法内容，平台有权处理违规信息。
          </p>
        </div>
      </div>
    </div>
  );
}
