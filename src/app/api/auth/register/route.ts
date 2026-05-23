import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { hashPassword, createSessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { username, password, nickname, device_id } = await request.json();

    if (!username || !password || !nickname) {
      return NextResponse.json({ error: "请填写所有字段" }, { status: 400 });
    }

    if (username.length < 2 || username.length > 20) {
      return NextResponse.json({ error: "用户名需2-20个字符" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "密码至少6个字符" }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 检查用户名是否已存在
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("username", username)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: "用户名已存在" }, { status: 400 });
    }

    // 一机一号限制：同一设备只能注册一个账号
    if (device_id) {
      const { data: deviceUser } = await supabase
        .from("users")
        .select("id, username")
        .eq("device_id", device_id)
        .limit(1);

      if (deviceUser && deviceUser.length > 0) {
        return NextResponse.json(
          { error: "该设备已注册过账号，一台设备只能注册一个账号" },
          { status: 400 }
        );
      }
    }

    const password_hash = await hashPassword(password);

    const { data: user, error } = await supabase
      .from("users")
      .insert({
        username,
        nickname,
        password_hash,
        role: "user",
        status: "active",
        device_id: device_id || null,
      })
      .select("id, username, nickname, role, status, avatar_url, permissions")
      .single();

    if (error) {
      console.error("注册失败:", error);
      return NextResponse.json({ error: "注册失败，请稍后重试" }, { status: 500 });
    }

    const token = createSessionToken(user.id);

    return NextResponse.json({
      user,
      token,
      message: "注册成功",
    });
  } catch (err) {
    console.error("注册异常:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
