import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");

    if (!postId) {
      return NextResponse.json({ error: "缺少postId" }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from("post_comments")
      .select("id, content, image_url, created_at, user_id, users!post_comments_user_id_users_id_fk(nickname, avatar_url)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(`查询评论失败: ${error.message}`);

    return NextResponse.json({ comments: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "查询失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { postId, content, image_url } = await request.json();

    if (!postId || (!content?.trim() && !image_url)) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from("post_comments")
      .insert({
        post_id: postId,
        user_id: user.id,
        content: content?.trim() || "",
        image_url: image_url || null,
      })
      .select("id, content, image_url, created_at, user_id, users!post_comments_user_id_users_id_fk(nickname, avatar_url)")
      .single();

    if (error) throw new Error(`评论失败: ${error.message}`);

    return NextResponse.json({ comment: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "评论失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
