-- Add branch-era authentication columns while preserving the legacy location
-- columns used by the currently deployed database. The audit confirms every
-- referenced location ID already matches an existing branch ID.
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "defaultBranchId" TEXT;

ALTER TABLE "sessions"
ADD COLUMN IF NOT EXISTS "activeBranchId" TEXT;

ALTER TABLE "user_branches"
ADD COLUMN IF NOT EXISTS "branchId" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'defaultLocationId'
  ) THEN
    EXECUTE '
      UPDATE "users"
      SET "defaultBranchId" = "defaultLocationId"
      WHERE "defaultBranchId" IS NULL
        AND "defaultLocationId" IS NOT NULL
    ';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sessions'
      AND column_name = 'activeLocationId'
  ) THEN
    EXECUTE '
      UPDATE "sessions"
      SET "activeBranchId" = "activeLocationId"
      WHERE "activeBranchId" IS NULL
        AND "activeLocationId" IS NOT NULL
    ';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_branches'
      AND column_name = 'locationId'
  ) THEN
    EXECUTE '
      UPDATE "user_branches"
      SET "branchId" = "locationId"
      WHERE "branchId" IS NULL
        AND "locationId" IS NOT NULL
    ';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_defaultBranchId_fkey'
  ) THEN
    ALTER TABLE "users"
    ADD CONSTRAINT "users_defaultBranchId_fkey"
    FOREIGN KEY ("defaultBranchId") REFERENCES "branches"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sessions_activeBranchId_fkey'
  ) THEN
    ALTER TABLE "sessions"
    ADD CONSTRAINT "sessions_activeBranchId_fkey"
    FOREIGN KEY ("activeBranchId") REFERENCES "branches"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_branches_branchId_fkey'
  ) THEN
    ALTER TABLE "user_branches"
    ADD CONSTRAINT "user_branches_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "user_branches_branchId_idx"
ON "user_branches"("branchId");

CREATE UNIQUE INDEX IF NOT EXISTS "user_branches_userId_branchId_key"
ON "user_branches"("userId", "branchId");
