export default async function handler(req: any, res: any) {
  const isDatabaseConfigured = !!process.env.DATABASE_URL;

  if (!isDatabaseConfigured) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL!);

  try {
    // 1. 检查当前数据
    const users = await sql`
      SELECT id, username, created_at,
             CASE
               WHEN created_at IS NULL THEN 'NULL'
               WHEN created_at = 0 THEN 'ZERO'
               ELSE 'OK'
             END as status
      FROM users
    `;

    const positions = await sql`
      SELECT id, name, created_at,
             CASE
               WHEN created_at IS NULL THEN 'NULL'
               WHEN created_at = 0 THEN 'ZERO'
               ELSE 'OK'
             END as status
      FROM positions
    `;

    // 2. 修复NULL或0的created_at值
    const currentTimestamp = Date.now();

    await sql`
      UPDATE users
      SET created_at = ${currentTimestamp}
      WHERE created_at IS NULL OR created_at = 0
    `;

    await sql`
      UPDATE positions
      SET created_at = ${currentTimestamp}
      WHERE created_at IS NULL OR created_at = 0
    `;

    // 3. 获取修复后的数据
    const usersAfter = await sql`SELECT id, username, created_at FROM users`;
    const positionsAfter = await sql`SELECT id, name, created_at FROM positions`;

    return res.status(200).json({
      message: 'Date fields checked and fixed',
      before: {
        users,
        positions
      },
      after: {
        users: usersAfter,
        positions: positionsAfter
      }
    });
  } catch (error: any) {
    console.error('Fix dates error:', error);
    return res.status(500).json({ error: error.message });
  }
}
