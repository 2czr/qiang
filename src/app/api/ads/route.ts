import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// GET /api/ads - 获取活跃广告列表（公开）
export async function GET() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("ads")
    .select("id, title, image_url, link_url, description, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "获取广告失败" }, { status: 500 });
  }
  return NextResponse.json({ ads: data || [] });
}
