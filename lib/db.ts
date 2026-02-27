import { neon } from '@neondatabase/serverless';

export function getDb() {
  if (!process.env.DATABASE_URL) {
    return null; // 返回null表示数据库未配置
  }
  return neon(process.env.DATABASE_URL);
}

export function isDatabaseConfigured() {
  return !!process.env.DATABASE_URL;
}
