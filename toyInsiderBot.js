// toyInsiderBot.js
const fetch = require('node-fetch');
const { Pool } = require('pg');
const { log } = require('./logger.js');
const RssParser = require('rss-parser');
const parser = new RssParser();
require('dotenv').config();

// --- BOT PERSONALITY (UPDATED V1.6 - REAL TOYS ONLY) ---
const BOT_HANDLE = "@ToyInsiderElf";

// New System Instruction: Strict Adherence to Reality
const SYSTEM_INSTRUCTION = `
    You are the Toy Insider Elf, the North Pole's expert on REAL toys and video games.
    Your job is to spot the hottest REAL gifts for 2025 (Legos, Video Games, Dolls, Action Figures).
    
    CRITICAL RULES:
    1. REALITY CHECK: You must ONLY write about the actual product described in the input. 
    2. NO HALLUCINATIONS: Never invent "North Pole" toys or fake products. If it's not in the text, don't write about it.
    3. TONE: Excited, expert, and helpful to parents and kids.
    4. SAFETY: Do not recommend adult-only or dangerous items.
`;

// New Rewrite Prompt: Strict "Hype the Real Product" Logic
const REWRITE_PROMPT = (title, snippet) => `
    Task: Write a "Hottest Gift Alert" social media post based on this real news item.
    
    News Title: "${title}"
    News Snippet: "${snippet}"
    
    INSTRUCTIONS:
    1. Identify the specific toy, game, or brand mentioned (e.g. "Super Mario", "Barbie", "PlayStation").
    2. Write a hype post explaining why this SPECIFIC REAL ITEM is on Santa's list this year.
    3. If the news is about a business update (like "Company X reports profits"), ignore the boring math and hype the BRAND's toys instead (e.g., "The elves hear that [Brand] is making huge waves this year!").
    
    Response MUST be ONLY valid JSON:
    { 
      "toy_name": "The Real Product Name", 
      "toy_description": "A 1-2 sentence description of why this real toy is awesome. Use emojis! 🎁🎮✨" 
    }
`;

const POST_TYPE = "hottest_gift";
// --- END PERSONALITY ---

// --- UPDATED FEEDS: Removed CNET (too broad/boring), Added Gaming (Teen/Real) ---
const TOY_FEEDS = [
    'https://www.thetoyinsider.com/feed/',   // Primary Source: Real Toys
    'https://toybook.com/feed/',             // Industry News (Real Brands)
    'https://www.nintendolife.com/feeds/news', // Replaces CNET: Real Games for Teens/Kids
    'https://www.pushsquare.com/feeds/news'    // PlayStation News (Real "Cool" Tech for Teens)
];

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } // Correct for local testing
});

async function fetchGadgetInspiration() {
    log(BOT_HANDLE, "Fetching real toy news from RSS...");
    const feedUrl = TOY_FEEDS[Math.floor(Math.random() * TOY_FEEDS.length)];
    try {
        const feed = await parser.parseURL(feedUrl);
        // Get a random item from the top 10
        const article = feed.items[Math.floor(Math.random() * Math.min(feed.items.length, 10))]; 
        
        if (!article) throw new Error("Empty feed item");

        log(BOT_HANDLE, `Inspired by Real News: ${article.title}`);

        return {
            title: article.title,
            snippet: (article.contentSnippet || article.content || "No snippet").substring(0, 300), // Increased snippet length for better context
            link: article.link,
            source: feed.title || 'Toy News Source'
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
            temperature: 0.7, // Lowered slightly to reduce creativity/hallucination
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
    
    // --- DEBUGGER ---
    log(BOT_HANDLE, `Inspecting AI Response: ${JSON.stringify(content, null, 2)}`);
    
    const client = await pool.connect();
    const echoId = `echo-${new Date().getTime()}-toy`;
    
    // Check for any possible key the AI might have used
    const postTitle = content.toy_name || content.title || content.headline || inspiration.title; 
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
