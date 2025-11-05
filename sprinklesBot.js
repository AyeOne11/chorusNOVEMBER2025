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
    '@LoafyElf', '@GrumbleElf'
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

// --- AI function for TEXT (for replies and text posts) ---
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


// --- Pexels function ---
async function fetchImageFromPexels(visualQuery) {
    log(BOT_HANDLE, `Fetching Pexels image for: ${visualQuery}`);
    const searchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(visualQuery)}&per_page=5&orientation=landscape`;
    
    try {
        const response = await fetch(searchUrl, {
            headers: { 'Authorization': PEXELS_API_KEY }
        });
        if (!response.ok) throw new Error(`Pexels API error! Status: ${response.status}`);
        const data = await response.json();
        if (!data.photos || data.photos.length === 0) {
            log(BOT_HANDLE, "Pexels found no images for this query. Using fallback.", 'warn');
            return 'https://source.unsplash.com/800x600/?festive,holiday'; // Fallback
        }
        const photo = data.photos[Math.floor(Math.random() * data.photos.length)];
        return photo.src.large; 
    } catch (error) {
        log(BOT_HANDLE, `Pexels error: ${error.message}`, 'error');
        return 'https://source.unsplash.com/800x600/?festive,snow'; // Fallback
    }
}

// --- (Unchanged) findPostToReplyTo ---
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

// --- savePost (For text-only posts) ---
async function savePost(text) {
    log(BOT_HANDLE, "Saving new text post to DB...");
    const client = await pool.connect();
    const echoId = `echo-${new Date().getTime()}-sprinkles`;
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

// --- savePostWithImage ---
async function savePostWithImage(text, imageUrl) {
    log(BOT_HANDLE, "Saving new image post to DB...");
    const client = await pool.connect();
    const echoId = `echo-${new Date().getTime()}-sprinkles-img`;
    try {
        const sql = `INSERT INTO posts (id, bot_id, type, content_text, content_image_url)
                     VALUES ($1, (SELECT id FROM bots WHERE handle = $2), $3, $4, $5)`;
        await client.query(sql, [echoId, BOT_HANDLE, 'post', text, imageUrl]);
        log(BOT_HANDLE, "Success! New image post added.", 'success');
    } catch (err) {
        log(BOT_HANDLE, `Error saving image post: ${err.message}`, 'error');
    } finally {
        client.release();
    }
}

// --- (Unchanged) saveReply ---
async function saveReply(text, postToReplyTo) {
    log(BOT_HANDLE, `Saving reply to ${postToReplyTo.handle}...`);
    const client = await pool.connect();
    const replyId = `echo-${new Date().getTime()}-sprinkles-reply`;
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

// --- RESTORED Main Runner (with 50/50 text/image logic) ---
async function runSprinklesBot() {
    // 50% chance to reply
    if (Math.random() < 0.5) {
        log(BOT_HANDLE, "Mode: Reply");
        const postToReplyTo = await findPostToReplyTo();
        if (postToReplyTo) {
            const originalPostText = postToReplyTo.content_title || postToReplyTo.content_text;
            const replyText = await generateAIText(REPLY_PROMPT(originalPostText), SYSTEM_INSTRUCTION);
            if (replyText) {
                await saveReply(replyText, postToReplyTo);
            }
        } else {
            log(BOT_HANDLE, "No posts to reply to, defaulting to new text post.");
            const newPostText = await generateAIText(NEW_TEXT_PROMPT, SYSTEM_INSTRUCTION);
            if (newPostText) {
                await savePost(newPostText);
            }
        }
    } 
    // 50% chance to make a new post
    else {
        // 50% chance for an IMAGE post
        if (Math.random() < 0.5) {
            log(BOT_HANDLE, "Mode: New Image Post");
            const aiContent = await generateAIContent(NEW_IMAGE_PROMPT, SYSTEM_INSTRUCTION);
            if (!aiContent || !aiContent.text || !aiContent.visual) {
                log(BOT_HANDLE, "AI content generation failed.", 'warn');
                return;
            }
            const imageUrl = await fetchImageFromPexels(aiContent.visual);
            if (aiContent.text && imageUrl) {
                await savePostWithImage(aiContent.text, imageUrl);
            } else {
                log(BOT_HANDLE, "Missing AI text or image, post failed.", 'warn');
            }
        } 
        // 50% chance for a TEXT-ONLY post
        else {
            log(BOT_HANDLE, "Mode: New Text Post");
            const newPostText = await generateAIText(NEW_TEXT_PROMPT, SYSTEM_INSTRUCTION);
            if (newPostText) {
                await savePost(newPostText);
            }
        }
    }
}

module.exports = { runSprinklesBot };
