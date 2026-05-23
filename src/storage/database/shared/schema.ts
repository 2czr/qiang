import { pgTable, serial, varchar, text, boolean, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// System table - DO NOT DELETE
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// Users table
export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    username: varchar("username", { length: 50 }).notNull().unique(),
    nickname: varchar("nickname", { length: 50 }).notNull(),
    avatar_url: varchar("avatar_url", { length: 500 }),
    role: varchar("role", { length: 20 }).notNull().default("user"),
    password_hash: varchar("password_hash", { length: 255 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    device_id: varchar("device_id", { length: 500 }),
    permissions: jsonb("permissions").default({ canPin: true, canDelete: true, canViewUser: true, canManageRole: false }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("users_username_idx").on(table.username),
    index("users_role_idx").on(table.role),
    index("idx_users_device_id").on(table.device_id),
  ]
);

// Wall posts (校园墙帖子)
export const wallPosts = pgTable(
  "wall_posts",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    image_url: varchar("image_url", { length: 500 }),
    is_anonymous: boolean("is_anonymous").default(false).notNull(),
    is_pinned: boolean("is_pinned").default(false).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("wall_posts_user_id_idx").on(table.user_id),
    index("wall_posts_created_at_idx").on(table.created_at),
    index("wall_posts_is_pinned_idx").on(table.is_pinned),
  ]
);

// Post comments (帖子评论)
export const postComments = pgTable(
  "post_comments",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    post_id: varchar("post_id", { length: 36 }).notNull().references(() => wallPosts.id, { onDelete: "cascade" }),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    image_url: varchar("image_url", { length: 500 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("post_comments_post_id_idx").on(table.post_id),
    index("post_comments_user_id_idx").on(table.user_id),
    index("post_comments_created_at_idx").on(table.created_at),
  ]
);

// Post likes (帖子点赞)
export const postLikes = pgTable(
  "post_likes",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    post_id: varchar("post_id", { length: 36 }).notNull().references(() => wallPosts.id, { onDelete: "cascade" }),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("post_likes_post_id_idx").on(table.post_id),
    index("post_likes_user_id_idx").on(table.user_id),
    index("post_likes_post_user_idx").on(table.post_id, table.user_id),
  ]
);

// Chat rooms (聊天室)
export const chatRooms = pgTable(
  "chat_rooms",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("chat_rooms_created_at_idx").on(table.created_at),
  ]
);

// Chat messages (聊天消息)
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    room_id: varchar("room_id", { length: 36 }).notNull().references(() => chatRooms.id, { onDelete: "cascade" }),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    content: text("content"),
    image_url: varchar("image_url", { length: 500 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("chat_messages_room_id_idx").on(table.room_id),
    index("chat_messages_user_id_idx").on(table.user_id),
    index("chat_messages_room_created_idx").on(table.room_id, table.created_at),
  ]
);

// Private messages (私聊消息)
export const privateMessages = pgTable(
  "private_messages",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    sender_id: varchar("sender_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    receiver_id: varchar("receiver_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    content: text("content"),
    image_url: varchar("image_url", { length: 500 }),
    is_read: boolean("is_read").default(false).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("private_messages_sender_id_idx").on(table.sender_id),
    index("private_messages_receiver_id_idx").on(table.receiver_id),
    index("private_messages_pair_created_idx").on(table.sender_id, table.receiver_id, table.created_at),
    index("private_messages_receiver_read_idx").on(table.receiver_id, table.is_read),
  ]
);

// Group chats
export const groupChats = pgTable(
  "group_chats",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 100 }).notNull(),
    owner_id: varchar("owner_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("group_chats_owner_id_idx").on(table.owner_id),
    index("group_chats_created_at_idx").on(table.created_at),
  ]
);

// Group chat members
export const groupChatMembers = pgTable(
  "group_chat_members",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    group_id: varchar("group_id", { length: 36 }).notNull().references(() => groupChats.id, { onDelete: "cascade" }),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull().default("member"),
    joined_at: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("group_chat_members_group_id_idx").on(table.group_id),
    index("group_chat_members_user_id_idx").on(table.user_id),
    index("group_chat_members_group_user_idx").on(table.group_id, table.user_id),
  ]
);

// Group chat messages
export const groupChatMessages = pgTable(
  "group_chat_messages",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    group_id: varchar("group_id", { length: 36 }).notNull().references(() => groupChats.id, { onDelete: "cascade" }),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    content: text("content"),
    image_url: varchar("image_url", { length: 500 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("group_chat_messages_group_id_idx").on(table.group_id),
    index("group_chat_messages_user_id_idx").on(table.user_id),
    index("group_chat_messages_group_created_idx").on(table.group_id, table.created_at),
  ]
);

// Ads (广告)
export const ads = pgTable(
  "ads",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    title: varchar("title", { length: 200 }).notNull(),
    image_url: varchar("image_url", { length: 500 }),
    link_url: varchar("link_url", { length: 500 }),
    description: text("description"),
    is_active: boolean("is_active").default(true).notNull(),
    sort_order: serial("sort_order").default(0),
    created_by: varchar("created_by", { length: 100 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("ads_is_active_idx").on(table.is_active),
    index("ads_sort_order_idx").on(table.sort_order),
  ]
);

// Friend requests (好友请求)
export const friendRequests = pgTable(
  "friend_requests",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    sender_id: varchar("sender_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    receiver_id: varchar("receiver_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, accepted, rejected
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("friend_requests_sender_id_idx").on(table.sender_id),
    index("friend_requests_receiver_id_idx").on(table.receiver_id),
    index("friend_requests_pair_idx").on(table.sender_id, table.receiver_id),
  ]
);
