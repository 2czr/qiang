import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

// 获取用户详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser || currentUser.role !== "super_admin") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const { id } = await params;
    const supabase = getSupabaseClient();

    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, nickname, avatar_url, role, status, permissions, created_at, device_id")
      .eq("id", id)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (err) {
    console.error("获取用户详情失败:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 硬删除用户 - 真实永久删除
// wall_posts/post_comments 外键 ON DELETE SET NULL，帖子评论保留但用户信息置空
// 其他表(消息/好友/点赞)外键 ON DELETE CASCADE，自动级联删除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser || currentUser.role !== "super_admin") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const { id } = await params;

    // 不能删除自己
    if (id === currentUser.id) {
      return NextResponse.json({ error: "不能删除自己的账号" }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 检查用户是否存在
    const { data: targetUser } = await supabase
      .from("users")
      .select("id, username, nickname")
      .eq("id", id)
      .single();

    if (!targetUser) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    // 先手动删除CASCADE关联数据（确保可靠）
    // 1. 私聊消息（双方都删）
    await supabase.from("private_messages").delete().eq("sender_id", id);
    await supabase.from("private_messages").delete().eq("receiver_id", id);

    // 2. 好友请求（双方都删）
    await supabase.from("friend_requests").delete().eq("sender_id", id);
    await supabase.from("friend_requests").delete().eq("receiver_id", id);

    // 3. 聊天消息
    await supabase.from("chat_messages").delete().eq("user_id", id);

    // 4. 帖子点赞
    await supabase.from("post_likes").delete().eq("user_id", id);

    // 5. 删除用户本身
    // 帖子(wall_posts)和评论(post_comments)的外键是 ON DELETE SET NULL
    // 删除用户后，该用户的帖子/评论会保留，但 user_id 变为 NULL，前端显示为"已注销用户"
    const { error: deleteError } = await supabase
      .from("users")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("删除用户失败:", deleteError);
      return NextResponse.json({ error: "删除失败" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `已永久删除用户 ${targetUser.nickname || targetUser.username}，其帖子和评论已保留`,
    });
  } catch (err) {
    console.error("删除用户异常:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
