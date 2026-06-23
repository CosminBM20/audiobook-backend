-- ============================================================================
-- Trigram (pg_trgm) GIN indexes to accelerate the case-insensitive substring
-- search added to GET /api/audiobooks (Prisma `contains` + `mode: insensitive`,
-- which compiles to ILIKE '%term%').
--
-- A plain B-tree index cannot serve a leading-wildcard ILIKE; a GIN index built
-- with the gin_trgm_ops operator class can. This turns the search from a
-- sequential scan into an index scan as the library grows.
--
-- Idempotent — safe to run repeatedly. The application works WITHOUT these
-- indexes (correctness is unaffected); they are a pure performance optimisation.
--
-- Apply with:
--   npx prisma db execute --file prisma/sql/001_search_trgm_indexes.sql --schema prisma/schema.prisma
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_audiobook_title_trgm
  ON "Audiobook" USING gin (lower(title) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_audiobook_description_trgm
  ON "Audiobook" USING gin (lower(description) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_author_name_trgm
  ON "Author" USING gin (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_category_name_trgm
  ON "Category" USING gin (lower(name) gin_trgm_ops);
