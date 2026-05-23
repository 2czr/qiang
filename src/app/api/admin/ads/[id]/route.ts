import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

// PUT /api/admin/ads/[id] - 更新广告
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { title, image_url, link_url, description, sort_order } = body;

  const supabase = getSupabaseClient();
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updateData.title = title.trim();
  if (image_url !== undefined) updateData.image_url = image_url;
  if (link_url !== undefined) updateData.link_url = link_url;
  if (description !== undefined) updateData.description = description;
  if (sort_order !== undefined) updateData.sort_order = sort_order;

  const { data, error } = await supabase
    .from("ads")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "更新广告失败" }, { status: 500 });
  }
  return NextResponse.json({ ad: data });
}

// DELETE /api/admin/ads/[id] - 删除广告
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("ads").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "删除广告失败" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// POST /api/admin/ads/[id] - 切换广告上下架
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action } = body;

  const supabase = getSupabaseClient();

  if (action === "toggle") {
    // 先查当前状态
    const { data: current } = await supabase
      .from("ads")
      .select("is_active")
      .eq("id", id)
      .single();

    const newStatus = current?.is_active ? false : true;
    const { data, error } = await supabase
      .from("ads")
      .update({ is_active: newStatus, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "切换广告状态失败" }, { status: 500 });
    }
    return NextResponse.json({ ad: data });
  }

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
