import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const after = searchParams.get("after");
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!roomId) {
      return NextResponse.json({ error: "缺少roomId" }, { status: 400 });
    }

    const client = getSupabaseClient();
    const currentUser = await getUserFromRequest(request);
    const isSuperAdmin = currentUser?.role === "super_admin";

    let query = client
      .from("chat_messages")
      .select("id, content, image_url, created_at, user_id, users!chat_messages_user_id_users_id_fk(nickname, avatar_url, username, role)")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (after) {
      query = query.gt("created_at", after);
    }

    const { data, error } = await query;

    if (error) throw new Error(`查询消息失败: ${error.message}`);

    const messages = (data || []).reverse().map((msg: Record<string, unknown>) => {
      const userInfo = msg.users as Record<string, unknown> | null;
      if (!isSuperAdmin) {
        return {
          ...msg,
          users: {
            nickname: userInfo?.nickname,
            avatar_url: userInfo?.avatar_url,
          },
        };
      }
      return msg;
    });

    return NextResponse.json({ messages });
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

    const body = await request.json();
    const { roomId, content, imageUrl } = body;

    if (!roomId || ((!content || content.trim().length === 0) && !imageUrl)) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from("chat_messages")
      .insert({
        room_id: roomId,
        user_id: user.id,
        content: content?.trim() || null,
        image_url: imageUrl || null,
      })
      .select("id, content, image_url, created_at, user_id, users!chat_messages_user_id_users_id_fk(nickname, avatar_url, username, role)")
      .single();

    if (error) throw new Error(`发送消息失败: ${error.message}`);

    const isSuperAdmin = user.role === "super_admin";
    const userInfo = data.users as unknown as Record<string, unknown> | null;
    const safeData = isSuperAdmin
      ? data
      : {
          ...data,
          users: {
            nickname: userInfo?.nickname,
            avatar_url: userInfo?.avatar_url,
          },
        };

    return NextResponse.json({ message: safeData });
  } catch (err) {
    const message = err instanceof Error ? err.message : "发送失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
