import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSupabaseClient } from "@/storage/database/supabase-client";

async function ensureGroupMember(client: ReturnType<typeof getSupabaseClient>, groupId: string, userId: string): Promise<boolean> {
  const { data, error } = await client
    .from("group_chat_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to check group membership: ${error.message}`);
  return !!data;
}

function cleanMessage(message: Record<string, unknown>, isSuperAdmin: boolean) {
  const userInfo = message.users as Record<string, unknown> | null;
  if (isSuperAdmin) return message;
  return {
    ...message,
    users: {
      nickname: userInfo?.nickname,
      avatar_url: userInfo?.avatar_url,
    },
  };
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Please log in first" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get("groupId");
    const after = searchParams.get("after");
    const limit = Math.min(parseInt(searchParams.get("limit") || "80", 10), 200);

    if (!groupId) {
      return NextResponse.json({ error: "groupId is required" }, { status: 400 });
    }

    const client = getSupabaseClient();
    const isMember = await ensureGroupMember(client, groupId, user.id);
    if (!isMember) {
      return NextResponse.json({ error: "You are not in this group" }, { status: 403 });
    }

    let query = client
      .from("group_chat_messages")
      .select("id, group_id, user_id, content, image_url, created_at, users(nickname, avatar_url, username, role)")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (after) {
      query = query.gt("created_at", after);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load group messages: ${error.message}`);

    const messages = ((data || []) as unknown as Record<string, unknown>[])
      .reverse()
      .map((message) => cleanMessage(message, user.role === "super_admin"));

    return NextResponse.json({ messages });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load messages";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Please log in first" }, { status: 401 });
    }

    const body = await request.json();
    const groupId = typeof body.groupId === "string" ? body.groupId : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : null;

    if (!groupId || (!content && !imageUrl)) {
      return NextResponse.json({ error: "Incomplete parameters" }, { status: 400 });
    }

    const client = getSupabaseClient();
    const isMember = await ensureGroupMember(client, groupId, user.id);
    if (!isMember) {
      return NextResponse.json({ error: "You are not in this group" }, { status: 403 });
    }

    const { data, error } = await client
      .from("group_chat_messages")
      .insert({
        group_id: groupId,
        user_id: user.id,
        content: content || null,
        image_url: imageUrl,
      })
      .select("id, group_id, user_id, content, image_url, created_at, users(nickname, avatar_url, username, role)")
      .single();

    if (error) throw new Error(`Failed to send group message: ${error.message}`);

    return NextResponse.json({ message: cleanMessage(data as unknown as Record<string, unknown>, user.role === "super_admin") });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send message";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
