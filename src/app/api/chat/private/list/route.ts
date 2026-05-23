import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getUserFromRequest, type AuthUser } from "@/lib/auth";

interface PrivateMessageRow {
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

interface ConversationInfo {
  peer_id: string;
  last_message: string;
  last_time: string;
  unread_count: number;
  peer: AuthUser | null;
}

// List all private conversations for the current user
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const client = getSupabaseClient();

    // Get all messages involving this user
    const { data, error } = await client
      .from("private_messages")
      .select("sender_id, receiver_id, content, created_at, is_read")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw new Error(`查询私信列表失败: ${error.message}`);

    // Group by peer
    const conversations = new Map<string, ConversationInfo>();

    for (const msg of (data || []) as PrivateMessageRow[]) {
      const peerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (!conversations.has(peerId)) {
        conversations.set(peerId, {
          peer_id: peerId,
          last_message: msg.content,
          last_time: msg.created_at,
          unread_count: 0,
          peer: null,
        });
      }

      // Count unread
      if (msg.receiver_id === user.id && !msg.is_read) {
        const conv = conversations.get(peerId)!;
        conv.unread_count += 1;
      }
    }

    // Get peer user info
    const peerIds = Array.from(conversations.keys());
    if (peerIds.length > 0) {
      const { data: peers } = await client
        .from("users")
        .select("id, username, nickname, avatar_url, role")
        .in("id", peerIds);

      if (peers) {
        for (const peer of peers) {
          const conv = conversations.get(peer.id);
          if (conv) {
            conv.peer = peer as AuthUser;
          }
        }
      }
    }

    const result = Array.from(conversations.values()).sort(
      (a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime()
    );

    return NextResponse.json({ conversations: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "查询失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
