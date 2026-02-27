export default async function handler(req: any, res: any) {
  // 如果数据库未配置，返回空数据让前端使用localStorage
  const isDatabaseConfigured = !!process.env.DATABASE_URL;

  if (!isDatabaseConfigured) {
    if (req.method === 'GET') {
      return res.status(200).json([]);
    }
    if (req.method === 'POST' || req.method === 'DELETE') {
      return res.status(200).json({ success: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 只有在数据库配置后才导入和使用
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL!);

  try {
    if (req.method === 'GET') {
      // 获取所有用户
      const usersData = await sql`SELECT * FROM users ORDER BY created_at DESC`;

      // 转换字段名从 snake_case 到 camelCase
      const users = usersData.map((user: any) => ({
        id: user.id,
        username: user.username,
        password: user.password,
        role: user.role,
        position: user.position,
        createdAt: user.created_at
      }));

      return res.status(200).json(users);
    }

    if (req.method === 'POST') {
      // 创建新用户
      const { id, username, password, role, position, createdAt } = req.body;

      await sql`
        INSERT INTO users (id, username, password, role, position, created_at)
        VALUES (${id}, ${username}, ${password}, ${role}, ${position}, ${createdAt})
      `;

      return res.status(201).json({ success: true });
    }

    if (req.method === 'DELETE') {
      // 删除用户
      const { id } = req.query;

      await sql`DELETE FROM users WHERE id = ${id}`;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Users API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
