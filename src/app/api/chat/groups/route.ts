import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSupabaseClient } from "@/storage/database/supabase-client";

interface GroupMemberRow {
  group_id: string;
  group_chats: {
    id: string;
    name: string;
    owner_id: string;
    created_at: string;
    updated_at: string | null;
  } | null;
}

interface LastMessageRow {
  group_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  users: { nickname: string } | null;
}

interface MemberCountRow {
  group_id: string;
}

function uniqueIds(ids: unknown[], currentUserId: string): string[] {
  return Array.from(new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0 && id !== currentUserId)));
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
    ...((sent || []) as { receiver_id: string }[]).map((item) => item.receiver_id),
    ...((received || []) as { sender_id: string }[]).map((item) => item.sender_id),
  ]);
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Please log in first" }, { status: 401 });
    }

    const client = getSupabaseClient();
    const { data: memberRows, error } = await client
      .from("group_chat_members")
      .select("group_id, group_chats(id, name, owner_id, created_at, updated_at)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false });

    if (error) throw new Error(`Failed to load groups: ${error.message}`);

    const rows = (memberRows || []) as unknown as GroupMemberRow[];
    const groupIds = rows.map((row) => row.group_id);

    const memberCounts = new Map<string, number>();
    const lastMessages = new Map<string, LastMessageRow>();

    if (groupIds.length > 0) {
      const { data: members, error: membersError } = await client
        .from("group_chat_members")
        .select("group_id")
        .in("group_id", groupIds);

      if (membersError) throw new Error(`Failed to load group members: ${membersError.message}`);
      for (const member of (members || []) as MemberCountRow[]) {
        memberCounts.set(member.group_id, (memberCounts.get(member.group_id) || 0) + 1);
      }

      const { data: messages, error: messagesError } = await client
        .from("group_chat_messages")
        .select("group_id, content, image_url, created_at, users(nickname)")
        .in("group_id", groupIds)
        .order("created_at", { ascending: false })
        .limit(200);

      if (messagesError) throw new Error(`Failed to load group messages: ${messagesError.message}`);
      for (const message of (messages || []) as unknown as LastMessageRow[]) {
        if (!lastMessages.has(message.group_id)) {
          lastMessages.set(message.group_id, message);
        }
      }
    }

    const groups = rows
      .filter((row) => row.group_chats)
      .map((row) => {
        const group = row.group_chats!;
        const lastMessage = lastMessages.get(row.group_id);
        return {
          id: group.id,
          name: group.name,
          owner_id: group.owner_id,
          member_count: memberCounts.get(row.group_id) || 0,
          last_message: lastMessage
            ? `${lastMessage.users?.nickname || "User"}: ${lastMessage.image_url ? "[image]" : lastMessage.content || ""}`
            : "",
          last_time: lastMessage?.created_at || group.created_at,
          created_at: group.created_at,
        };
      })
      .sort((a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime());

    return NextResponse.json({ groups });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load groups";
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
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const memberIds = uniqueIds(Array.isArray(body.memberIds) ? body.memberIds : [], user.id);

    if (!name) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    }
    if (memberIds.length < 1) {
      return NextResponse.json({ error: "Select at least one friend" }, { status: 400 });
    }
    if (memberIds.length > 19) {
      return NextResponse.json({ error: "Small groups can include up to 20 people" }, { status: 400 });
    }

    const client = getSupabaseClient();
    const friendIds = await getAcceptedFriendIds(client, user.id);
    const invalidMember = memberIds.find((memberId) => !friendIds.has(memberId));
    if (invalidMember) {
      return NextResponse.json({ error: "Only friends can be invited to a group" }, { status: 403 });
    }

    const { data: group, error: groupError } = await client
      .from("group_chats")
      .insert({ name, owner_id: user.id })
      .select("id, name, owner_id, created_at")
      .single();

    if (groupError) throw new Error(`Failed to create group: ${groupError.message}`);

    const members = [
      { group_id: group.id, user_id: user.id, role: "owner" },
      ...memberIds.map((memberId) => ({ group_id: group.id, user_id: memberId, role: "member" })),
    ];

    const { error: memberError } = await client.from("group_chat_members").insert(members);
    if (memberError) throw new Error(`Failed to add group members: ${memberError.message}`);

    return NextResponse.json({
      group: {
        ...group,
        member_count: members.length,
        last_message: "",
        last_time: group.created_at,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create group";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
