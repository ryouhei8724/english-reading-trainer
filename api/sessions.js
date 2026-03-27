import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  if (req.method === 'GET') {
    try {
      const rows = await sql`
        SELECT s.*, t.title as text_title, t.topic, t.word_count
        FROM sessions s
        LEFT JOIN texts t ON s.text_id = t.id
        ORDER BY s.date DESC, s.created_at DESC
      `;
      return res.status(200).json({ sessions: rows });
    } catch (err) {
      return res.status(500).json({ error: 'DB error', detail: err.message });
    }
  }

  if (req.method === 'POST') {
    const { text_id, date, wpm, comprehension_score, reading_time_seconds, phase, notes } = req.body;
    if (!date || !wpm) {
      return res.status(400).json({ error: 'date and wpm are required' });
    }
    try {
      const [row] = await sql`
        INSERT INTO sessions (text_id, date, wpm, comprehension_score, reading_time_seconds, phase, notes)
        VALUES (${text_id || null}, ${date}, ${wpm}, ${comprehension_score || null},
                ${reading_time_seconds || null}, ${phase || null}, ${notes || null})
        RETURNING *
      `;
      return res.status(201).json({ session: row });
    } catch (err) {
      return res.status(500).json({ error: 'DB error', detail: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
