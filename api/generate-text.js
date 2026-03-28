import { GoogleGenerativeAI } from '@google/generative-ai';
import { neon } from '@neondatabase/serverless';

function buildPrompt(topic, phase) {
  return `You are an English reading trainer creating content for Japanese learners who want to improve their reading speed.

Requirements:
- Topic: ${topic || 'a recent trend in technology, science, business, or society'}
- Length: approximately 300 words
- Level: intermediate (TOEIC 700-800 level vocabulary)
- Style: informative article, similar to The Economist or BBC News

Slashing rules:
- Place " / " (space-slash-space) between natural sense groups
- Each chunk should be 3-7 words
- Slash at subject/verb boundaries, after adverbial phrases, at conjunctions

Quiz rules:
- 4 questions in Japanese testing key comprehension points
- Each question has exactly 4 options (A/B/C/D)
- "correct" is the 0-based index of the correct answer
- Questions should test understanding, not just surface recall

Return ONLY a JSON object (no markdown, no code blocks) with this exact structure:
{
  "title": "Article title in English",
  "topic": "Topic label in English (2-4 words)",
  "word_count": <integer>,
  "plain_text": "Full article without slashes",
  "slashed_text": "Article with / between chunks",
  "quiz": [
    {"q": "Japanese question", "opts": ["option A", "option B", "option C", "option D"], "correct": 0},
    {"q": "Japanese question", "opts": ["option A", "option B", "option C", "option D"], "correct": 1},
    {"q": "Japanese question", "opts": ["option A", "option B", "option C", "option D"], "correct": 2},
    {"q": "Japanese question", "opts": ["option A", "option B", "option C", "option D"], "correct": 3}
  ]
}

Phase context for instruction style: ${phase || '1ヶ月目: スラッシュリーディング'}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { topic, phase } = req.body || {};

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const result = await model.generateContent(buildPrompt(topic, phase));
    const responseText = result.response.text();

    // Extract JSON even if wrapped in code blocks
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No valid JSON in Gemini response');
    const generated = JSON.parse(jsonMatch[0]);

    // Validate required fields
    const required = ['title', 'topic', 'plain_text', 'slashed_text', 'quiz'];
    for (const field of required) {
      if (!generated[field]) throw new Error(`Missing field: ${field}`);
    }
    if (!Array.isArray(generated.quiz) || generated.quiz.length !== 4) {
      throw new Error('Quiz must have exactly 4 questions');
    }

    // Save to DB
    const sql = neon(process.env.DATABASE_URL);
    const [row] = await sql`
      INSERT INTO texts (topic, title, word_count, difficulty, plain_text, slashed_text, quiz_json, phase)
      VALUES (${generated.topic}, ${generated.title}, ${generated.word_count || 300},
              'intermediate', ${generated.plain_text}, ${generated.slashed_text},
              ${JSON.stringify(generated.quiz)}, ${phase || null})
      RETURNING *
    `;

    return res.status(201).json({ text: row });

  } catch (err) {
    console.error('generate-text error:', err);
    return res.status(500).json({ error: 'Generation failed', detail: err.message });
  }
}
