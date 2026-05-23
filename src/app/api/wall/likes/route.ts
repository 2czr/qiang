import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { postId } = await request.json();

    if (!postId) {
      return NextResponse.json({ error: "缺少postId" }, { status: 400 });
    }

    const client = getSupabaseClient();

    // Check if already liked
    const { data: existing } = await client
      .from("post_likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      // Unlike
      const { error } = await client
        .from("post_likes")
        .delete()
        .eq("id", existing.id);

      if (error) throw new Error(`取消点赞失败: ${error.message}`);
      return NextResponse.json({ liked: false });
    } else {
      // Like
      const { error } = await client
        .from("post_likes")
        .insert({
          post_id: postId,
          user_id: user.id,
        });

      if (error) throw new Error(`点赞失败: ${error.message}`);
      return NextResponse.json({ liked: true });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "操作失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
