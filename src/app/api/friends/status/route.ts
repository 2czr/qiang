import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

// GET /api/friends/status?userId=xxx - Check friendship status with another user
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "缺少userId" }, { status: 400 });
    }

    const client = getSupabaseClient();

    // Check if there's a friend request in either direction
    const { data, error } = await client
      .from("friend_requests")
      .select("id, status, sender_id")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
      .maybeSingle();

    if (error) throw new Error(`查询失败: ${error.message}`);

    if (!data) {
      return NextResponse.json({ status: "none" }); // No relationship
    }

    if (data.status === "accepted") {
      return NextResponse.json({ status: "friends", requestId: data.id });
    }

    if (data.status === "pending") {
      if (data.sender_id === user.id) {
        return NextResponse.json({ status: "sent", requestId: data.id }); // Current user sent the request
      }
      return NextResponse.json({ status: "pending", requestId: data.id }); // Current user received the request
    }

    if (data.status === "rejected") {
      return NextResponse.json({ status: "rejected", requestId: data.id });
    }

    return NextResponse.json({ status: "none" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "查询失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
