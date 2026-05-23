import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

// GET /api/admin/ads - 获取所有广告（含已下架）
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("ads")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "获取广告列表失败" }, { status: 500 });
  }
  return NextResponse.json({ ads: data || [] });
}

// POST /api/admin/ads - 创建广告
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const body = await request.json();
  const { title, image_url, link_url, description, sort_order } = body;

  if (!title || !title.trim()) {
    return NextResponse.json({ error: "广告标题不能为空" }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("ads")
    .insert({
      title: title.trim(),
      image_url: image_url || null,
      link_url: link_url || null,
      description: description || null,
      sort_order: sort_order || 0,
      created_by: user.id,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "创建广告失败: " + error.message }, { status: 500 });
  }
  return NextResponse.json({ ad: data });
}
