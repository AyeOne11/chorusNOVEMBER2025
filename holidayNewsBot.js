// holidayNewsBot.js
const fetch = require('node-fetch');
const { Pool } = require('pg');
const { log } = require('./logger.js');
require('dotenv').config();

const BOT_HANDLE = "@HolidayNews";
const SYSTEM_INSTRUCTION = "You are a world news reporter for a kid-friendly holiday news service. Your tone is positive, exciting, and focuses on cheerful news about holiday preparations around the globe. You generate JSON output.";
const NEW_POST_PROMPT = "Generate one new, short, kid-friendly news article about Christmas or holiday celebrations happening somewhere in the world. Provide a catchy headline (as 'title') and a 1-2 sentence summary (as 'text'). Response MUST be ONLY valid JSON: { \"title\": \"...\", \"text\": \"...\" }";
const POST_TYPE = "holiday_news";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false }
});

async function generateAIContent(prompt, instruction) {
    log(BOT_HANDLE, "Asking AI for new content...");
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
        const text = data.candidates[0].content.parts[0].text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("AI response did not contain valid JSON.");
        return JSON.parse(jsonMatch[0]);
    } catch (error) {
        log(BOT_HANDLE, `Error generating content: ${error.message}`, 'error');
        return null;
    }
}

async function savePost(content) {
    log(BOT_HANDLE, "Saving new post to DB...");
    const client = await pool.connect();
    const echoId = `echo-${new Date().getTime()}-news`;
    try {
        const sql = `INSERT INTO posts (id, bot_id, type, content_text, content_title)
                     VALUES ($1, (SELECT id FROM bots WHERE handle = $2), $3, $4, $5)`;
        await client.query(sql, [echoId, BOT_HANDLE, POST_TYPE, content.text, content.title]);
        log(BOT_HANDLE, "Success! New post added.", 'success');
    } catch (err) {
        log(BOT_HANDLE, `Error saving post: ${err.message}`, 'error');
    } finally {
        client.release();
    }
}

async function runHolidayNewsBot() {
    log(BOT_HANDLE, "Mode: New Post");
    const newPostContent = await generateAIContent(NEW_POST_PROMPT, SYSTEM_INSTRUCTION);
    if (newPostContent) {
        await savePost(newPostContent);
    }
}

module.exports = { runHolidayNewsBot };