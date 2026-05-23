import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const client = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");
    const offset = (page - 1) * pageSize;

    const { data, error } = await client
      .from("wall_posts")
      .select("id, content, image_url, is_anonymous, is_pinned, created_at, user_id, users!wall_posts_user_id_users_id_fk(nickname, avatar_url)")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`查询失败: ${error.message}`);

    // Get like counts and comment counts
    const posts = data as Array<Record<string, unknown>>;
    const postIds = posts.map((p) => p.id as string);

    const likeCounts: Record<string, number> = {};
    const commentCounts: Record<string, number> = {};
    // Get current user for like check and anonymous post handling
    const currentUser = await getUserFromRequest(request);
    let userLikedPostIds: string[] = [];

    if (postIds.length > 0) {
      // Get like counts
      const { data: likesData } = await client
        .from("post_likes")
        .select("post_id")
        .in("post_id", postIds);

      if (likesData) {
        for (const like of likesData) {
          likeCounts[like.post_id] = (likeCounts[like.post_id] || 0) + 1;
        }
      }

      // Get comment counts
      const { data: commentsData } = await client
        .from("post_comments")
        .select("post_id")
        .in("post_id", postIds);

      if (commentsData) {
        for (const comment of commentsData) {
          commentCounts[comment.post_id] = (commentCounts[comment.post_id] || 0) + 1;
        }
      }

      // Check current user's likes
      if (currentUser) {
        const { data: userLikes } = await client
          .from("post_likes")
          .select("post_id")
          .eq("user_id", currentUser.id)
          .in("post_id", postIds);

        if (userLikes) {
          userLikedPostIds = userLikes.map((l) => l.post_id);
        }
      }
    }

    // If post is anonymous, hide user info (but super_admin and the author can still see user_id)
    const safePosts = posts.map((post) => {
      const userInfo = post.users as Record<string, unknown> | null;
      if (post.is_anonymous) {
        if (currentUser?.role === "super_admin") {
          // Super admin sees real identity and keeps user_id for friend adding
          return {
            ...post,
            users: {
              nickname: `匿名(${(userInfo as Record<string, unknown>)?.nickname || "未知"})`,
              username: (userInfo as Record<string, unknown>)?.username || null,
              avatar_url: null,
            },
            is_anonymous: true,
          };
        }
        // For the author: keep user_id so they can manage their own post (delete/recall)
        // For others: hide user_id completely so they can't identify the author
        const isAuthor = currentUser && post.user_id === currentUser.id;
        return {
          ...post,
          user_id: isAuthor ? post.user_id : null,
          users: { nickname: "匿名用户", avatar_url: null },
        };
      }
      return { ...post, users: userInfo };
    });

    // Get total count
    const { count } = await client
      .from("wall_posts")
      .select("*", { count: "exact", head: true });

    return NextResponse.json({
      posts: safePosts,
      likeCounts,
      commentCounts,
      userLikedPostIds,
      total: count || 0,
      page,
      pageSize,
    });
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

    const { content, image_url, is_anonymous } = await request.json();

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from("wall_posts")
      .insert({
        user_id: user.id,
        content: content.trim(),
        image_url: image_url || null,
        is_anonymous: is_anonymous || false,
      })
      .select("id, content, image_url, is_anonymous, is_pinned, created_at, user_id, users!wall_posts_user_id_users_id_fk(nickname, avatar_url)")
      .single();

    if (error) throw new Error(`发布失败: ${error.message}`);

    return NextResponse.json({ post: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "发布失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      console.error("Delete post: no user found");
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      console.error("Delete post: failed to parse request body");
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
