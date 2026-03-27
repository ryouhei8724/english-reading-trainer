import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  if (req.method === 'GET') {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    try {
      const rows = await sql`
        SELECT id, topic, title, word_count, difficulty,
               plain_text, slashed_text, quiz_json, phase, created_at
        FROM texts
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return res.status(200).json({ texts: rows });
    } catch (err) {
      return res.status(500).json({ error: 'DB error', detail: err.message });
    }
  }

  if (req.method === 'POST') {
    const { topic, title, word_count, difficulty, plain_text, slashed_text, quiz_json, phase } = req.body;
    if (!topic || !title || !plain_text || !slashed_text || !quiz_json) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
      const [row] = await sql`
        INSERT INTO texts (topic, title, word_count, difficulty, plain_text, slashed_text, quiz_json, phase)
        VALUES (${topic}, ${title}, ${word_count || 300}, ${difficulty || 'intermediate'},
                ${plain_text}, ${slashed_text}, ${JSON.stringify(quiz_json)}, ${phase || null})
        RETURNING *
      `;
      return res.status(201).json({ text: row });
    } catch (err) {
      return res.status(500).json({ error: 'DB error', detail: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
