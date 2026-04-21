import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LOCAL_MONGO_PORT = 27018;
const LOCAL_MONGO_HOST = "127.0.0.1";
const LOCAL_REPLICA_SET = "rs0";
const STARTUP_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 750;

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(currentDir, "..");
const localMongoDir = path.resolve(serverRoot, "prisma", "mongo-rs");
const localMongoDataDir = path.join(localMongoDir, "data");
const localMongoLogPath = path.join(localMongoDir, "mongod.log");

const getLocalMongoUri = () => `mongodb://${LOCAL_MONGO_HOST}:${LOCAL_MONGO_PORT}/zomato?replicaSet=${LOCAL_REPLICA_SET}`;

const sleep = (durationMs: number) => new Promise((resolve) => setTimeout(resolve, durationMs));

const isPortListening = (host: string, port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port });

    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });

    socket.once("error", () => {
      resolve(false);
    });
  });

const waitForPort = async (host: string, port: number, timeoutMs: number) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isPortListening(host, port)) {
      return;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`Timed out waiting for MongoDB to listen on ${host}:${port}`);
};

const getManagedMongoTarget = (databaseUrl: string | undefined) => {
  if (!databaseUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(databaseUrl);
    const parsedPort = Number(parsedUrl.port || "27017");
    const replicaSet = parsedUrl.searchParams.get("replicaSet");
    const isLocalHost = parsedUrl.hostname === "127.0.0.1" || parsedUrl.hostname === "localhost";

    if (
      (parsedUrl.protocol === "mongodb:" || parsedUrl.protocol === "mongodb+srv:") &&
      isLocalHost &&
      parsedPort === LOCAL_MONGO_PORT &&
      replicaSet === LOCAL_REPLICA_SET
    ) {
      return {
        host: parsedUrl.hostname,
        port: parsedPort,
      };
    }
  } catch {
    return null;
  }

  return null;
};

const mongodCommand = process.platform === "win32" ? "mongod.exe" : "mongod";
const mongoshCommand = process.platform === "win32" ? "mongosh.exe" : "mongosh";

const runMongosh = (script: string) =>
  spawnSync(
    mongoshCommand,
    ["--quiet", "--host", LOCAL_MONGO_HOST, "--port", String(LOCAL_MONGO_PORT), "--eval", script],
    {
      encoding: "utf8",
      windowsHide: true,
    },
  );

const getLogTail = async (logPath: string, lineCount = 25) => {
  try {
    const content = await fs.readFile(logPath, "utf8");
    return content.split(/\r?\n/).filter(Boolean).slice(-lineCount).join("\n");
  } catch {
    return "";
  }
};

const ensureReplicaSetInitialized = () => {
  const result = runMongosh(`
    try {
      rs.status();
    } catch (error) {
      if (error.codeName !== "NotYetInitialized") {
        throw error;
      }
      rs.initiate({
        _id: "${LOCAL_REPLICA_SET}",
        members: [{ _id: 0, host: "${LOCAL_MONGO_HOST}:${LOCAL_MONGO_PORT}" }],
      });
    }
  `);

  if (result.status === 0) {
    return;
  }

  throw new Error(
    [
      "MongoDB is listening on 27018, but the local replica set could not be initialized.",
      result.stderr?.trim() || result.stdout?.trim() || "mongosh did not return an error message.",
    ].join("\n"),
  );
};

const waitForPrimary = async () => {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const result = runMongosh(`
      const hello = db.hello();
      if (!hello.setName) {
        throw new Error("Replica set is not initialized");
      }
      if (!hello.isWritablePrimary) {
        throw new Error("Replica set primary is not ready");
      }
    `);

    if (result.status === 0) {
      return;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error("Timed out waiting for the local MongoDB replica set to elect a PRIMARY");
};

const startLocalMongo = async () => {
  await fs.mkdir(localMongoDataDir, { recursive: true });
  await fs.mkdir(localMongoDir, { recursive: true });

  const child = spawn(
    mongodCommand,
    [
      "--dbpath",
      localMongoDataDir,
      "--replSet",
      LOCAL_REPLICA_SET,
      "--bind_ip",
      LOCAL_MONGO_HOST,
      "--port",
      String(LOCAL_MONGO_PORT),
      "--logpath",
      localMongoLogPath,
      "--logappend",
    ],
    {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    },
  );

  child.unref();

  try {
    await waitForPort(LOCAL_MONGO_HOST, LOCAL_MONGO_PORT, STARTUP_TIMEOUT_MS);
  } catch (error) {
    const logTail = await getLogTail(localMongoLogPath);
    throw new Error(
      [
        error instanceof Error ? error.message : "MongoDB did not start",
        logTail ? `Recent ${path.basename(localMongoLogPath)} output:\n${logTail}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
  }
};

const ensureMongoToolsAvailable = () => {
  const mongodCheck = spawnSync(mongodCommand, ["--version"], {
    encoding: "utf8",
    windowsHide: true,
  });

  if (mongodCheck.status !== 0) {
    throw new Error(
      "The local dev database is configured for a repo-scoped MongoDB replica set on port 27018, but `mongod` was not found on PATH.",
    );
  }

  const mongoshCheck = spawnSync(mongoshCommand, ["--version"], {
    encoding: "utf8",
    windowsHide: true,
  });

  if (mongoshCheck.status !== 0) {
    throw new Error(
      "The local dev database is configured for a repo-scoped MongoDB replica set on port 27018, but `mongosh` was not found on PATH.",
    );
  }
};

const main = async () => {
  const managedMongoTarget = getManagedMongoTarget(process.env.DATABASE_URL);

  if (!managedMongoTarget) {
    console.log("[mongo:ensure] Skipping local MongoDB bootstrap because DATABASE_URL is not the repo-scoped 27018 replica set.");
    return;
  }

  ensureMongoToolsAvailable();

  if (!(await isPortListening(LOCAL_MONGO_HOST, LOCAL_MONGO_PORT))) {
    console.log(`[mongo:ensure] Starting repo-scoped MongoDB replica set on ${LOCAL_MONGO_HOST}:${LOCAL_MONGO_PORT}...`);
    await startLocalMongo();
  } else {
    console.log(`[mongo:ensure] MongoDB is already listening on ${LOCAL_MONGO_HOST}:${LOCAL_MONGO_PORT}.`);
  }

  ensureReplicaSetInitialized();
  await waitForPrimary();

  console.log(`[mongo:ensure] Local MongoDB replica set is ready at ${getLocalMongoUri()}.`);
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Failed to ensure local MongoDB availability";
  console.error(`[mongo:ensure] ${message}`);
  process.exit(1);
});
