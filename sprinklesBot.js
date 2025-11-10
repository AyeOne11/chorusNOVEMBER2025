// sprinklesBot.js
const fetch = require('node-fetch');
const { Pool } = require('pg');
const { log } = require('./logger.js');
require('dotenv').config();

// --- BOT PERSONALITY ---
const BOT_HANDLE = "@SprinklesElf";
const SYSTEM_INSTRUCTION = "You are a cheerful and enthusiastic elf named Sprinkles. You love making toys. Your posts are upbeat, short (1-2 sentences), and often use exclamation points!";
const REPLY_PROMPT = (originalPost) => `You are Sprinkles the Elf. You are replying to this post: "${originalPost}". Write a short, cheerful, and overly-excited reply (1-2 sentences). Use exclamation points!`;
const NEW_TEXT_PROMPT = "Post a quick, excited update (1-2 sentences) from the toy workshop!";
const NEW_IMAGE_PROMPT = `
    You are "Sprinkles the Elf," an energetic elf who loves Christmas.
    
    Task:
    1. Generate a short, happy, festive post (1-2 sentences) for the "text" field.
    2. Generate ONE single, concise keyword or short phrase (1-3 words) for an image search for the "visual" field (e.g., "Christmas lights", "snowy day", "hot chocolate", "reindeer").
    
    **STYLE GUIDE (MUST FOLLOW):**
    * **Tone:** Cheerful, excited, and kid-friendly. Use exclamation points!
    * **Vocabulary:** Focus on festive things: toys, snow, cookies, sleigh bells, etc.

    Response MUST be ONLY valid JSON: { "text": "...", "visual": "..." }
    Escape quotes in "text" with \\".
`;
// --- END PERSONALITY ---

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY; 
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } // For local testing
});

const BOTS_TO_REPLY_TO = [
    '@SantaClaus', '@MrsClaus', '@Rudolph', '@HayleyKeeper', 
    '@LoafyElf', '@GrumbleElf', '@NoelReels'
];

// --- AI function for JSON (for image posts) ---
async function generateAIContent(prompt, instruction) {
    log(BOT_HANDLE, "Asking AI for new content (text and visual keyword)...");
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: instruction }] },
        generationConfig: { 
            temperature: 1.0, 
            maxOutputTokens: 1024,
            responseMimeType: "application/json" 
        }
    };

    try {
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        if (!response.ok) throw new Error(`Gemini API error! Status: ${response.status}`);
        const data = await response.json();
        const candidate = data.candidates[0];
        if (!candidate || !candidate.content || !candidate.content.parts) {
            log(BOT_HANDLE, `AI response empty/blocked.
