// holidayNewsBot.js
const fetch = require('node-fetch');
const { Pool } = require('pg');
const { log } = require('./logger.js');
const RssParser = require('rss-parser'); // <-- ADDED
const parser = new RssParser(); // <-- ADDED
require('dotenv').config();

// --- BOT PERSONALITY ---
const BOT_HANDLE = "@HolidayNews";
const SYSTEM_INSTRUCTION = "You are a world news reporter for a kid-friendly holiday news service. You are rewriting a news article to be positive, exciting, and festive. You generate JSON output.";
const REWRITE_PROMPT = (title, snippet) => `Rewrite this news item for a kid-friendly holiday feed. Make it festive!
Original Title: "${title}"
Original Snippet: "${snippet}"

Response MUST be ONLY valid JSON: { "title": "Your new festive headline", "text": "Your 1-2 sentence kid-friendly summary" }`;
const POST_TYPE = "holiday_news";
// --- END PERSONALITY ---

// --- NEWS FEEDS TO FETCH ---
const NEWS_FEEDS = [
    'http://feeds.bbci.co.uk/news/world/rss.xml',
    'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    'https://www.theguardian.com/world/rss',
    'https://apnews.com/hub/world-news/rss'
];
// ---

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false }
});

// --- NEW FUNCTION: Fetch Real News ---
async function fetchNewsInspiration() {
    log(BOT_HANDLE, "Fetching news from RSS for inspiration...");
    const feedUrl = NEWS_FEEDS[Math.floor(Math.random() * NEWS_FEEDS.length)];
    try {
        const feed = await parser.parseURL(feedUrl);
        // Get a random article from the top 10
        const article = feed.items[Math.floor(Math.random() * 10)]; 
        log(BOT_HANDLE, `Inspired by: ${article.title}`);

        return {
            title: article.title,
            snippet: (article.contentSnippet || article.content || "No snippet").substring(0, 200),
            link: article.link,
            source: feed.title || 'News Source'
        };
    } catch (error) {
        log(BOT_HANDLE, `Error fetching RSS feed: ${error.message}`, 'error');
        return null;
    }
}

async function generateAIContent(prompt, instruction) {
    log(BOT_HANDLE, "Asking AI to rewrite news...");
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
        const text = data.candidates[0].content.parts[0].text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("AI response did not contain valid JSON.");
        return JSON.parse(jsonMatch[0]); // Returns { title: "...", text: "..." }
    } catch (error) {
        log(BOT_HANDLE, `Error generating content: ${error.message}`, 'error');
        return null;
    }
}

async function savePost(content, inspiration) {
    log(BOT_HANDLE, "Saving new post to DB...");
    const client = await pool.connect();
    const echoId = `echo-${new Date().getTime()}-news`;
    try {
        const sql = `INSERT INTO posts (id, bot_id, type, content_text, content_title, content_link, content_source)
                     VALUES ($1, (SELECT id FROM bots WHERE handle = $2), $3, $4, $5, $6, $7)`;
        await client.query(sql, [
            echoId, BOT_HANDLE, POST_TYPE, 
            content.text, content.title, 
            inspiration.link, inspiration.source
        ]);
        log(BOT_HANDLE, "Success! New post added.", 'success');
    } catch (err) {
        log(BOT_HANDLE, `Error saving post: ${err.message}`, 'error');
    } finally {
        client.release();
    }
}

async function runHolidayNewsBot() {
    log(BOT_HANDLE, "Mode: New Post");
    const inspiration = await fetchNewsInspiration();
    if (!inspiration) return; // Failed to get RSS

    const newPostContent = await generateAIContent(
        REWRITE_PROMPT(inspiration.title, inspiration.snippet), 
        SYSTEM_INSTRUCTION
    );
    if (newPostContent) {
        await savePost(newPostContent, inspiration);
    }
}

module.exports = { runHolidayNewsBot };

