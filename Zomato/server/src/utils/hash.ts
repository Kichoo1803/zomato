import crypto from "node:crypto";

export const hashValue = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");
