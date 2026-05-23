import { NextResponse } from "next/server";
import { verifyPassword, createSessionToken, getUserByUsername } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: "用户名和密码不能为空" }, { status: 400 });
    }

    const user = await getUserByUsername(username);
    if (!user) {
      return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
    }

    // Check user status
    if (user.status === "frozen") {
      return NextResponse.json({ error: "该账号已被封禁，无法登录" }, { status: 403 });
    }
    if (user.status === "deleted") {
      return NextResponse.json({ error: "该账号已被删除" }, { status: 403 });
    }

    const token = createSessionToken(user.id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash: _, ...safeUser } = user;

    const response = NextResponse.json({ user: safeUser, token });
    response.headers.append(
      "Set-Cookie",
      `session_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
    );
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "登录失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
