import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export async function GET() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("chat_rooms")
      .select("id, name, description, created_at")
      .order("created_at", { ascending: true });

    if (error) throw new Error(`查询聊天室失败: ${error.message}`);

    return NextResponse.json({ rooms: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "查询失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
