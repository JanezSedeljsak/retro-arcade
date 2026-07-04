create table scores (
  id bigint generated always as identity primary key,
  game_id varchar(255) not null,
  username varchar(255) not null,
  score int not null,
  created_at timestamptz default now()
);

-- use less space on supabase
alter table scores
  alter column game_id type varchar(32),
  alter column username type varchar(32);

create or replace function top_scores(p_game_id text)
returns setof scores
language sql
stable
as $$
  select id, game_id, username, score, created_at
  from (
    select *,
      row_number() over (
        partition by username
        order by score desc, created_at asc
      ) as rn
    from scores
    where game_id = p_game_id
  ) ranked
  where rn <= 3
  order by score desc, created_at asc
  limit 30;
$$;