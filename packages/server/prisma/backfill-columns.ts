// One-off data migration for teams created before the Take/Testing/Fail
// column hierarchy existed. Safe to re-run: every step checks what's already
// there before creating anything (idempotent).
//
// Run with: npx tsx prisma/backfill-columns.ts
import { PrismaClient, ColumnType } from "@prisma/client";

const prisma = new PrismaClient();

const NAME_TO_TYPE: Record<string, ColumnType> = {
  "To Do": "TODO",
  "Take": "TAKE",
  "In Progress": "IN_PROGRESS",
  "Done": "DONE",
  "Testing": "TESTING",
  "Fail": "FAIL",
};

async function main() {
  const teams = await prisma.team.findMany({ include: { columns: true } });

  for (const team of teams) {
    // 1. Backfill `type` on existing columns by name match (anything else
    // stays the schema default CUSTOM).
    for (const column of team.columns) {
      const inferred = NAME_TO_TYPE[column.name];
      if (inferred && column.type === "CUSTOM") {
        await prisma.column.update({ where: { id: column.id }, data: { type: inferred } });
        column.type = inferred;
      }
    }

    const topLevel = team.columns.filter((c) => !c.parentId);
    const byType = (t: ColumnType) => topLevel.find((c) => c.type === t);

    // 2. Insert a Take column right after To Do if missing.
    let take = byType("TAKE");
    if (!take) {
      const todo = byType("TODO");
      const afterOrder = todo?.order ?? -1;
      await prisma.$transaction(async (tx) => {
        // shift everything after To Do one slot to the right
        await tx.column.updateMany({
          where: { teamId: team.id, parentId: null, order: { gt: afterOrder } },
          data: { order: { increment: 1 } },
        });
        take = await tx.column.create({
          data: { teamId: team.id, name: "Take", type: "TAKE", order: afterOrder + 1, parentId: null },
        });
      });
      console.log(`[${team.name}] created Take column`);
    }

    // 3. Ensure In Progress has a Testing child.
    const inProgress = byType("IN_PROGRESS");
    if (inProgress) {
      const hasTesting = await prisma.column.findFirst({
        where: { parentId: inProgress.id, type: "TESTING" },
      });
      if (!hasTesting) {
        await prisma.column.create({
          data: { teamId: team.id, name: "Testing", type: "TESTING", order: 0, parentId: inProgress.id },
        });
        console.log(`[${team.name}] created Testing column under In Progress`);
      }
    } else {
      console.warn(`[${team.name}] no In Progress column found — skipping Testing backfill`);
    }

    // 4. Ensure Done has a Fail child.
    const done = byType("DONE");
    if (done) {
      const hasFail = await prisma.column.findFirst({
        where: { parentId: done.id, type: "FAIL" },
      });
      if (!hasFail) {
        await prisma.column.create({
          data: { teamId: team.id, name: "Fail", type: "FAIL", order: 0, parentId: done.id },
        });
        console.log(`[${team.name}] created Fail column under Done`);
      }
    } else {
      console.warn(`[${team.name}] no Done column found — skipping Fail backfill`);
    }
  }

  console.log(`Backfill complete for ${teams.length} team(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
