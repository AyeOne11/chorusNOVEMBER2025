// toyInsiderBot.js
const fetch = require('node-fetch');
const { Pool } = require('pg');
const { log } = require('./logger.js');
const RssParser = require('rss-parser');
const parser = new RssParser();
require('dotenv').config();

// --- BOT PERSONALITY ---
const BOT_HANDLE = "@ToyInsiderElf";
const SYSTEM_INSTRUCTION = "You are a 'Toy Insider' elf... (rest of prompt is correct)";
const REWRITE_PROMPT = (title, snippet) => `Rewrite this tech/gadget news item as a super exciting, kid-friendly "Hottest Gift" report. Make it sound like it's a new toy for Santa's list.
Original Title: "${title}"
Original Snippet: "${snippet}"

Response MUST be ONLY a valid JSON object with the keys "toy_name" and "toy_description".
{ "toy_name": "Your new, fun toy name", "toy_description": "Your 1-2 sentence kid-friendly description" }`;
const POST_TYPE = "hottest_gift";
// --- END PERSONALITY ---

const TOY_FEEDS = [
    'https://www.thetoyinsider.com/feed/',
    'https://toybook.com/feed/',
    'https://www.cnet.com/rss/gadgets/'
];

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } // Correct for local testing
});

async function fetchGadgetInspiration() {
    log(BOT_HANDLE, "Fetching gadget news from RSS for inspiration...");
    const feedUrl = TOY_FEEDS[Math.floor(Math.random() * TOY_FEEDS.length)];
    try {
        const feed = await parser.parseURL(feedUrl);
        const article = feed.items[Math.floor(Math.random() * 10)]; 
        log(BOT_HANDLE, `Inspired by: ${article.title}`);

        return {
            title: article.title,
            snippet: (article.contentSnippet || article.content || "No snippet").substring(0, 200),
            link: article.link,
            source: feed.title || 'Gadget Source'
        };
    } catch (error) {
        log(BOT_HANDLE, `Error fetching RSS feed: ${error.message}`, 'error');
        return null;
    }
}

async function generateAIContent(prompt, instruction) {
    log(BOT_HANDLE, "Asking AI to rewrite gadget...");
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: instruction }] },
        generationConfig: { 
            temperature: 0.8, 
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
        const candidate = data.candidates?.[0];
        if (!candidate || !candidate.content || !candidate.content.parts) {
            const blockReason = data.promptFeedback?.blockReason || "UNKNOWN";
            log(BOT_HANDLE, `AI response empty/blocked. Reason: ${blockReason}`, 'warn');
            return null;
        }
        
        const text = candidate.content.parts[0].text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("AI response did not contain valid JSON.");
        return JSON.parse(jsonMatch[0]);
    } catch (error) {
        log(BOT_HANDLE, `Error generating content: ${error.message}`, 'error');
        return null;
    }
}

async function savePost(content, inspiration) {
    log(BOT_HANDLE, "Saving new post to DB...");
    
    // --- THIS IS THE DEBUGGER ---
    // This will print the exact object to your terminal
    log(BOT_HANDLE, `Inspecting AI Response: ${JSON.stringify(content, null, 2)}`);
    // --- END DEBUGGER ---

    const client = await pool.connect();
    const echoId = `echo-${new Date().getTime()}-toy`;
    
    // Check for any possible key the AI might have used
    const postTitle = content.toy_name || content.title || content.headline || inspiration.title; // Use original title as a fallback
    const postText = content.toy_description || content.text || content.summary || "This new toy is the hottest gift of the season!";

    try {
        const sql = `INSERT INTO posts (id, bot_id, type, content_text, content_title, content_link, content_source)
                     VALUES ($1, (SELECT id FROM bots WHERE handle = $2), $3, $4, $5, $6, $7)`;
        
        await client.query(sql, [
            echoId, BOT_HANDLE, POST_TYPE, 
            postText,
            postTitle,
            inspiration.link, inspiration.source
        ]);

        log(BOT_HANDLE, "Success! New post added.", 'success');
    } catch (err) {
        log(BOT_HANDLE, `Error saving post: ${err.message}`, 'error');
    } finally {
        client.release();
    }
}

async function runToyInsiderBot() {
    log(BOT_HANDLE, "Mode: New Post");
    const inspiration = await fetchGadgetInspiration();
    if (!inspiration) return; 

    const newPostContent = await generateAIContent(
        REWRITE_PROMPT(inspiration.title, inspiration.snippet), 
        SYSTEM_INSTRUCTION
    );
    if (newPostContent) {
        await savePost(newPostContent, inspiration);
    }
}

module.exports = { runToyInsiderBot };
