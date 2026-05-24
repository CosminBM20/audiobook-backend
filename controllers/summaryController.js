const MAX_CHARS = 12_000;

exports.summarize = async (req, res) => {
  const { content } = req.body;

  if (!content || typeof content !== 'string' || content.trim().length < 50) {
    return res.status(400).json({ success: false, message: 'Conținut insuficient pentru rezumat.' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ success: false, message: 'Serviciul de rezumare nu este configurat.' });
  }

  const truncated = content.slice(0, MAX_CHARS);

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content:
              'Ești un asistent care creează rezumate concise și clare. ' +
              'Răspunde întotdeauna în aceeași limbă ca textul primit. ' +
              'Rezumatul trebuie să aibă 4-6 propoziții și să surprindă ideile principale.',
          },
          {
            role: 'user',
            content: `Rezumă următorul text:\n\n${truncated}`,
          },
        ],
        max_tokens:  400,
        temperature: 0.3,
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error('Groq API error:', err);
      return res.status(502).json({ success: false, message: 'Eroare la serviciul de rezumare.' });
    }

    const data    = await groqRes.json();
    const summary = data.choices?.[0]?.message?.content?.trim();

    if (!summary) {
      return res.status(502).json({ success: false, message: 'Răspuns invalid de la serviciul de rezumare.' });
    }

    res.json({ success: true, summary });
  } catch (err) {
    console.error('summarize error:', err);
    res.status(500).json({ success: false, message: 'Eroare internă la rezumare.' });
  }
};
