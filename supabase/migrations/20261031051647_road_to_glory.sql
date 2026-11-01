-- Road to Glory, the RPG.
--
-- Students spend the gold (points) they earn from homework on medieval gear,
-- and use quest scrolls (one per piece of homework handed in on time, plus
-- three to start) to fight monsters. Item stats and the battles themselves
-- live in the app (src/lib/game); the database owns what costs points and
-- what is limited: buying gear, and how many battles a student can fight.
--
-- Points: work handed in after the end of its due day now earns half its
-- points when verified, so on-time homework is what powers the hero.
--
-- Times are school time (India, Asia/Kolkata), matching the seed scripts.

-- ── The armoury ─────────────────────────────────────────────────────────────

create table public.hero_items (
  key text primary key,
  name text not null,
  slot text not null check (slot in ('weapon', 'offhand', 'head', 'body', 'trinket')),
  price integer not null check (price >= 0),
  level integer not null check (level between 1 and 20),
  two_handed boolean not null default false,
  starter boolean not null default false
);

-- Keep in step with src/lib/game/items.ts.
insert into public.hero_items (key, name, slot, price, level, two_handed, starter) values
  ('training-sword', 'Training Sword', 'weapon', 0, 1, false, true),
  ('shortsword', 'Shortsword', 'weapon', 40, 1, false, false),
  ('longsword', 'Longsword', 'weapon', 90, 3, false, false),
  ('rapier', 'Rapier', 'weapon', 120, 4, false, false),
  ('battleaxe', 'Battleaxe', 'weapon', 110, 4, false, false),
  ('warhammer', 'Warhammer', 'weapon', 160, 5, false, false),
  ('longbow', 'Longbow', 'weapon', 150, 5, true, false),
  ('darksword', 'Darksword', 'weapon', 220, 6, false, false),
  ('greatsword', 'Greatsword', 'weapon', 260, 7, true, false),
  ('flame-tongue', 'Flame Tongue', 'weapon', 400, 9, false, false),
  ('sunblade', 'Sunblade', 'weapon', 700, 12, false, false),
  ('buckler', 'Wooden Buckler', 'offhand', 25, 1, false, false),
  ('kite-shield', 'Kite Shield', 'offhand', 90, 3, false, false),
  ('spiked-shield', 'Spiked Shield', 'offhand', 180, 5, false, false),
  ('tower-shield', 'Tower Shield', 'offhand', 200, 6, false, false),
  ('leather-cap', 'Leather Cap', 'head', 20, 1, false, false),
  ('iron-helm', 'Iron Helm', 'head', 80, 3, false, false),
  ('wizard-hat', 'Wizard''s Hat', 'head', 140, 5, false, false),
  ('great-helm', 'Knight''s Great Helm', 'head', 180, 6, false, false),
  ('crown', 'Crown of the Mountain King', 'head', 500, 10, false, false),
  ('padded-tunic', 'Padded Tunic', 'body', 0, 1, false, true),
  ('leather-armour', 'Leather Armour', 'body', 60, 2, false, false),
  ('chain-mail', 'Chain Mail', 'body', 150, 4, false, false),
  ('elven-chain', 'Elven Chain', 'body', 300, 7, false, false),
  ('plate-armour', 'Plate Armour', 'body', 350, 8, false, false),
  ('dragonscale', 'Dragonscale Armour', 'body', 600, 11, false, false),
  ('lucky-clover', 'Lucky Clover', 'trinket', 30, 1, false, false),
  ('ring-of-vigour', 'Ring of Vigour', 'trinket', 80, 2, false, false),
  ('healers-charm', 'Healer''s Charm', 'trinket', 100, 3, false, false),
  ('amulet-of-swiftness', 'Amulet of Swiftness', 'trinket', 140, 4, false, false),
  ('owl-pendant', 'Owl Pendant', 'trinket', 150, 5, false, false),
  ('berserker-ring', 'Berserker''s Ring', 'trinket', 250, 7, false, false),
  ('phoenix-feather', 'Phoenix Feather', 'trinket', 450, 10, false, false);

alter table public.hero_items enable row level security;
revoke all on public.hero_items from anon;
revoke insert, update, delete on public.hero_items from authenticated;
create policy "Signed-in users read the armoury" on public.hero_items
  for select to authenticated using (true);

-- ── Each hero's gear and battles ────────────────────────────────────────────

create table public.hero_inventory (
  student_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  item_key text not null references public.hero_items (key) on delete cascade,
  equipped boolean not null default false,
  acquired_at timestamptz not null default now(),
  primary key (student_id, item_key)
);

create table public.hero_battles (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  monster text not null check (char_length(monster) between 1 and 40),
  won boolean not null,
  created_at timestamptz not null default now()
);
create index hero_battles_student_idx on public.hero_battles (student_id, created_at);

-- Students read their own; every change goes through the functions below.
alter table public.hero_inventory enable row level security;
alter table public.hero_battles enable row level security;
revoke all on public.hero_inventory, public.hero_battles from anon;
revoke insert, update, delete on public.hero_inventory, public.hero_battles from authenticated;
create policy "Heroes see their own gear" on public.hero_inventory
  for select to authenticated using (student_id = (select auth.uid()));
create policy "Heroes see their own battles" on public.hero_battles
  for select to authenticated using (student_id = (select auth.uid()));

-- ── Rules ───────────────────────────────────────────────────────────────────

-- Level 2 at 25 XP, 3 at 100, 4 at 225 … (25 × (level − 1)²), up to 20.
-- XP is every point earned for homework (src/lib/game/rules.ts levelFor).
create or replace function private.hero_level(xp bigint)
returns integer
language sql immutable set search_path = ''
as $$ select least(20, 1 + floor(sqrt(greatest(xp, 0) / 25.0)))::integer $$;

-- Only students have a hero.
create or replace function private.require_student()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if (select p.role from public.profiles p where p.id = me) is distinct from 'student' then
    raise exception 'Only students have a hero' using errcode = '42501';
  end if;
  return me;
end;
$$;

create or replace function public.buy_hero_item(item text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := private.require_student();
  it public.hero_items%rowtype;
  xp bigint;
  gold bigint;
begin
  select * into it from public.hero_items i where i.key = item;
  if not found or it.starter then
    raise exception 'That item is not for sale' using errcode = 'P0002';
  end if;

  -- Same lock as redeem_reward, so two purchases cannot spend the same gold.
  perform pg_advisory_xact_lock(hashtextextended(me::text, 0));
  if exists (select 1 from public.hero_inventory v where v.student_id = me and v.item_key = item) then
    raise exception 'You already own the %', it.name using errcode = '23505';
  end if;

  select coalesce(sum(l.delta) filter (where l.submission_id is not null), 0), coalesce(sum(l.delta), 0)
  into xp, gold
  from public.points_ledger l where l.student_id = me;
  if private.hero_level(xp) < it.level then
    raise exception 'Reach level % to buy the %', it.level, it.name using errcode = 'P0001';
  end if;
  if gold < it.price then
    raise exception 'Not enough gold for the %', it.name using errcode = 'P0001';
  end if;

  insert into public.hero_inventory (student_id, item_key) values (me, item);
  insert into public.points_ledger (student_id, delta, reason) values (me, -it.price, 'Bought ' || it.name);
end;
$$;

-- Equip an owned (or starter) item. A two-handed weapon takes the shield
-- off; a shield takes a two-handed weapon off.
create or replace function public.equip_hero_item(item text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := private.require_student();
  it public.hero_items%rowtype;
begin
  select * into it from public.hero_items i where i.key = item;
  if not found then
    raise exception 'No such item' using errcode = 'P0002';
  end if;
  if not it.starter and not exists (
    select 1 from public.hero_inventory v where v.student_id = me and v.item_key = item
  ) then
    raise exception 'You do not own the %', it.name using errcode = '42501';
  end if;

  insert into public.hero_inventory (student_id, item_key) values (me, item) on conflict do nothing;
  update public.hero_inventory v set equipped = false
  where v.student_id = me and v.equipped and v.item_key in (
    select i.key from public.hero_items i
    where i.slot = it.slot
      or (it.two_handed and i.slot = 'offhand')
      or (it.slot = 'offhand' and i.slot = 'weapon' and i.two_handed)
  );
  update public.hero_inventory v set equipped = true where v.student_id = me and v.item_key = item;
end;
$$;

create or replace function public.unequip_hero_slot(target_slot text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := private.require_student();
begin
  update public.hero_inventory v set equipped = false
  where v.student_id = me and v.equipped
    and v.item_key in (select i.key from public.hero_items i where i.slot = target_slot);
end;
$$;

-- A battle costs one quest scroll: three to start, plus one for every piece
-- of class work handed in by the end of its due day (and not sent back).
create or replace function public.record_hero_battle(monster text, won boolean)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := private.require_student();
  on_time bigint;
  fought bigint;
  battle uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(me::text, 1));
  select count(*) into on_time
  from public.task_submissions s
  join public.tasks t on t.id = s.task_id
  where s.student_id = me
    and t.class_id is not null
    and s.status in ('submitted', 'verified')
    and s.submitted_at < ((t.due_on + 1)::timestamp at time zone 'Asia/Kolkata');
  select count(*) into fought from public.hero_battles b where b.student_id = me;
  if 3 + on_time - fought <= 0 then
    raise exception 'No quest scrolls left. Hand in homework on time to earn more.' using errcode = 'P0001';
  end if;

  insert into public.hero_battles (student_id, monster, won) values (me, monster, won) returning id into battle;
  return battle;
end;
$$;

revoke execute on function private.hero_level(bigint), private.require_student() from public, anon;
grant execute on function private.hero_level(bigint), private.require_student() to authenticated;
revoke execute on function
  public.buy_hero_item(text), public.equip_hero_item(text), public.unequip_hero_slot(text), public.record_hero_battle(text, boolean)
  from public, anon;
grant execute on function
  public.buy_hero_item(text), public.equip_hero_item(text), public.unequip_hero_slot(text), public.record_hero_battle(text, boolean)
  to authenticated;

-- ── On-time points ──────────────────────────────────────────────────────────

-- Verified work pays its points; work handed in after the end of its due
-- day pays half (rounded up). Undoing a verification takes back what it paid.
create or replace function public.pay_out_verified_submission()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  task_points integer;
  task_class uuid;
  task_title text;
  task_due date;
  amount integer;
  paid integer;
begin
  select t.points, t.class_id, t.title, t.due_on into task_points, task_class, task_title, task_due
  from public.tasks t where t.id = new.task_id;

  if task_class is null or coalesce(task_points, 0) = 0 then
    return new;
  end if;

  if new.status = 'verified' and old.status is distinct from 'verified' then
    if new.submitted_at < ((task_due + 1)::timestamp at time zone 'Asia/Kolkata') then
      amount := task_points;
    else
      amount := ceil(task_points / 2.0)::integer;
    end if;
    insert into public.points_ledger (student_id, class_id, delta, reason, submission_id)
    values (new.student_id, task_class, amount, case when amount < task_points then task_title || ' (late, half points)' else task_title end, new.id);
  elsif old.status = 'verified' and new.status <> 'verified' then
    select coalesce(sum(l.delta), 0) into paid from public.points_ledger l where l.submission_id = new.id;
    if paid > 0 then
      insert into public.points_ledger (student_id, class_id, delta, reason, submission_id)
      values (new.student_id, task_class, -paid, 'Verification undone: ' || task_title, new.id);
    end if;
  end if;
  return new;
end;
$$;
