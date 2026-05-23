import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSupabaseClient } from "@/storage/database/supabase-client";

interface FriendRequestRow {
  sender_id?: string;
  receiver_id?: string;
}

async function getGroupMembership(client: ReturnType<typeof getSupabaseClient>, groupId: string, userId: string) {
  const { data, error } = await client
    .from("group_chat_members")
    .select("id, role")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to check group membership: ${error.message}`);
  return data as { id: string; role: string } | null;
}

async function getAcceptedFriendIds(client: ReturnType<typeof getSupabaseClient>, userId: string): Promise<Set<string>> {
  const { data: sent, error: sentError } = await client
    .from("friend_requests")
    .select("receiver_id")
    .eq("sender_id", userId)
    .eq("status", "accepted");

  if (sentError) throw new Error(`Failed to load friends: ${sentError.message}`);

  const { data: received, error: receivedError } = await client
    .from("friend_requests")
    .select("sender_id")
    .eq("receiver_id", userId)
    .eq("status", "accepted");

  if (receivedError) throw new Error(`Failed to load friends: ${receivedError.message}`);

  return new Set([
    ...((sent || []) as FriendRequestRow[]).map((item) => item.receiver_id).filter((id): id is string => !!id),
    ...((received || []) as FriendRequestRow[]).map((item) => item.sender_id).filter((id): id is string => !!id),
  ]);
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Please log in first" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get("groupId");
    if (!groupId) {
      return NextResponse.json({ error: "groupId is required" }, { status: 400 });
    }

    const client = getSupabaseClient();
    const membership = await getGroupMembership(client, groupId, user.id);
    if (!membership) {
      return NextResponse.json({ error: "You are not in this group" }, { status: 403 });
    }

    const { data, error } = await client
      .from("group_chat_members")
      .select("id, group_id, user_id, role, joined_at, users(id, nickname, avatar_url)")
      .eq("group_id", groupId)
      .order("joined_at", { ascending: true });

    if (error) throw new Error(`Failed to load members: ${error.message}`);

    return NextResponse.json({ members: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load members";
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
    const rawMemberIds: unknown[] = Array.isArray(body.memberIds) ? body.memberIds : [];
    const memberIds: string[] = Array.from(new Set(
      rawMemberIds.filter((id): id is string => typeof id === "string" && id.length > 0 && id !== user.id)
    ));

    if (!groupId || memberIds.length === 0) {
      return NextResponse.json({ error: "Select at least one friend" }, { status: 400 });
    }

    const client = getSupabaseClient();
    const membership = await getGroupMembership(client, groupId, user.id);
    if (!membership) {
      return NextResponse.json({ error: "You are not in this group" }, { status: 403 });
    }

    const friendIds = await getAcceptedFriendIds(client, user.id);
    const invalidMember = memberIds.find((memberId) => !friendIds.has(memberId));
    if (invalidMember) {
      return NextResponse.json({ error: "Only friends can be invited to a group" }, { status: 403 });
    }

    const { data: existingMembers, error: existingError } = await client
      .from("group_chat_members")
      .select("user_id")
      .eq("group_id", groupId)
      .in("user_id", memberIds);

    if (existingError) throw new Error(`Failed to check existing members: ${existingError.message}`);

    const existingIds = new Set(((existingMembers || []) as { user_id: string }[]).map((item) => item.user_id));
    const newMembers = memberIds
      .filter((memberId) => !existingIds.has(memberId))
      .map((memberId) => ({ group_id: groupId, user_id: memberId, role: "member" }));

    if (newMembers.length === 0) {
      return NextResponse.json({ added: 0 });
    }

    const { error } = await client.from("group_chat_members").insert(newMembers);
    if (error) throw new Error(`Failed to add members: ${error.message}`);

    return NextResponse.json({ added: newMembers.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add members";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
