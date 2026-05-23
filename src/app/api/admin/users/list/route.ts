import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export async function GET(request: Request) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser || currentUser.role !== "super_admin") {
      return NextResponse.json({ error: "无权操作，仅超级管理员可查看" }, { status: 403 });
    }

    const client = getSupabaseClient();
    const { data, error, count } = await client
      .from("users")
      .select("id, username, nickname, avatar_url, role, status, permissions, created_at", { count: "exact" })
      .neq("status", "deleted")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: `查询失败: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ users: data || [], total: count || 0 });
  } catch (error) {
    return NextResponse.json({ error: `服务器错误: ${error}` }, { status: 500 });
  }
}
