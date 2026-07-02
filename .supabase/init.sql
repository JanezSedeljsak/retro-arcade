create table scores (
  id bigint generated always as identity primary key,
  game_id varchar(255) not null,
  username varchar(255) not null,
  score int not null,
  created_at timestamptz default now()
);