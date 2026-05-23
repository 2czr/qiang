import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    // Only super_admin and admin can pin posts
    if (user.role !== "super_admin" && user.role !== "admin") {
      return NextResponse.json({ error: "无权操作，仅管理员可置顶" }, { status: 403 });
    }

    const { postId, pinned } = await request.json();
    if (!postId) {
      return NextResponse.json({ error: "缺少帖子ID" }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from("wall_posts")
      .update({ is_pinned: !!pinned })
      .eq("id", postId)
      .select("id, is_pinned")
      .single();

    if (error) throw new Error(`操作失败: ${error.message}`);

    return NextResponse.json({
      post: data,
      pinned: !!pinned,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "操作失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
