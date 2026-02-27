export default async function handler(req: any, res: any) {
  try {
    const dbUrl = process.env.DATABASE_URL;
    const hasDb = !!dbUrl;

    return res.status(200).json({
      hasDatabase: hasDb,
      dbUrlLength: dbUrl ? dbUrl.length : 0,
      nodeEnv: process.env.NODE_ENV,
      timestamp: Date.now()
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}
