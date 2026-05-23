import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// POST /api/admin/users/[id]/freeze - Freeze/unfreeze a user (super admin only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser || currentUser.role !== "super_admin") {
      return NextResponse.json({ error: "无权操作，仅超级管理员可封禁用户" }, { status: 403 });
    }

    const { id } = await params;

    // Cannot freeze self
    if (id === currentUser.id) {
      return NextResponse.json({ error: "不能封禁自己的账号" }, { status: 400 });
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

    // Cannot freeze another super admin
    if (targetUser.role === "super_admin") {
      return NextResponse.json({ error: "不能封禁超级管理员" }, { status: 403 });
    }

    // Toggle freeze status
    const newStatus = targetUser.status === "frozen" ? "active" : "frozen";
    const { error: updateError } = await client
      .from("users")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: `操作失败: ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
      message: newStatus === "frozen" ? `已封禁用户 ${targetUser.nickname}` : `已解封用户 ${targetUser.nickname}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "操作失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
