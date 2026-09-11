// One-off migration step: copies every User's current (teamId, role) into a
// TeamMembership row before the next migration drops those columns from
// User. Safe to re-run (skips a user who already has a membership for that
// team). Run with: npx tsx prisma/backfill-team-memberships.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  let created = 0;

  for (const user of users) {
    const existing = await prisma.teamMembership.findUnique({
      where: { userId_teamId: { userId: user.id, teamId: user.teamId } },
    });
    if (existing) continue;

    await prisma.teamMembership.create({
      data: { userId: user.id, teamId: user.teamId, role: user.role },
    });
    created++;
  }

  console.log(`Backfill complete: ${created} membership(s) created for ${users.length} user(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
