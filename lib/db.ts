import { neon } from '@neondatabase/serverless';

export function getDb() {
  if (!process.env.DATABASE_URL) {
    console.log('DATABASE_URL not configured, returning null');
    return null; // 返回null表示数据库未配置
  }
  console.log('DATABASE_URL configured, creating neon client');
  return neon(process.env.DATABASE_URL);
}

export function isDatabaseConfigured() {
  const configured = !!process.env.DATABASE_URL;
  console.log('isDatabaseConfigured:', configured);
  return configured;
}
