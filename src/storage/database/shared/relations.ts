import { relations } from "drizzle-orm/relations";
import {
  users,
  wallPosts,
  postComments,
  postLikes,
  chatRooms,
  chatMessages,
  privateMessages,
  groupChats,
  groupChatMembers,
  groupChatMessages,
} from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  wallPosts: many(wallPosts),
  postComments: many(postComments),
  postLikes: many(postLikes),
  chatMessages: many(chatMessages),
  sentPrivateMessages: many(privateMessages),
  ownedGroupChats: many(groupChats),
  groupChatMembers: many(groupChatMembers),
  groupChatMessages: many(groupChatMessages),
}));

export const wallPostsRelations = relations(wallPosts, ({ one, many }) => ({
  user: one(users, {
    fields: [wallPosts.user_id],
    references: [users.id],
  }),
  comments: many(postComments),
  likes: many(postLikes),
}));

export const postCommentsRelations = relations(postComments, ({ one }) => ({
  post: one(wallPosts, {
    fields: [postComments.post_id],
    references: [wallPosts.id],
  }),
  user: one(users, {
    fields: [postComments.user_id],
    references: [users.id],
  }),
}));

export const postLikesRelations = relations(postLikes, ({ one }) => ({
  post: one(wallPosts, {
    fields: [postLikes.post_id],
    references: [wallPosts.id],
  }),
  user: one(users, {
    fields: [postLikes.user_id],
    references: [users.id],
  }),
}));

export const chatRoomsRelations = relations(chatRooms, ({ many }) => ({
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  room: one(chatRooms, {
    fields: [chatMessages.room_id],
    references: [chatRooms.id],
  }),
  user: one(users, {
    fields: [chatMessages.user_id],
    references: [users.id],
  }),
}));

export const privateMessagesRelations = relations(privateMessages, ({ one }) => ({
  sender: one(users, {
    fields: [privateMessages.sender_id],
    references: [users.id],
    relationName: "sentMessages",
  }),
  receiver: one(users, {
    fields: [privateMessages.receiver_id],
    references: [users.id],
    relationName: "receivedMessages",
  }),
}));

export const groupChatsRelations = relations(groupChats, ({ one, many }) => ({
  owner: one(users, {
    fields: [groupChats.owner_id],
    references: [users.id],
  }),
  members: many(groupChatMembers),
  messages: many(groupChatMessages),
}));

export const groupChatMembersRelations = relations(groupChatMembers, ({ one }) => ({
  group: one(groupChats, {
    fields: [groupChatMembers.group_id],
    references: [groupChats.id],
  }),
  user: one(users, {
    fields: [groupChatMembers.user_id],
    references: [users.id],
  }),
}));

export const groupChatMessagesRelations = relations(groupChatMessages, ({ one }) => ({
  group: one(groupChats, {
    fields: [groupChatMessages.group_id],
    references: [groupChats.id],
  }),
  user: one(users, {
    fields: [groupChatMessages.user_id],
    references: [users.id],
  }),
}));
