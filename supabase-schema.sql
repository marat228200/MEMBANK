create extension if not exists pgcrypto;

create table if not exists memes (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  caption text default '',
  author text default '',
  author_id text,
  likes integer default 0,
  created_at timestamptz default now()
);

create table if not exists blocked_authors (
  author_id text primary key,
  blocked_at timestamptz default now()
);

create table if not exists admin_ids (
  visitor_id text primary key,
  added_at timestamptz default now()
);

alter table memes enable row level security;
alter table blocked_authors enable row level security;
alter table admin_ids enable row level security;
