// hayleyBot.js
const fetch = require('node-fetch');
const { Pool } = require('pg');
const { log } = require('./logger.js');
const RssParser = require('rss-parser'); // For Pexels
const parser = new RssParser();
require('dotenv').config();

// --- BOT PERSONALITY (WITH 15% CHANCE LOGIC) ---
const BOT_HANDLE = "@HayleyKeeper";
const SYSTEM_INSTRUCTION = "You are Hayley, the elf in charge of caring for all of Santa's reindeer. You are gentle and kind. You post short, sweet updates about the reindeer's health, their favorite snacks (oats and carrots!), and how their flight practice is going.";

// Strict Prompts (85% chance)
const REPLY_STRICT = (originalPost) => `You are Hayley the Reindeer Keeper. You are replying to this post: "${originalPost}". Write a short, gentle, and kind reply (1-2 sentences). **Important:** Do NOT start your reply with filler words like 'Oh,', 'Well,', 'Ah,', or 'So,'.`;
const NEW_TEXT_STRICT = "Write a short, sweet update (1-2 sentences) about the reindeer. **Important:** Do NOT start your post with filler words like 'Oh,', 'Well,', 'Ah,', or 'So,'.";
const NEW_IMAGE_STRICT = `
    You are "Hayley the Reindeer Keeper".
    Task:
    1. Generate a short, sweet, and caring post (1-2 sentences) about reindeer for the "text" field. **Important:** Do NOT start this text with filler words.
    2. Generate ONE concise keyword (1-3 words) for an image search for the "visual" field (e.g., "reindeer", "caribou", "snowy stable", "aurora").
    Response MUST be ONLY valid JSON: { "text": "...", "visual": "..." }
`;

// Natural Prompts (15% chance)
const REPLY_NATURAL = (originalPost) => `You are Hayley the Reindeer Keeper. You are replying to this post: "${originalPost}". Write a short, gentle, and kind reply (1-2 sentences).`;
const NEW_TEXT_NATURAL = "Write a short, sweet update (1-2 sentences) about the reindeer.";
const NEW_IMAGE_NATURAL = `
    You are "Hayley the Reindeer Keeper".
    Task:
    1. Generate a short, sweet, and caring post (1-2 sentences) about reindeer for the "text" field.
    2. Generate ONE concise keyword (1-3 words) for an image search for the "visual" field (e.g., "reindeer", "caribou", "snowy stable", "aurora").
    Response MUST be ONLY valid JSON: { "text": "...", "visual": "..." }
`;
// --- END PERSONALITY ---

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY; 
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } // For local testing
});

const BOTS_TO_REPLY_TO = [
    '@SantaClaus', '@MrsClaus', '@SprinklesElf', '@Rudolph', 
    '@LoafyElf', '@GrumbleElf', '@NoelReels'
];

// AI function for JSON (for image posts)
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
            log(BOT_HANDLE, `AI response empty/blocked. Reason: ${candidate.finishReason || "UNKNOWN"}`, 'warn');
            return null;
        }
        let aiResponseText = candidate.content.parts[0].text;
        const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("AI response did not contain valid JSON.");
        log(BOT_HANDLE, "AI response parsed.");
        return JSON.parse(jsonMatch[0]); // Returns { text: "...", visual: "..." }
    } catch (error) {
        log(BOT_HANDLE, `Error generating content: ${error.message}`, 'error');
        return null;
    }
}

// AI function for TEXT (for replies and text posts)
async function generateAIText(prompt, instruction) {
    log(BOT_HANDLE, "Asking AI for text content...");
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: instruction }] },
        generationConfig: { 
            temperature: 1.0, 
            maxOutputTokens: 1024,
            responseMimeType: "text/plain" 
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
        return text.trim().replace(/^"|"$/g, '');
    } catch (error) {
        log(BOT_HANDLE, `Error generating content: ${error.message}`, 'error');
        return null;
    }
}

// Pexels function (UPDATED to return object)
async function fetchImageFromPexels(visualQuery) {
    log(BOT_HANDLE, `Fetching Pexels image for: ${visualQuery}`);
    const query = visualQuery || "reindeer OR caribou";
    const searchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`;
    
    try {
        const response = await fetch(searchUrl, {
            headers: { 'Authorization': PEXELS_API_KEY }
        });
        if (!response.ok) throw new Error(`Pexels API error! Status: ${response.status}`);
        const data = await response.json();
        if (!data.photos || data.photos.length === 0) {
            log(BOT_HANDLE, "Pexels found no images. Using fallback.", 'warn');
            return {
                url: 'https://source.unsplash.com/800x600/?reindeer,snow',
                source: 'Unsplash',
                link: 'https://unsplash.com'
            };
        }
        const photo = data.photos[Math.floor(Math.random() * data.photos.length)];
        return {
            url: photo.src.large,
            source: photo.photographer, // <-- The photographer's name
            link: photo.photographer_url // <-- Their Pexels profile URL
        };
    } catch (error) {
        log(BOT_HANDLE, `Pexels error: ${error.message}`, 'error');
        return {
            url: 'https://source.unsplash.com/800x600/?reindeer,nature',
            source: 'Unsplash',
            link: 'https://unsplash.com'
        };
    }
}

// findPostToReplyTo
async function findPostToReplyTo() {
    log(BOT_HANDLE, "Looking for a post to reply to...");
    const client = await pool.connect();
    try {
        const findSql = `
            SELECT p.id, p.content_text, p.content_title, b.handle
            FROM posts p
            JOIN bots b ON p.bot_id = b.id
            WHERE b.handle = ANY($1)
              AND NOT EXISTS (
                  SELECT 1 FROM posts r 
                  WHERE r.reply_to_id = p.id 
                  AND r.bot_id = (SELECT id FROM bots WHERE handle = $2)
              )
            ORDER BY p.timestamp DESC
            LIMIT 1
        `;
        const result = await client.query(findSql, [BOTS_TO_REPLY_TO, BOT_HANDLE]);
        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (err) {
        log(BOT_HANDLE, `Error finding post: ${err.message}`, 'error');
        return null;
    } finally {
        client.release();
    }
}

// savePost (For text-only posts)
async function savePost(text) {
    log(BOT_HANDLE, "Saving new text post to DB...");
    const client = await pool.connect();
    const echoId = `echo-${new Date().getTime()}-hayley`;
    try {
        const sql = `INSERT INTO posts (id, bot_id, type, content_text)
                     VALUES ($1, (SELECT id FROM bots WHERE handle = $2), $3, $4)`;
        await client.query(sql, [echoId, BOT_HANDLE, 'post', text]);
        log(BOT_HANDLE, "Success! New text post added.", 'success');
    } catch (err) {
        log(BOT_HANDLE, `Error saving post: ${err.message}`, 'error');
    } finally {
        client.release();
    }
}

// savePostWithImage (UPDATED to save source and link)
async function savePostWithImage(text, imageUrl, source, link) {
    log(BOT_HANDLE, "Saving new image post to DB...");
    const client = await pool.connect();
    const echoId = `echo-${new Date().getTime()}-hayley-img`;
    try {
        const sql = `INSERT INTO posts (id, bot_id, type, content_text, content_image_url, content_source, content_link)
                     VALUES ($1, (SELECT id FROM bots WHERE handle = $2), $3, $4, $5, $6, $7)`;
        await client.query(sql, [echoId, BOT_HANDLE, 'post', text, imageUrl, source, link]);
        log(BOT_HANDLE, "Success! New image post added.", 'success');
    } catch (err) {
        log(BOT_HANDLE, `Error saving image post: ${err.message}`, 'error');
    } finally {
        client.release();
    }
}

// saveReply
async function saveReply(text, postToReplyTo) {
    log(BOT_HANDLE, `Saving reply to ${postToReplyTo.handle}...`);
    const client = await pool.connect();
    const replyId = `echo-${new Date().getTime()}-hayley-reply`;
    const originalPostText = (postToReplyTo.content_title || postToReplyTo.content_text).substring(0, 40) + '...';
    try {
        const sql = `INSERT INTO posts 
                        (id, bot_id, type, content_text, reply_to_id, reply_to_handle, reply_to_text)
                     VALUES 
                        ($1, (SELECT id FROM bots WHERE handle = $2), $3, $4, $5, $6, $7)`;
        await client.query(sql, [
            replyId, BOT_HANDLE, 'post', text,
            postToReplyTo.id, postToReplyTo.handle, originalPostText
        ]);
        log(BOT_HANDLE, "Success! Reply added.", 'success');
    } catch (err) {
        log(BOT_HANDLE, `Error saving reply: ${err.message}`, 'error');
    } finally {
        client.release();
    }
}

// Helper function for posting (UPDATED)
async function runNewPostMode(useFillerWords) {
    // 50% chance for an IMAGE post
    if (Math.random() < 0.5) {
        log(BOT_HANDLE, "Mode: New Image Post");
        const prompt = useFillerWords ? NEW_IMAGE_NATURAL : NEW_IMAGE_STRICT;
        const aiContent = await generateAIContent(prompt, SYSTEM_INSTRUCTION);
        
        if (!aiContent || !aiContent.text || !aiContent.visual) {
            log(BOT_HANDLE, "AI content generation failed.", 'warn');
            return;
        }
        
        const pexelsData = await fetchImageFromPexels(aiContent.visual); // <-- Get object
        
        if (aiContent.text && pexelsData) {
            // Pass all parts to the save function
            await savePostWithImage(aiContent.text, pexelsData.url, pexelsData.source, pexelsData.link);
        } else {
            log(BOT_HANDLE, "Missing AI text or image data, post failed.", 'warn');
        }
    } 
    // 50% chance for a TEXT-ONLY post
    else {
        log(BOT_HANDLE, "Mode: New Text Post");
        const prompt = useFillerWords ? NEW_TEXT_NATURAL : NEW_TEXT_STRICT;
        const newPostText = await generateAIText(prompt, SYSTEM_INSTRUCTION);
        if (newPostText) {
            await savePost(newPostText);
        }
    }
}

// --- MAIN RUNNER (with 15% AND 50/50 logic) ---
async function runHayleyBot() {
    // 15% CHANCE FOR FILLER WORDS
    const useFillerWords = Math.random() < 0.15;
    log(BOT_HANDLE, `Use filler words: ${useFillerWords}`);

    // 50% chance to reply
    if (Math.random() < 0.5) {
        log(BOT_HANDLE, "Mode: Reply");
        const postToReplyTo = await findPostToReplyTo();
        if (postToReplyTo) {
            const originalPostText = postToReplyTo.content_title || postToReplyTo.content_text;
            const prompt = useFillerWords ? REPLY_NATURAL(originalPostText) : REPLY_STRICT(originalPostText);
            const replyText = await generateAIText(prompt, SYSTEM_INSTRUCTION);
            if (replyText) {
                await saveReply(replyText, postToReplyTo);
            }
        } else {
            log(BOT_HANDLE, "No posts to reply to, defaulting to new post.");
            await runNewPostMode(useFillerWords);
        }
    } 
    // 50% chance to make a new post
    else {
        await runNewPostMode(useFillerWords);
    }
}

module.exports = { runHayleyBot };
