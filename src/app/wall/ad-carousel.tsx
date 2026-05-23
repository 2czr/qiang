"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Ad {
  id: string;
  title: string;
  image_url: string | null;
  link_url: string | null;
  description: string | null;
  sort_order: number;
}

interface AdCarouselProps {
  token?: string | null;
  interval?: number; // 轮播间隔(毫秒)，默认4000
}

export function AdCarousel({ token, interval = 4000 }: AdCarouselProps) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  useEffect(() => {
    const fetchAds = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch("/api/ads", { headers });
        if (res.ok) {
          const data = await res.json();
          setAds(data.ads || []);
        }
      } catch {
        // 静默失败
      }
    };
    fetchAds();
    const refresh = setInterval(fetchAds, 60000);
    return () => clearInterval(refresh);
  }, [token]);

  const nextSlide = useCallback(() => {
    if (ads.length <= 1) return;
    setCurrent((prev) => (prev + 1) % ads.length);
  }, [ads.length]);

  const prevSlide = useCallback(() => {
    if (ads.length <= 1) return;
    setCurrent((prev) => (prev - 1 + ads.length) % ads.length);
  }, [ads.length]);

  // 自动轮播
  useEffect(() => {
    if (isPaused || ads.length <= 1) return;
    const timer = setInterval(nextSlide, interval);
    return () => clearInterval(timer);
  }, [isPaused, ads.length, nextSlide, interval]);

  // 触摸滑动
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsPaused(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) nextSlide();
      else prevSlide();
    }
    setTimeout(() => setIsPaused(false), 3000);
  };

  if (ads.length === 0) return null;

  const ad = ads[current];

  return (
    <>
      <div
        className="relative w-full overflow-hidden rounded-xl shrink-0"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* 轮播内容 */}
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {ads.map((item) => (
            <div key={item.id} className="w-full flex-shrink-0">
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #bbf7d0 100%)",
                }}
                onClick={() => setSelectedAd(item)}
              >
                <span className="bg-emerald-500/20 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                  广告
                </span>
                <span className="text-sm text-emerald-800 font-medium truncate">
                  {item.title}
                </span>
                {item.description && (
                  <span className="text-xs text-emerald-600 truncate">
                    {item.description}
                  </span>
                )}
                {item.image_url && (
                  <span className="text-emerald-400 text-[10px] flex-shrink-0">📷</span>
                )}
                <span className="text-emerald-400 text-xs ml-auto flex-shrink-0">查看详情 ›</span>
              </div>
            </div>
          ))}
        </div>

        {/* 左右切换 */}
        {ads.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prevSlide(); }}
              className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-black/30 text-white text-xs hover:bg-black/50 active:bg-black/60 transition-colors"
            >
              ‹
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); nextSlide(); }}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-black/30 text-white text-xs hover:bg-black/50 active:bg-black/60 transition-colors"
            >
              ›
            </button>
          </>
        )}

        {/* 指示点 */}
        {ads.length > 1 && (
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1.5">
            {ads.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); setCurrent(idx); }}
                className="rounded-full transition-all"
                style={{
                  width: idx === current ? 12 : 6,
                  height: 6,
                  backgroundColor: idx === current ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* 广告详情弹窗 */}
      {selectedAd && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setSelectedAd(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 关闭按钮 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-xs text-gray-400 font-medium">广告详情</span>
              <button
                onClick={() => setSelectedAd(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 active:bg-gray-300 text-sm"
              >
                ✕
              </button>
            </div>

            {/* 广告图片 */}
            {selectedAd.image_url && (
              <div className="w-full" style={{ aspectRatio: "16/9" }}>
                <img
                  src={selectedAd.image_url}
                  alt={selectedAd.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* 广告内容 */}
            <div className="p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">{selectedAd.title}</h3>
              {selectedAd.description && (
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  {selectedAd.description}
                </p>
              )}
              {selectedAd.link_url && (
                <a
                  href={selectedAd.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-4 py-2 bg-[#07c160] text-white text-sm font-medium rounded-lg hover:bg-[#06a850] active:bg-[#059545] transition-colors"
                >
                  访问链接
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="ml-0.5">
                    <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
