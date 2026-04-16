import "dotenv/config";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { defineConfig } from "prisma/config";

const configDir = path.dirname(fileURLToPath(import.meta.url));

const resolveDatabaseUrl = (databaseUrl: string) => {
  if (!databaseUrl.startsWith("file:./")) {
    return databaseUrl;
  }

  const relativePath = databaseUrl.slice("file:./".length);
  const absolutePath = path.resolve(configDir, "prisma", relativePath);
  return pathToFileURL(absolutePath).toString();
};

export default defineConfig({
  experimental: {
    adapter: true,
  },
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "./prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  engine: "js",
  // The libSQL adapter is the runtime datasource source for this SQLite setup.
  // `schema.prisma` still keeps DATABASE_URL for Prisma schema validation and tooling.
  adapter: async () =>
    new PrismaLibSQL({
      url: resolveDatabaseUrl(process.env.DATABASE_URL ?? "file:./dev.db"),
    }),
});
