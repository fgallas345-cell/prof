-- =====================================================================
--  Cahier d'appel numérique — Schéma Supabase (PostgreSQL + RLS)
--  À exécuter dans : Supabase Dashboard → SQL Editor → New query
-- =====================================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";

-- ---------- Types ----------
do $$ begin
  create type user_role as enum ('teacher', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_status as enum ('pending', 'active', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_type as enum ('free', 'monthly', 'annual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_status as enum ('present', 'absent', 'late', 'excused');
exception when duplicate_object then null; end $$;

-- ---------- Tables ----------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  full_name     text,
  role          user_role       not null default 'teacher',
  status        account_status  not null default 'pending',
  plan          plan_type       not null default 'free',
  payment_note  text,
  created_at    timestamptz     not null default now(),
  updated_at    timestamptz     not null default now()
);

create table if not exists public.classes (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  level       text,
  color       text default '#4f46e5',
  created_at  timestamptz not null default now()
);

create table if not exists public.students (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.profiles(id) on delete cascade,
  class_id    uuid not null references public.classes(id) on delete cascade,
  first_name  text not null,
  last_name   text not null,
  birth_date  date,                 -- date de naissance
  student_code text,                -- identifiant / matricule optionnel (distingue deux homonymes nés le même jour)
  created_at  timestamptz not null default now()
);

-- Mise à jour d'une base existante (idempotent) : ajoute les colonnes si elles manquent
alter table public.students add column if not exists birth_date   date;
alter table public.students add column if not exists student_code text;

create table if not exists public.attendance_records (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid not null references public.profiles(id) on delete cascade,
  class_id     uuid not null references public.classes(id) on delete cascade,
  student_id   uuid not null references public.students(id) on delete cascade,
  date         date not null,
  status       attendance_status not null default 'present',
  note         text,
  recorded_at  timestamptz not null default now(),
  unique (student_id, date)
);

-- ---------- Index ----------
create index if not exists idx_classes_teacher on public.classes(teacher_id);
create index if not exists idx_students_class on public.students(class_id);
create index if not exists idx_students_teacher on public.students(teacher_id);
create index if not exists idx_att_class_date on public.attendance_records(class_id, date);
create index if not exists idx_att_student on public.attendance_records(student_id);
create index if not exists idx_att_teacher on public.attendance_records(teacher_id);

-- ---------- Fonctions utilitaires (SECURITY DEFINER pour éviter la récursion RLS) ----------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_active_teacher()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active');
$$;

-- ---------- Création automatique du profil à l'inscription ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- updated_at automatique ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute procedure public.touch_updated_at();

-- ---------- Limite du plan gratuit : 1 seule classe ----------
create or replace function public.enforce_free_plan_class_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p plan_type;
  n int;
begin
  select plan into p from public.profiles where id = new.teacher_id;
  if p = 'free' then
    select count(*) into n from public.classes where teacher_id = new.teacher_id;
    if n >= 1 then
      raise exception 'FREE_PLAN_LIMIT: le plan gratuit est limité à 1 classe.';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists classes_free_limit on public.classes;
create trigger classes_free_limit before insert on public.classes
  for each row execute procedure public.enforce_free_plan_class_limit();

-- ---------- Row Level Security ----------
alter table public.profiles           enable row level security;
alter table public.classes            enable row level security;
alter table public.students           enable row level security;
alter table public.attendance_records enable row level security;

-- profiles : chacun lit son profil, l'admin lit/modifie tout
drop policy if exists "profiles: read own"    on public.profiles;
drop policy if exists "profiles: update own"  on public.profiles;
drop policy if exists "profiles: admin all"   on public.profiles;

create policy "profiles: read own" on public.profiles
  for select using (id = auth.uid());

-- un enseignant ne peut modifier que son nom (rôle / statut / plan verrouillés par trigger ci-dessous)
create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles: admin all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.role   := old.role;
    new.status := old.status;
    new.plan   := old.plan;
    new.payment_note := old.payment_note;
  end if;
  return new;
end; $$;

drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect before update on public.profiles
  for each row execute procedure public.protect_profile_fields();

-- classes / students / attendance : uniquement l'enseignant propriétaire ET compte actif
drop policy if exists "classes: owner" on public.classes;
create policy "classes: owner" on public.classes
  for all
  using (teacher_id = auth.uid() and public.is_active_teacher())
  with check (teacher_id = auth.uid() and public.is_active_teacher());

drop policy if exists "students: owner" on public.students;
create policy "students: owner" on public.students
  for all
  using (teacher_id = auth.uid() and public.is_active_teacher())
  with check (teacher_id = auth.uid() and public.is_active_teacher());

drop policy if exists "attendance: owner" on public.attendance_records;
create policy "attendance: owner" on public.attendance_records
  for all
  using (teacher_id = auth.uid() and public.is_active_teacher())
  with check (teacher_id = auth.uid() and public.is_active_teacher());

-- l'admin peut lire (uniquement lire) les données métier pour la supervision
drop policy if exists "classes: admin read" on public.classes;
create policy "classes: admin read" on public.classes for select using (public.is_admin());
drop policy if exists "students: admin read" on public.students;
create policy "students: admin read" on public.students for select using (public.is_admin());
drop policy if exists "attendance: admin read" on public.attendance_records;
create policy "attendance: admin read" on public.attendance_records for select using (public.is_admin());

-- ---------- Vue admin : statistiques par enseignant ----------
create or replace view public.admin_teacher_stats
with (security_invoker = true) as
select
  p.id,
  (select count(*) from public.classes c where c.teacher_id = p.id)  as classes_count,
  (select count(*) from public.students s where s.teacher_id = p.id) as students_count,
  (select max(a.recorded_at) from public.attendance_records a where a.teacher_id = p.id) as last_activity
from public.profiles p;

-- =====================================================================
--  APRÈS L'INSCRIPTION DE VOTRE PROPRE COMPTE, PROMOUVEZ-LE ADMIN :
--
--  update public.profiles
--     set role = 'admin', status = 'active', plan = 'annual'
--   where email = 'votre-email@exemple.com';
-- =====================================================================
