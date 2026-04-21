import "dotenv/config";
import { Role } from "../src/constants/enums.js";
import { createPrismaClient } from "../src/lib/prisma-client.js";

const prisma = createPrismaClient({
  log: ["warn", "error"],
});

const LEGACY_ROLE = "OPERATIONS_MANAGER";
const TARGET_ROLE = Role.REGIONAL_MANAGER;

async function main() {
  const [usersBefore, approvalRequestsBefore] = await Promise.all([
    prisma.user.count({
      where: {
        role: LEGACY_ROLE,
      },
    }),
    prisma.approvalRequest.count({
      where: {
        requesterRole: LEGACY_ROLE,
      },
    }),
  ]);

  const [usersResult, approvalRequestsResult] = await Promise.all([
    prisma.user.updateMany({
      where: {
        role: LEGACY_ROLE,
      },
      data: {
        role: TARGET_ROLE,
      },
    }),
    prisma.approvalRequest.updateMany({
      where: {
        requesterRole: LEGACY_ROLE,
      },
      data: {
        requesterRole: TARGET_ROLE,
      },
    }),
  ]);

  const [usersAfter, approvalRequestsAfter] = await Promise.all([
    prisma.user.count({
      where: {
        role: LEGACY_ROLE,
      },
    }),
    prisma.approvalRequest.count({
      where: {
        requesterRole: LEGACY_ROLE,
      },
    }),
  ]);

  console.log(
    JSON.stringify(
      {
        legacyRole: LEGACY_ROLE,
        targetRole: TARGET_ROLE,
        users: {
          before: usersBefore,
          updated: usersResult.count,
          remainingLegacy: usersAfter,
        },
        approvalRequests: {
          before: approvalRequestsBefore,
          updated: approvalRequestsResult.count,
          remainingLegacy: approvalRequestsAfter,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Operations Manager role migration failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
