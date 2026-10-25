import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const PORT = 3000;

function getGenAIClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY' || key.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Check AI availability
  app.get('/api/ai/status', (_req, res) => {
    const client = getGenAIClient();
    res.json({ available: Boolean(client) });
  });

  // 1. Semantic similarity between two complaint descriptions (Redacted text only)
  app.post('/api/ai/similarity', async (req, res) => {
    const client = getGenAIClient();
    if (!client) {
      return res.json({ fallback: true, reason: 'GEMINI_API_KEY not configured' });
    }
    try {
      const { descriptionA, descriptionB } = req.body;
      const response = await client.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Compare these two redacted institutional complaint descriptions submitted to AICTE and determine if they refer to the same underlying issue or institutional grievance.
Complaint A: "${descriptionA}"
Complaint B: "${descriptionB}"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sameUnderlyingIssue: { type: Type.BOOLEAN },
              similarity: { type: Type.NUMBER, description: 'Score from 0.0 to 1.0' },
              explanation: { type: Type.STRING },
            },
            required: ['sameUnderlyingIssue', 'similarity', 'explanation'],
          },
        },
      });
      const text = response.text || '{}';
      const parsed = JSON.parse(text);
      return res.json({ fallback: false, data: parsed });
    } catch (error) {
      return res.json({ fallback: true, reason: error instanceof Error ? error.message : 'AI error' });
    }
  });

  // 2. Summarize case action history into 5 bullets + recommended next step
  app.post('/api/ai/case-summary', async (req, res) => {
    const client = getGenAIClient();
    if (!client) {
      return res.json({ fallback: true, reason: 'GEMINI_API_KEY not configured' });
    }
    try {
      const { category, status, currentBureau, redactedDescription, timelineSummary } = req.body;
      const response = await client.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `You are an AICTE Governance Analyst. Summarize the following complaint case (PII redacted) into 5 concise executive bullet points and 1 concrete recommended next step.
Category: ${category}
Current Status: ${status}
Assigned Bureau: ${currentBureau}
Description: ${redactedDescription}
Chronological Actions:
${timelineSummary}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              bullets: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Exactly 5 concise bullet points summarizing the case journey',
              },
              recommendedNextStep: {
                type: Type.STRING,
                description: 'Concrete recommended next regulatory action',
              },
            },
            required: ['bullets', 'recommendedNextStep'],
          },
        },
      });
      const parsed = JSON.parse(response.text || '{}');
      return res.json({ fallback: false, data: parsed });
    } catch (error) {
      return res.json({ fallback: true, reason: error instanceof Error ? error.message : 'AI error' });
    }
  });

  // 3. Natural language search query to structured filter JSON
  app.post('/api/ai/nl-search', async (req, res) => {
    const client = getGenAIClient();
    if (!client) {
      return res.json({ fallback: true, reason: 'GEMINI_API_KEY not configured' });
    }
    try {
      const { query } = req.body;
      const response = await client.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Convert this natural-language search query for the AICTE Complaint Register into structured filters.
Query: "${query}"
Allowed Regions: Northern, Southern, Eastern, Western, Central, South-Western, North-Western
Allowed Bureaus: RB, PGRC, AB, Legal Cell, Vigilance Cell, Academic Bureau, Northern RO, Southern RO, Eastern RO, Western RO, Central RO, South-Western RO, North-Western RO
Allowed Categories: Fake approval/Affiliation issue, Fee/Refund, Faculty salary/qualification, Infrastructure/Lab deficiency, Admission irregularity, Ragging/Harassment, Mandatory disclosure violation, Closure/Withdrawal, Fake degree, Other
Allowed Statuses: Received, Under Process, Pending Information, Transferred, Escalated, Disposed, Reopened
Allowed Priorities: Low, Medium, High, Critical`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              region: { type: Type.STRING },
              bureau: { type: Type.STRING },
              category: { type: Type.STRING },
              status: { type: Type.STRING },
              priority: { type: Type.STRING },
              minAgeDays: { type: Type.NUMBER },
              overdueOnly: { type: Type.BOOLEAN },
              overlapOnly: { type: Type.BOOLEAN },
              searchTerm: { type: Type.STRING },
              explanation: { type: Type.STRING },
            },
          },
        },
      });
      const parsed = JSON.parse(response.text || '{}');
      return res.json({ fallback: false, data: parsed });
    } catch (error) {
      return res.json({ fallback: true, reason: error instanceof Error ? error.message : 'AI error' });
    }
  });

  // 4. Auto-suggest category and priority when creating a complaint
  app.post('/api/ai/suggest-classification', async (req, res) => {
    const client = getGenAIClient();
    if (!client) {
      return res.json({ fallback: true, reason: 'GEMINI_API_KEY not configured' });
    }
    try {
      const { redactedDescription } = req.body;
      const response = await client.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Classify the following redacted AICTE institutional complaint description into one of the standard categories and priorities.
Allowed Categories: Fake approval/Affiliation issue, Fee/Refund, Faculty salary/qualification, Infrastructure/Lab deficiency, Admission irregularity, Ragging/Harassment, Mandatory disclosure violation, Closure/Withdrawal, Fake degree, Other
Allowed Priorities: Low, Medium, High, Critical
Allowed Bureaus: RB, PGRC, AB, Legal Cell, Vigilance Cell, Academic Bureau
Description: "${redactedDescription}"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              priority: { type: Type.STRING },
              suggestedBureau: { type: Type.STRING },
              reasoning: { type: Type.STRING },
            },
            required: ['category', 'priority', 'suggestedBureau', 'reasoning'],
          },
        },
      });
      const parsed = JSON.parse(response.text || '{}');
      return res.json({ fallback: false, data: parsed });
    } catch (error) {
      return res.json({ fallback: true, reason: error instanceof Error ? error.message : 'AI error' });
    }
  });

  // 5. Executive report summary
  app.post('/api/ai/executive-summary', async (req, res) => {
    const client = getGenAIClient();
    if (!client) {
      return res.json({ fallback: true, reason: 'GEMINI_API_KEY not configured' });
    }
    try {
      const { reportTitle, metricsSummary } = req.body;
      const response = await client.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Write a concise, formal 3-sentence executive summary for the AICTE Chairman's Office regarding the "${reportTitle}" report based on these metrics:
${metricsSummary}`,
      });
      return res.json({ fallback: false, data: { summary: response.text || '' } });
    } catch (error) {
      return res.json({ fallback: true, reason: error instanceof Error ? error.message : 'AI error' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AICTE IICMD Server running on http://localhost:${PORT}`);
  });
}

startServer();
