import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

// POST /api/friends/request - Send friend request
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { receiverId } = await request.json();
    if (!receiverId) {
      return NextResponse.json({ error: "缺少目标用户ID" }, { status: 400 });
    }

    if (receiverId === user.id) {
      return NextResponse.json({ error: "不能向自己发送好友请求" }, { status: 400 });
    }

    const client = getSupabaseClient();

    // Check if receiver exists
    const { data: receiver } = await client
      .from("users")
      .select("id, nickname, status")
      .eq("id", receiverId)
      .maybeSingle();

    if (!receiver || receiver.status === "deleted") {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    // Check if already friends or request exists
    const { data: existing } = await client
      .from("friend_requests")
      .select("id, status, sender_id")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`)
      .maybeSingle();

    if (existing) {
      if (existing.status === "accepted") {
        return NextResponse.json({ error: "你们已经是好友了" }, { status: 400 });
      }
      if (existing.status === "pending" && existing.sender_id === user.id) {
        return NextResponse.json({ error: "已经发送过好友请求，等待对方确认" }, { status: 400 });
      }
      if (existing.status === "pending" && existing.sender_id === receiverId) {
        // The other person already sent a request, auto-accept
        const { data, error } = await client
          .from("friend_requests")
          .update({ status: "accepted", updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select("id, sender_id, receiver_id, status, created_at")
          .single();

        if (error) throw new Error(`操作失败: ${error.message}`);
        return NextResponse.json({ request: data, autoAccepted: true });
      }
      if (existing.status === "rejected") {
        // Re-allow sending if previously rejected
        const { data, error } = await client
          .from("friend_requests")
          .update({ status: "pending", sender_id: user.id, receiver_id: receiverId, updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select("id, sender_id, receiver_id, status, created_at")
          .single();

        if (error) throw new Error(`操作失败: ${error.message}`);
        return NextResponse.json({ request: data });
      }
    }

    // Create new friend request
    const { data, error } = await client
      .from("friend_requests")
      .insert({
        sender_id: user.id,
        receiver_id: receiverId,
        status: "pending",
      })
      .select("id, sender_id, receiver_id, status, created_at")
      .single();

    if (error) throw new Error(`发送失败: ${error.message}`);

    return NextResponse.json({ request: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "发送失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/friends/request - Get friend requests (pending for current user)
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const client = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "received"; // "received" or "sent"

    let query;
    if (type === "sent") {
      query = client
        .from("friend_requests")
        .select("id, status, created_at, receiver:users!friend_requests_receiver_id_fkey(id, nickname, avatar_url)")
        .eq("sender_id", user.id)
        .order("created_at", { ascending: false });
    } else {
      query = client
        .from("friend_requests")
        .select("id, status, created_at, sender:users!friend_requests_sender_id_fkey(id, nickname, avatar_url)")
        .eq("receiver_id", user.id)
        .order("created_at", { ascending: false });
    }

    const { data, error } = await query;

    if (error) throw new Error(`查询失败: ${error.message}`);

    return NextResponse.json({ requests: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "查询失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
