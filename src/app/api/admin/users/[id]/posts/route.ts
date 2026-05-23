import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// GET /api/admin/users/[id]/posts - Get a user's posts (super admin only)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser || currentUser.role !== "super_admin") {
      return NextResponse.json({ error: "无权操作，仅超级管理员可查看" }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const client = getSupabaseClient();

    // Get total count
    const { count, error: countError } = await client
      .from("wall_posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", id);

    if (countError) {
      return NextResponse.json({ error: `查询失败: ${countError.message}` }, { status: 500 });
    }

    // Get posts
    const { data: posts, error } = await client
      .from("wall_posts")
      .select("id, content, is_anonymous, is_pinned, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      return NextResponse.json({ error: `查询失败: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({
      posts: posts || [],
      total: count || 0,
      page,
      pageSize,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "查询失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
