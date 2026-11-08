// POST /api/script  { prompt }  -> { text }
const hits = new Map(); // simple per-IP daily limit (resets when the function restarts)
const DAILY_LIMIT = 150; // calls per IP per day; one long script uses many calls

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || 'x';
  const day = new Date().toISOString().slice(0, 10);
  const key = ip + day;
  const n = (hits.get(key) || 0) + 1;
  hits.set(key, n);
  if (n > DAILY_LIMIT) return res.status(429).json({ error: 'Daily free limit reached. Come back tomorrow!' });

  const prompt = String((req.body || {}).prompt || '').slice(0, 6000);
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5',
      max_tokens: 4096,
      system: 'You are a world-class scriptwriter for video creators. Write vivid, well-paced, original spoken narration with a strong hook, clear structure and no filler.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const d = await r.json();
  if (!r.ok) return res.status(502).json({ error: d.error?.message || 'AI error' });
  res.json({ text: d.content.map(c => c.text || '').join('') });
};
