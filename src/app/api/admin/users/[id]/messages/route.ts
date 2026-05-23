import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// GET /api/admin/users/[id]/messages - Get a user's chat messages (super admin only)
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
    const limit = parseInt(searchParams.get("limit") || "50");

    const client = getSupabaseClient();

    // Get chat room messages
    const { data: chatMessages, error: chatError } = await client
      .from("chat_messages")
      .select("id, content, room_id, created_at, chat_rooms(name)")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (chatError) {
      return NextResponse.json({ error: `查询失败: ${chatError.message}` }, { status: 500 });
    }

    // Get private messages (sent and received)
    const { data: privateMessages, error: privateError } = await client
      .from("private_messages")
      .select("id, content, sender_id, receiver_id, created_at, sender:users!private_messages_sender_id_users_id_fk(nickname), receiver:users!private_messages_receiver_id_users_id_fk(nickname)")
      .or(`sender_id.eq.${id},receiver_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (privateError) {
      return NextResponse.json({ error: `查询失败: ${privateError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      chatMessages: chatMessages || [],
      privateMessages: privateMessages || [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "查询失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
