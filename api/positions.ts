import { getDb } from '../../lib/db';

export default async function handler(req: any, res: any) {
  const sql = getDb();

  try {
    if (req.method === 'GET') {
      // 获取所有职位
      const positions = await sql`SELECT * FROM positions ORDER BY created_at DESC`;
      return res.status(200).json(positions);
    }

    if (req.method === 'POST') {
      // 创建新职位
      const { id, name, createdAt } = req.body;

      await sql`
        INSERT INTO positions (id, name, created_at)
        VALUES (${id}, ${name}, ${createdAt})
      `;

      return res.status(201).json({ success: true });
    }

    if (req.method === 'PUT') {
      // 更新职位
      const { id, name } = req.body;

      await sql`
        UPDATE positions
        SET name = ${name}
        WHERE id = ${id}
      `;

      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      // 删除职位
      const { id } = req.query;

      await sql`DELETE FROM positions WHERE id = ${id}`;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Positions API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
