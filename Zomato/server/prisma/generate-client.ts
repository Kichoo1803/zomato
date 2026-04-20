import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);

const workspaceRoot = process.cwd();
const prismaClientDir = path.join(workspaceRoot, "node_modules", ".prisma", "client");
const prismaClientEntryPath = path.join(prismaClientDir, "index.js");
const prismaClientSchemaPath = path.join(prismaClientDir, "schema.prisma");
const prismaClientEnginePath = path.join(prismaClientDir, "query_engine-windows.dll.node");
const prismaPackageEntryPath = path.join(workspaceRoot, "node_modules", "@prisma", "client", "index.js");
const sourceSchemaPath = path.join(workspaceRoot, "prisma", "schema.prisma");
const staleWindowsEnginePattern = /^query_engine-windows\.dll\.node\.tmp\d+$/i;
const shouldForceGenerate = process.argv.includes("--force");
const shouldCleanupOnly = process.argv.includes("--cleanup-only");
const isWindows = process.platform === "win32";

const normalizeFileContents = (value: string) => value.replace(/\r\n/g, "\n").trim();

const readFileIfPresent = async (filePath: string) => {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
};

const pathExists = async (targetPath: string) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const isSkippableWindowsCleanupError = (error: unknown) =>
  error instanceof Error &&
  /EPERM|EACCES|EBUSY/i.test(error.message);

const pruneStaleWindowsEngineTemps = async () => {
  if (!isWindows) {
    return 0;
  }

  let removedCount = 0;

  try {
    const entries = await fs.readdir(prismaClientDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !staleWindowsEnginePattern.test(entry.name)) {
        continue;
      }

      const targetPath = path.join(prismaClientDir, entry.name);

      try {
        await fs.rm(targetPath, { force: true });
        removedCount += 1;
      } catch (error) {
        if (!isSkippableWindowsCleanupError(error)) {
          throw error;
        }
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return removedCount;
};

const prismaClientIsCurrent = async () => {
  const [sourceSchema, generatedSchema, prismaPackageEntryExists, prismaClientEntryExists, prismaEngineExists] =
    await Promise.all([
      readFileIfPresent(sourceSchemaPath),
      readFileIfPresent(prismaClientSchemaPath),
      pathExists(prismaPackageEntryPath),
      pathExists(prismaClientEntryPath),
      isWindows ? pathExists(prismaClientEnginePath) : Promise.resolve(true),
    ]);

  if (!sourceSchema || !generatedSchema || !prismaPackageEntryExists || !prismaClientEntryExists || !prismaEngineExists) {
    return false;
  }

  return normalizeFileContents(sourceSchema) === normalizeFileContents(generatedSchema);
};

const runPrismaGenerate = () => {
  const prismaCliPath = require.resolve("prisma/build/index.js");
  const result = spawnSync(process.execPath, [prismaCliPath, "generate"], {
    cwd: workspaceRoot,
    env: process.env,
    encoding: "utf8",
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.status === 0) {
    return;
  }

  const combinedOutput = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

  if (isWindows && combinedOutput.includes("EPERM: operation not permitted, rename")) {
    process.stderr.write(
      [
        "",
        "Prisma Client generation hit a Windows file lock while replacing `query_engine-windows.dll.node`.",
        "Stop any running Zomato Luxe server, `tsx watch` process, Prisma Studio session, or other Node process using this workspace, then rerun `npm run prisma:generate -w server`.",
        "If an earlier generate attempt left temporary engine files behind, run `npm run prisma:cleanup:generated -w server` before retrying.",
        "",
      ].join("\n"),
    );
  }

  process.exit(result.status ?? 1);
};

const main = async () => {
  const removedTempFiles = await pruneStaleWindowsEngineTemps();

  if (removedTempFiles > 0) {
    console.log(`Removed ${removedTempFiles} stale Prisma engine temp file(s).`);
  }

  if (shouldCleanupOnly) {
    console.log("Prisma generated-client cleanup completed.");
    return;
  }

  if (!shouldForceGenerate && (await prismaClientIsCurrent())) {
    console.log("Prisma Client is already up to date. Skipping generate.");
    return;
  }

  runPrismaGenerate();
};

main().catch((error) => {
  console.error("Prisma Client generate helper failed.", error);
  process.exit(1);
});
