import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// POST /api/admin/users/[id]/role - Change user role (super admin only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser || currentUser.role !== "super_admin") {
      return NextResponse.json({ error: "无权操作，仅超级管理员可设置角色" }, { status: 403 });
    }

    const { id } = await params;
    const { role } = await request.json();

    if (!role || !["user", "admin"].includes(role)) {
      return NextResponse.json({ error: "无效的角色，仅支持 user 或 admin" }, { status: 400 });
    }

    // Cannot change own role
    if (id === currentUser.id) {
      return NextResponse.json({ error: "不能修改自己的角色" }, { status: 400 });
    }

    // Check target user exists
    const client = getSupabaseClient();
    const { data: targetUser, error: fetchError } = await client
      .from("users")
      .select("id, username, nickname, role, status")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !targetUser) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    // Cannot change another super admin's role
    if (targetUser.role === "super_admin") {
      return NextResponse.json({ error: "不能修改超级管理员的角色" }, { status: 403 });
    }

    const { error: updateError } = await client
      .from("users")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: `操作失败: ${updateError.message}` }, { status: 500 });
    }

    const roleLabel = role === "admin" ? "管理员" : "普通用户";
    return NextResponse.json({
      success: true,
      role,
      message: `已将 ${targetUser.nickname} 设为${roleLabel}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "操作失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
