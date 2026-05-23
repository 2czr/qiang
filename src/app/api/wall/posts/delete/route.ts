import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
    }

    const { postId } = body;
    if (!postId) {
      return NextResponse.json({ error: "缺少帖子ID" }, { status: 400 });
    }

    const client = getSupabaseClient();

    // Check if the post exists and belongs to the user (or user is admin)
    const { data: post, error: fetchError } = await client
      .from("wall_posts")
      .select("id, user_id")
      .eq("id", postId)
      .single();

    if (fetchError || !post) {
      return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
    }

    if (post.user_id !== user.id && !["admin", "super_admin"].includes(user.role)) {
      return NextResponse.json({ error: "无权操作，只能撤回自己的帖子" }, { status: 403 });
    }

    // Delete related comments, likes, then the post
    await client.from("post_comments").delete().eq("post_id", postId);
    await client.from("post_likes").delete().eq("post_id", postId);
    const { error } = await client.from("wall_posts").delete().eq("id", postId);

    if (error) throw new Error(`撤回失败: ${error.message}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "撤回失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
