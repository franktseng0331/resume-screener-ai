export default async function handler(req: any, res: any) {
  // 如果数据库未配置，返回空数据让前端使用localStorage
  const isDatabaseConfigured = !!process.env.DATABASE_URL;

  if (!isDatabaseConfigured) {
    if (req.method === 'GET') {
      return res.status(200).json([]);
    }
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
      return res.status(200).json({ success: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 只有在数据库配置后才导入和使用
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL!);

  try {
    if (req.method === 'GET') {
      // 获取历史记录
      const records = await sql`
        SELECT * FROM history_records
        ORDER BY timestamp DESC
        LIMIT 50
      `;

      // 转换 JSONB 字段
      const formattedRecords = records.map((record: any) => ({
        ...record,
        jobDescription: record.job_description,
        specialRequirements: record.special_requirements,
        assignedTo: record.assigned_to,
        createdBy: record.created_by
      }));

      return res.status(200).json(formattedRecords);
    }

    if (req.method === 'POST') {
      // 创建新记录
      const {
        id,
        timestamp,
        positionName,
        jobDescription,
        specialRequirements,
        results,
        assignedTo,
        createdBy
      } = req.body;

      await sql`
        INSERT INTO history_records (
          id, timestamp, position_name, job_description,
          special_requirements, results, assigned_to, created_by
        )
        VALUES (
          ${id}, ${timestamp}, ${positionName}, ${jobDescription},
          ${specialRequirements || ''}, ${JSON.stringify(results)},
          ${assignedTo || null}, ${createdBy || null}
        )
      `;

      return res.status(201).json({ success: true });
    }

    if (req.method === 'PUT') {
      // 更新记录（流转）
      const { id, assignedTo } = req.body;

      await sql`
        UPDATE history_records
        SET assigned_to = ${assignedTo}
        WHERE id = ${id}
      `;

      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      // 删除记录
      const { id } = req.query;

      await sql`DELETE FROM history_records WHERE id = ${id}`;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('History API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
