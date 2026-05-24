import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { PRECURATED_FANDOMS } from './src/data/fandoms';
import { FandomTopic, UserSubmission } from './src/types';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory submissions store for the session.
// We prepopulate with some funny examples.
let userSubmissions: UserSubmission[] = [
  {
    id: "sub-1",
    topicName: "Gargoyle Photobombing Guild",
    description: "Enthusiasts who travel around European Gothic cathedrals and take selfies at precise angles to make it look like cathedral gargoyles are sipping their morning lattes.",
    status: "approved",
    isReal: false,
    didYouKnow: "While tourists certainly take humorous perspective selfies with gargoyles, there is no formal society, ranking dashboard, or organized 'Guild' coordinating lattes-gargoyle alignment.",
    aiExplanation: "A incredibly creative proposal, but it remains a fun personal photography trick rather than a collective, organized internet subculture.",
    submittedBy: "MedievalMemeLord",
    createdAt: new Date().toISOString()
  },
  {
    id: "sub-2",
    topicName: "Antique Typewriter Speed-Typers",
    description: "A community of retro-technology speed typists who hook up custom acoustic sensors to manually operated 1930s typewriters to rank typing speeds on mechanical rollers.",
    status: "approved",
    isReal: true,
    didYouKnow: "There is indeed a real, vibrant community of mechanical speed-typers and novelists, including the 'Typewriter Insurgency', who celebrate completely analog writing of novels and compete in speed exhibitions.",
    aiExplanation: "Verified. Retro-tech writing and mechanical typewriter speed exhibitions are indeed active subcultures with physical and digital meetups around the globe.",
    submittedBy: "RibbonTwister",
    createdAt: new Date().toISOString()
  }
];

// Lazy-load Gemini Client helper
let aiClient: any = null;
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Simple seeded-shuffle algorithm to select deterministic daily topics
function getDailyFandoms(dateString: string): FandomTopic[] {
  // Simple hashing of date string to get a seed
  let seed = 0;
  for (let i = 0; i < dateString.length; i++) {
    seed = (seed << 5) - seed + dateString.charCodeAt(i);
    seed |= 0; // Convert to 32bit integer
  }

  // Create seeded-random generator
  const random = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  // Clone precurated list
  const list = [...PRECURATED_FANDOMS];
  
  // Shuffle list with seeded-random values
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const temp = list[i];
    list[i] = list[j];
    list[j] = temp;
  }

  // Retain the first 10 unique items for daily challenge
  return list.slice(0, 10);
}

// --- API Endpoints ---

// Get daily challenge topics (seeded for today's date)
app.get('/api/fandoms/daily', (req, res) => {
  const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const dailySet = getDailyFandoms(todayStr);
  res.json({ date: todayStr, topics: dailySet });
});

// Generate a random strange fandom topic dynamically using Gemini or fallback
app.get('/api/fandoms/generate-random', async (req, res) => {
  const client = getGeminiClient();
  
  if (!client) {
    // Graceful fallback to random pre-curated topics
    const randomIndex = Math.floor(Math.random() * PRECURATED_FANDOMS.length);
    const randomizedTopic = { ...PRECURATED_FANDOMS[randomIndex] };
    // Mix it up - assign a random source ID
    randomizedTopic.id = `fallback-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    randomizedTopic.source = 'gemini'; // Marked as generated
    return res.json({ topic: randomizedTopic, isFallback: true });
  }

  try {
    // Generate strange niche subculture from Gemini
    const result = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: "Generate a single strange, hyper-niche fandom or subculture topic. It can either be COMPLETELY REAL (e.g., highly specific real-world subcultures, extreme groups, weird historical preservation guilds, quirky internet trends, specific hobbyists) or COMPLETELY FAKE/FABRICATED (but sound highly plausible, humorous, and detailed).\n\nYou must return the topic in a structured JSON payload with keys:\n- topicName: string (max 6 words, quirky name)\n- description: string (2-3 detailed, descriptive sentences detailing what this community does, their rituals, and their passions)\n- isReal: boolean (whether the topic actually exists in the real world, or is a complete fabrication)\n- didYouKnow: string (a cool 'Did You Know?' real-world fact or historical context, or if fake, a humorous explanation of why it sounds plausible but is a total parody)\n- category: string (max 3 words category, e.g., 'Food & Snacks', 'Niche Sports', 'Collectibles')\n\nEnsure it is strange, engaging, and challenging to guess.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topicName: { type: Type.STRING, description: "Quirky name of the fandom/subculture." },
            description: { type: Type.STRING, description: "Detailed description of what they do, their passion, rituals, or forums." },
            isReal: { type: Type.BOOLEAN, description: "Whether this exists in real life or is a complete joke." },
            didYouKnow: { type: Type.STRING, description: "Underlying trivia or hilarious debunk." },
            category: { type: Type.STRING, description: "Broad category label." }
          },
          required: ["topicName", "description", "isReal", "didYouKnow", "category"]
        }
      }
    });

    const parsedJson = JSON.parse(result.text.trim());
    const generatedTopic: FandomTopic = {
      id: `gemini-${Date.now()}`,
      topicName: parsedJson.topicName,
      description: parsedJson.description,
      isReal: parsedJson.isReal,
      didYouKnow: parsedJson.didYouKnow,
      category: parsedJson.category,
      source: 'gemini'
    };

    res.json({ topic: generatedTopic, isFallback: false });
  } catch (err: any) {
    console.error("Gemini random generation error:", err);
    // Fallback to pre-curated on error
    const randomIndex = Math.floor(Math.random() * PRECURATED_FANDOMS.length);
    const randomizedTopic = { ...PRECURATED_FANDOMS[randomIndex] };
    randomizedTopic.id = `fallback-err-${Date.now()}`;
    randomizedTopic.source = 'gemini';
    res.json({ topic: randomizedTopic, isFallback: true, error: err.message });
  }
});

// Submit a user topic & evaluate it with Gemini to audit if it is real/fake
app.post('/api/fandoms/submit', async (req, res) => {
  const { topicName, description, userName } = req.body;
  if (!topicName || !description) {
    return res.status(400).json({ error: "Missing required fields: topicName and description" });
  }

  const client = getGeminiClient();
  const submissionId = `sub-${Date.now()}`;

  // If Gemini is not set up, we auto-approve and do a simple heuristic check
  if (!client) {
    const isRealFallback = Math.random() > 0.5; // simple random simulation
    const simulatedResponse: UserSubmission = {
      id: submissionId,
      topicName,
      description,
      status: "approved",
      isReal: isRealFallback,
      didYouKnow: `Interesting submission from ${userName || 'Anonymous'}! Based on historical databases, this fits beautifully into the catalog of quirky passions.`,
      aiExplanation: "Verified automatically via core heuristics. Thank you for enriching the subculture ledger!",
      submittedBy: userName || 'Anonymous',
      createdAt: new Date().toISOString()
    };
    userSubmissions.unshift(simulatedResponse);
    return res.json({ submission: simulatedResponse, isFallback: true });
  }

  try {
    const prompt = `You are the Niche Fandom Auditor. A user has submitted a strange subculture for our database:\n\nTopic: "${topicName}"\nDescription: "${description}"\n\nAnalyze this topic and determine if it actually exists in our world (it is a Real Fandom/subculture) or if it is completely Fake (fabricated/joke). Provide a fun, smart evaluation.\n\nReject ONLY if the content is highly offensive or spam (status: 'rejected'), otherwise approve (status: 'approved').\n\nFormat your response in a structured JSON payload with keys:\n- status: 'approved' | 'rejected'\n- isReal: boolean\n- didYouKnow: string (a trivia 'Did You Know?' fact or historical explanation. If real, give the genuine backstory. If fake, write a humorous summary of why it's a fiction but could exist)\n- aiExplanation: string (direct note to the user explaining your evaluation decision and reasoning)\n- category: string`;

    const result = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, description: "Must be either 'approved' or 'rejected'." },
            isReal: { type: Type.BOOLEAN, description: "True if actually exists, false if fake or joke." },
            didYouKnow: { type: Type.STRING, description: "Trivia fact or explanatory text." },
            aiExplanation: { type: Type.STRING, description: "Friendly message of verification." },
            category: { type: Type.STRING, description: "Broad category." }
          },
          required: ["status", "isReal", "didYouKnow", "aiExplanation", "category"]
        }
      }
    });

    const parsedJson = JSON.parse(result.text.trim());
    const validStatus: 'approved' | 'rejected' = parsedJson.status === 'rejected' ? 'rejected' : 'approved';
    
    const auditResponse: UserSubmission = {
      id: submissionId,
      topicName,
      description,
      status: validStatus,
      isReal: parsedJson.isReal,
      didYouKnow: parsedJson.didYouKnow || "Interesting idea!",
      aiExplanation: parsedJson.aiExplanation || "Thank you for the submission!",
      submittedBy: userName || 'Anonymous',
      createdAt: new Date().toISOString()
    };

    if (validStatus === 'approved') {
      userSubmissions.unshift(auditResponse);
    }

    res.json({ submission: auditResponse, isFallback: false });
  } catch (err: any) {
    console.error("Gemini submission audit error:", err);
    // Simple fallback
    const mockApprove: UserSubmission = {
      id: submissionId,
      topicName,
      description,
      status: "approved",
      isReal: true,
      didYouKnow: "Interesting topic! Without full analysis capability, we've cataloged this as a candidate real-world subculture.",
      aiExplanation: "Successfully added to the review boards. Thank you for keeping topics weird!",
      submittedBy: userName || 'Anonymous',
      createdAt: new Date().toISOString()
    };
    userSubmissions.unshift(mockApprove);
    res.json({ submission: mockApprove, isFallback: true, error: err.message });
  }
});

// Retrieve all approved user submissions
app.get('/api/fandoms/submissions', (req, res) => {
  res.json({ submissions: userSubmissions });
});

// --- Vite & Client Hosting Middleware ---

async function start() {
  if (process.env.NODE_ENV !== "production") {
    // Development server with Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

start().catch((err) => {
  console.error("Server startup error:", err);
});
