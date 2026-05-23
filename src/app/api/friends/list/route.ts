import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

// GET /api/friends/list - Get friend list
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const client = getSupabaseClient();

    // Get accepted friend requests where user is either sender or receiver
    const { data: sent, error: err1 } = await client
      .from("friend_requests")
      .select("id, created_at, receiver:users!friend_requests_receiver_id_fkey(id, nickname, avatar_url, status)")
      .eq("sender_id", user.id)
      .eq("status", "accepted");

    if (err1) throw new Error(`查询失败: ${err1.message}`);

    const { data: received, error: err2 } = await client
      .from("friend_requests")
      .select("id, created_at, sender:users!friend_requests_sender_id_fkey(id, nickname, avatar_url, status)")
      .eq("receiver_id", user.id)
      .eq("status", "accepted");

    if (err2) throw new Error(`查询失败: ${err2.message}`);

    // Combine friends (filter out deleted users)
    const friends: Array<{
      requestId: string;
      friendId: string;
      nickname: string;
      avatar_url: string | null;
      becameFriendsAt: string;
    }> = [];

    for (const item of (sent || [])) {
      const friend = item.receiver as unknown as Record<string, unknown> | null;
      if (friend && friend.status !== "deleted") {
        friends.push({
          requestId: item.id,
          friendId: friend.id as string,
          nickname: friend.nickname as string,
          avatar_url: (friend.avatar_url as string | null) || null,
          becameFriendsAt: item.created_at,
        });
      }
    }

    for (const item of (received || [])) {
      const friend = item.sender as unknown as Record<string, unknown> | null;
      if (friend && friend.status !== "deleted") {
        friends.push({
          requestId: item.id,
          friendId: friend.id as string,
          nickname: friend.nickname as string,
          avatar_url: (friend.avatar_url as string | null) || null,
          becameFriendsAt: item.created_at,
        });
      }
    }

    return NextResponse.json({ friends });
  } catch (err) {
    const message = err instanceof Error ? err.message : "查询失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/friends/list - Remove friend
export async function DELETE(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { friendId } = await request.json();
    if (!friendId) {
      return NextResponse.json({ error: "缺少好友ID" }, { status: 400 });
    }

    const client = getSupabaseClient();

    // Delete the friend request (either direction)
    const { error: err1 } = await client
      .from("friend_requests")
      .delete()
      .eq("sender_id", user.id)
      .eq("receiver_id", friendId)
      .eq("status", "accepted");

    const { error: err2 } = await client
      .from("friend_requests")
      .delete()
      .eq("sender_id", friendId)
      .eq("receiver_id", user.id)
      .eq("status", "accepted");

    if (err1 && err2) {
      return NextResponse.json({ error: "删除好友失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "操作失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
