import fs from "node:fs";
import path from "node:path";
import type { Request } from "express";

export const UPLOADS_ROOT_DIR = path.resolve(process.cwd(), "uploads");

const ensureDirectory = (directoryPath: string) => {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
};

ensureDirectory(UPLOADS_ROOT_DIR);

export const ensureUploadSubdirectory = (...segments: string[]) => {
  const directoryPath = path.join(UPLOADS_ROOT_DIR, ...segments);
  ensureDirectory(directoryPath);
  return directoryPath;
};

const normalizePathSegment = (value: string) => value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

export const buildPublicUploadPath = (...segments: string[]) => {
  const normalizedSegments = segments.map(normalizePathSegment).filter(Boolean);
  return `/${["uploads", ...normalizedSegments].join("/")}`;
};

export const buildPublicUploadUrl = (baseUrl: string, ...segments: string[]) =>
  new URL(buildPublicUploadPath(...segments), baseUrl).toString();

export const getRequestBaseUrl = (req: Pick<Request, "protocol" | "get">) =>
  `${req.protocol}://${req.get("host")}`;

export const flattenUploadedFiles = (
  files?: Express.Multer.File[] | Record<string, Express.Multer.File[] | undefined>,
) => {
  if (!files) {
    return [] as Express.Multer.File[];
  }

  if (Array.isArray(files)) {
    return files;
  }

  return Object.values(files)
    .flatMap((group) => group ?? [])
    .filter((file): file is Express.Multer.File => Boolean(file?.path));
};

export const cleanupUploadedFiles = async (
  files?: Express.Multer.File[] | Record<string, Express.Multer.File[] | undefined>,
) => {
  const uploadedFiles = flattenUploadedFiles(files);

  await Promise.allSettled(
    uploadedFiles.map((file) =>
      fs.promises.unlink(file.path).catch(() => undefined),
    ),
  );
};
