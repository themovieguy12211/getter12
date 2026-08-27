create table if not exists public.custom_embeds (
  id bigint generated always as identity primary key,
  media_type text not null check (media_type in ('movie', 'tv')),
  media_id bigint not null,
  season int,
  episode int,
  title text not null default 'Abyss',
  embed_url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_embed unique (media_type, media_id, season, episode, embed_url)
);

create index idx_custom_embeds_lookup on public.custom_embeds (media_type, media_id, season, episode) where active = true;

alter table public.custom_embeds enable row level security;

create policy "Service role full access" on public.custom_embeds
  for all using (true) with check (true);
