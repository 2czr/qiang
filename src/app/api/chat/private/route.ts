import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

// Send a private message
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await request.json();
    const { receiverId, content, imageUrl } = body;

    if (!receiverId || ((!content || content.trim().length === 0) && !imageUrl)) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from("private_messages")
      .insert({
        sender_id: user.id,
        receiver_id: receiverId,
        content: content?.trim() || null,
        image_url: imageUrl || null,
      })
      .select("id, sender_id, receiver_id, content, image_url, is_read, created_at")
      .single();

    if (error) throw new Error(`发送私信失败: ${error.message}`);

    return NextResponse.json({ message: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "发送失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Get private messages between current user and another user
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const peerId = searchParams.get("peerId");

    if (!peerId) {
      return NextResponse.json({ error: "缺少peerId" }, { status: 400 });
    }

    const client = getSupabaseClient();

    // Mark messages as read
    await client
      .from("private_messages")
      .update({ is_read: true })
      .eq("sender_id", peerId)
      .eq("receiver_id", user.id)
      .eq("is_read", false);

    // Get conversation
    const { data, error } = await client
      .from("private_messages")
      .select("id, sender_id, receiver_id, content, image_url, is_read, created_at")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) throw new Error(`查询私信失败: ${error.message}`);

    return NextResponse.json({ messages: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "查询失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
