import { getSupabaseClient } from "@/storage/database/supabase-client";

// Simple hash function for passwords (in production, use bcrypt)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "campus-wall-salt-2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

export { hashPassword };

export interface AuthUser {
  id: string;
  username: string;
  nickname: string;
  avatar_url: string | null;
  role: string;
  status: string;
  permissions?: Record<string, boolean> | null;
}

export async function getUserById(id: string): Promise<AuthUser | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("users")
    .select("id, username, nickname, avatar_url, role, status, permissions")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`查询用户失败: ${error.message}`);
  // Filter out deleted users
  if (data?.status === "deleted") return null;
  return data as AuthUser | null;
}

export async function getUserByUsername(username: string): Promise<(AuthUser & { password_hash: string }) | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("users")
    .select("id, username, nickname, avatar_url, role, status, permissions, password_hash")
    .eq("username", username)
    .maybeSingle();
  if (error) throw new Error(`查询用户失败: ${error.message}`);
  return data as (AuthUser & { password_hash: string }) | null;
}

// Simple session management using cookies
export function createSessionToken(userId: string): string {
  const payload = { userId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }; // 7 days
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export function verifySessionToken(token: string): { userId: string; exp: number } | null {
  try {
    const payload = JSON.parse(Buffer.from(token, "base64").toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getUserFromRequest(request: Request): Promise<AuthUser | null> {
  // 1. 优先从 Authorization header 读取 token
  const authHeader = request.headers.get("authorization");
  let token: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }

  // 2. 回退到 cookie 读取
  if (!token) {
    const cookieStr = request.headers.get("cookie") ?? "";
    const match = cookieStr.match(/(?:^|;\s*)session_token=([^;]*)/);
    token = match ? match[1] : null;
  }

  if (!token) return null;
  const payload = verifySessionToken(decodeURIComponent(token));
  if (!payload) return null;
  return getUserById(payload.userId);
}
