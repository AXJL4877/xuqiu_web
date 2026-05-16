import path from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/app/generated/prisma";

/** 解析 DATABASE_URL（file:），路径相对项目根目录（cwd） */
function sqliteFilePath(): string {
  const url = process.env.DATABASE_URL;
  if (url?.startsWith("file:")) {
    const rest = url.slice("file:".length);
    if (rest.startsWith("./")) {
      return path.resolve(
        /* turbopackIgnore: true */ process.cwd(),
        rest.slice(2),
      );
    }
    if (!path.isAbsolute(rest)) {
      return path.resolve(/* turbopackIgnore: true */ process.cwd(), rest);
    }
    return rest;
  }
  return path.join(/* turbopackIgnore: true */ process.cwd(), "prisma", "dev.db");
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  sqliteAdapter: PrismaBetterSqlite3;
};

function createPrisma(): PrismaClient {
  const adapter =
    globalForPrisma.sqliteAdapter ??
    new PrismaBetterSqlite3({ url: sqliteFilePath() });
  globalForPrisma.sqliteAdapter = adapter;
  return new PrismaClient({ adapter });
}

/** 开发热更新后 global 可能仍持有旧 Client（缺少新 model），需重建 */
function getPrisma(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && "aiProvider" in cached) {
    return cached;
  }
  const client = createPrisma();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

export const prisma = getPrisma();
