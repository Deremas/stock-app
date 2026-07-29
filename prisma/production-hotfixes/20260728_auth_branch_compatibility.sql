-- Add the branch-based authentication columns expected by the current app.
-- Legacy location columns are preserved so this change is additive.
BEGIN;

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "defaultBranchId" TEXT;

UPDATE "users" app_user
SET "defaultBranchId" = app_user."defaultLocationId"
WHERE app_user."defaultBranchId" IS NULL
  AND app_user."defaultLocationId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "branches" branch
    WHERE branch."id" = app_user."defaultLocationId"
  );

ALTER TABLE "sessions"
ADD COLUMN IF NOT EXISTS "activeBranchId" TEXT;

UPDATE "sessions" session_row
SET "activeBranchId" = session_row."activeLocationId"
WHERE session_row."activeBranchId" IS NULL
  AND session_row."activeLocationId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "branches" branch
    WHERE branch."id" = session_row."activeLocationId"
  );

ALTER TABLE "user_branches"
ADD COLUMN IF NOT EXISTS "branchId" TEXT;

UPDATE "user_branches" assignment
SET "branchId" = assignment."locationId"
WHERE assignment."branchId" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "branches" branch
    WHERE branch."id" = assignment."locationId"
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "user_branches"
    WHERE "branchId" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot bridge user_branches: one or more locationId values do not match a branch.';
  END IF;
END
$$;

ALTER TABLE "user_branches"
ALTER COLUMN "branchId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "user_branches_userId_branchId_key"
ON "user_branches"("userId", "branchId");

CREATE INDEX IF NOT EXISTS "user_branches_branchId_idx"
ON "user_branches"("branchId");

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

COMMIT;
