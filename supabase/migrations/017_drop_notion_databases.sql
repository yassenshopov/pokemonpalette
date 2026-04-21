-- Migration 017: drop unused users.notion_databases column.
--
-- Column was carried over from the original Notion-integrated template in
-- migration 001 but is never read or written anywhere in the app. Keeping it
-- around forced Prisma to SELECT it on every user query, which broke after
-- schema drift removed the column in one environment but not another.
--
-- Safe to drop: no app code references it, no indexes depend on it.

ALTER TABLE public.users
  DROP COLUMN IF EXISTS notion_databases;
