-- ============================================================
-- PABARI ERP — Task Management Schema
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

create table if not exists tasks (
  id           bigint generated always as identity primary key,
  sno          integer,
  date         text,
  company      text not null,
  category     text not null default 'Other',
  particulars  text not null,
  responsible  text not null,
  payment      text not null default 'Non-Payment',
  status       text not null default 'pending-discussion',
  status_wk    text,
  hk_comment   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table if not exists task_updates (
  id         bigint generated always as identity primary key,
  task_id    bigint references tasks(id) on delete cascade,
  date       text not null,
  text       text not null,
  created_at timestamptz default now()
);

-- Auto-update updated_at on tasks
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_updated_at
  before update on tasks
  for each row execute function update_updated_at();

-- Enable Row Level Security (open read/write for now — lock down later)
alter table tasks enable row level security;
alter table task_updates enable row level security;

create policy "Allow all" on tasks for all using (true) with check (true);
create policy "Allow all" on task_updates for all using (true) with check (true);

-- ============================================================
-- Seed data — KISCOL tasks from WK-15 pending list
-- ============================================================

insert into tasks (sno, date, company, category, particulars, responsible, payment, status, status_wk, hk_comment) values
(1, '5-Feb-26',  'KISCOL', 'Other',      'Land Khadja Pasteris',       'Sabina',      'Non-Payment', 'pending-discussion', 'Sabina spoke to Khadija and updated her pending list. Pending discussion with Harshil.', ''),
(2, '25-Feb-26', 'KISCOL', 'Other',      'AZIZA Mohamed (WRA)',         'Eng. Suresh', 'Non-Payment', 'expired',            'All permits are expired and reconciling all for the discussion.', ''),
(3, '10-Mar-26', 'KISCOL', 'Legal',      'Mrima Hills Mineral Rights',  'Harshil',     'Non-Payment', 'in-review',          'CM Advocates reviewing draft. Expected response by end of week.', 'Awaiting CM Advocates opinion on mineral rights clause.'),
(4, '15-Apr-26', 'KISCOL', 'Operations', 'Drone NDVI Survey – Season 2','Eng. Suresh', 'Payment',     'action-required',    'Awaiting Pedro to confirm invoice. Flight window closing 28 Apr.', 'Pedro to confirm drone contractor invoice before mobilisation.');

insert into task_updates (task_id, date, text) values
(1, '05/02/26', 'Was in Kwale today for work done & met the Surveyor; the adjudication & settlement team from Nairobi will be at Miji Kenda ranch next week Wednesday.'),
(1, '27/11/25', 'Following up on contract regarding Niobium o Mrima hills and requested will start the work on Sunday.'),
(1, '08/10/25', 'Shared a brief report following her meeting.'),
(1, '16/09/25', 'Khadija to share the title deed copies for the 2,600 acres in Kasemeni and feedback regarding the 30K per acre proposal.'),
(2, '25/02/26', 'Authorization for the borehole for account Number WRA/30/MSA/3K/10149/G has expired — you are hereby required to apply for a permit for the same.'),
(3, '12/03/26', 'Draft agreement received from County Lands office. Awaiting KISCOL legal review before signature.'),
(3, '10/03/26', 'Initial meeting with Ministry of Mining officials concluded; terms under negotiation.'),
(4, '15/04/26', 'Phase 2 NDVI mission scheduled for 20,000 acres in Sector B. Pilot team confirmed.');
