import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

// POST /api/friends/respond - Accept or reject friend request
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { requestId, action } = await request.json();
    if (!requestId || !action) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    if (!["accept", "reject"].includes(action)) {
      return NextResponse.json({ error: "无效的操作" }, { status: 400 });
    }

    const client = getSupabaseClient();

    // Verify the request exists and belongs to this user
    const { data: friendReq, error: fetchError } = await client
      .from("friend_requests")
      .select("id, sender_id, receiver_id, status")
      .eq("id", requestId)
      .maybeSingle();

    if (fetchError) throw new Error(`查询失败: ${fetchError.message}`);
    if (!friendReq) {
      return NextResponse.json({ error: "请求不存在" }, { status: 404 });
    }
    if (friendReq.receiver_id !== user.id) {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }
    if (friendReq.status !== "pending") {
      return NextResponse.json({ error: "该请求已处理" }, { status: 400 });
    }

    const newStatus = action === "accept" ? "accepted" : "rejected";
    const { data, error } = await client
      .from("friend_requests")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", requestId)
      .select("id, sender_id, receiver_id, status, created_at")
      .single();

    if (error) throw new Error(`操作失败: ${error.message}`);

    return NextResponse.json({ request: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "操作失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
