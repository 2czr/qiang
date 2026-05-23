create table if not exists public.group_chats (
  id varchar(36) primary key default gen_random_uuid(),
  name varchar(100) not null,
  owner_id varchar(36) not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists group_chats_owner_id_idx on public.group_chats(owner_id);
create index if not exists group_chats_created_at_idx on public.group_chats(created_at);

create table if not exists public.group_chat_members (
  id varchar(36) primary key default gen_random_uuid(),
  group_id varchar(36) not null references public.group_chats(id) on delete cascade,
  user_id varchar(36) not null references public.users(id) on delete cascade,
  role varchar(20) not null default 'member',
  joined_at timestamptz not null default now(),
  constraint group_chat_members_group_user_unique unique (group_id, user_id)
);

create index if not exists group_chat_members_group_id_idx on public.group_chat_members(group_id);
create index if not exists group_chat_members_user_id_idx on public.group_chat_members(user_id);
create index if not exists group_chat_members_group_user_idx on public.group_chat_members(group_id, user_id);

create table if not exists public.group_chat_messages (
  id varchar(36) primary key default gen_random_uuid(),
  group_id varchar(36) not null references public.group_chats(id) on delete cascade,
  user_id varchar(36) not null references public.users(id) on delete cascade,
  content text,
  image_url varchar(500),
  created_at timestamptz not null default now()
);

create index if not exists group_chat_messages_group_id_idx on public.group_chat_messages(group_id);
create index if not exists group_chat_messages_user_id_idx on public.group_chat_messages(user_id);
create index if not exists group_chat_messages_group_created_idx on public.group_chat_messages(group_id, created_at);
