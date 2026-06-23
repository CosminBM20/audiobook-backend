-- ============================================================================
-- Enable Row Level Security (RLS) on every table in the public schema.
--
-- Why: Supabase automatically exposes a public PostgREST REST API
-- (https://<project>.supabase.co/rest/v1/<table>) for every table, gated only
-- by the project's `anon`/`authenticated` key — regardless of whether the
-- application uses supabase-js. This application never uses that API; all
-- access goes through this Express backend, which connects as the `postgres`
-- superuser via DATABASE_URL. Superusers and table owners bypass RLS
-- unconditionally, so enabling RLS here has NO effect on the backend's own
-- queries — it only closes the latent PostgREST attack surface.
--
-- No policies are defined intentionally: with RLS enabled and zero policies,
-- Postgres denies all access to any non-owner/non-bypass role (i.e. the
-- `anon`/`authenticated` roles PostgREST uses), which is exactly the desired
-- "deny by default" outcome since this app does not use Supabase Auth.
--
-- Idempotent — safe to run repeatedly.
--
-- Apply with:
--   npx prisma db execute --file prisma/sql/002_enable_rls.sql --schema prisma/schema.prisma
-- ============================================================================

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Author" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Audiobook" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Chapter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Favorite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ListeningProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PersonalBook" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bookmark" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ListenLater" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PersonalBookProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PersonalBookBookmark" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Challenge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserChallenge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserStreak" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
