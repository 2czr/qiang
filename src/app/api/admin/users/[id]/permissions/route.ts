import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSupabaseClient } from "@/storage/database/supabase-client";
const supabase = getSupabaseClient();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const currentUser = await getUserFromRequest(request);

    if (!currentUser || currentUser.role !== "super_admin") {
      return NextResponse.json(
        { error: "无权操作，仅超级管理员可设置权限" },
        { status: 403 }
      );
    }

    if (userId === currentUser.id) {
      return NextResponse.json(
        { error: "不能修改自己的权限" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { permissions } = body;

    if (!permissions || typeof permissions !== "object") {
      return NextResponse.json(
        { error: "无效的权限数据" },
        { status: 400 }
      );
    }

    const validKeys = ["canPin", "canDelete", "canViewUser", "canManageRole"];
    const filteredPermissions: Record<string, boolean> = {};
    for (const key of validKeys) {
      if (typeof permissions[key] === "boolean") {
        filteredPermissions[key] = permissions[key];
      }
    }

    const { data, error } = await supabase
      .from("users")
      .update({ permissions: filteredPermissions })
      .eq("id", userId)
      .select("id, permissions")
      .single();

    if (error) {
      return NextResponse.json(
        { error: `设置权限失败: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ user: data });
  } catch (error) {
    return NextResponse.json(
      { error: `服务器错误: ${error}` },
      { status: 500 }
    );
  }
}
