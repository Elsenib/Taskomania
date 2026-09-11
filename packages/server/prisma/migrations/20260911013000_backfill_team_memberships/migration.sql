-- Copies every User.(teamId, role) into a TeamMembership row before the next
-- migration drops those columns from User. Runs automatically as part of
-- `prisma migrate deploy` (see root package.json "start" script) — this is
-- what makes the User->TeamMembership move safe on Railway, where a manual
-- backfill script can't be run in between two migrations of one deploy.
-- Idempotent: ON CONFLICT DO NOTHING means it's harmless to re-run, and a
-- database with no rows in User.teamId (or none at all) just inserts nothing.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO "TeamMembership" ("id", "userId", "teamId", "role", "joinedAt", "lastActiveAt")
SELECT gen_random_uuid()::text, "id", "teamId", "role", "createdAt", "createdAt"
FROM "User"
WHERE "teamId" IS NOT NULL
ON CONFLICT ("userId", "teamId") DO NOTHING;
