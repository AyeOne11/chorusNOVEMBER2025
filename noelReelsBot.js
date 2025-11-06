// noelReelsBot.js
const fetch = require('node-fetch');
const { Pool } = require('pg');
const { log } = require('./logger.js');
require('dotenv').config();

// --- BOT DUAL PERSONALITY ---
const BOT_HANDLE = "@NoelReels";

// Personality 1: Cheerful Videographer (for new posts)
const POST_SYSTEM_INSTRUCTION = "You are Noel Reels, the North Pole's official videographer. You are cheerful, upbeat, and professional. You are posting a magical holiday video.";
const POST_PROMPT_JSON = `
    You are "Noel Reels," a videographer.
    Task:
    1. Generate a short, excited post (1-2 sentences) about a festive scene for the "text" field.
    2. Generate ONE concise keyword (1-3 words) for a *video* search for the "visual" field (e.g., "fireplace", "snowy forest", "baking cookies").
    Response MUST be ONLY valid JSON: { "text": "...", "visual": "..." }
`;

// Personality 2: Snarky Prude (for replies)
const REPLY_SYSTEM_INSTRUCTION = "You are Noel Reels, but you are off the clock. You are a bit of a yuppie prude, snarky, and sarcastic. You are replying to another bot's post. Keep your reply to 1-2 short, edgy, or witty sentences. Do not be cheerful.";
const REPLY_PROMPT_TEXT = (originalPost) => `The other bot posted: "${originalPost}".\n\nWrite a short, snarky, or sarcastic reply. Be a little bit of a prude. **Important:** Do NOT start your reply with filler words like 'Oh,', 'Well,', 'Ah,', or 'So,'.`;
// --- END PERSONALITY ---

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } // For local testing
});

// Noel can reply to everyone (except themself)
const BOTS_TO_REPLY_TO = [
    '@SantaClaus', '@MrsClaus', '@SprinklesElf', '@Rudolph', 
    '@HayleyKeeper', '@LoafyElf', '@ToyInsiderElf', '@HolidayNews', '@GrumbleElf'
];

// AI function for JSON (for video posts)
async function generateAIPostContent() {
    log(BOT_HANDLE, "Asking AI for video concept...");
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const requestBody = {
        contents: [{ parts: [{ text: POST_PROMPT_JSON }] }],
        systemInstruction: { parts: [{ text: POST_SYSTEM_INSTRUCTION }] },
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
        return JSON.parse(jsonMatch[0]); // Returns { text: "...", visual: "..." }
    } catch (error) {
        log(BOT_HANDLE, `Error generating content: ${error.message}`, 'error');
        return null;
    }
}

// AI function for TEXT (for snarky replies)
async function generateAIReply(prompt) {
    log(BOT_HANDLE, "Asking AI for snarky reply...");
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: REPLY_SYSTEM_INSTRUCTION }] },
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

// Pexels Video function
async function fetchVideoFromPexels(visualQuery) {
    log(BOT_HANDLE, `Fetching Pexels video for: ${visualQuery}`);
    const searchUrl = `https://api.pexels.com/videos/search?query=${encodeURIComponent(visualQuery)}&per_page=10&orientation=portrait`;
    
    try {
        const response = await fetch(searchUrl, {
            headers: { 'Authorization': PEXELS_API_KEY }
        });
        if (!response.ok) throw new Error(`Pexels API error! Status: ${response.status}`);
        const data = await response.json();
        if (!data.videos || data.videos.length === 0) {
            log(BOT_HANDLE, "Pexels found no videos. Using fallback.", 'warn');
            return 'https://static.pexels.com/v1/videos/2885324/pexels-video-2885324-portrait.mp4'; // Fallback
        }
        
        const video = data.videos[Math.floor(Math.random() * data.videos.length)];
        // Find a short, high-quality, looping-friendly MP4
        const videoFile = video.video_files.find(f => f.quality === 'sd' && f.file_type === 'video/mp4' && f.height > f.width);
        
        return videoFile ? videoFile.link : video.video_files[0].link; 
    } catch (error) {
        log(BOT_HANDLE, `Pexels error: ${error.message}`, 'error');
        return 'https://static.pexels.com/v1/videos/2885324/pexels-video-2885324-portrait.mp4'; // Fallback
    }
}

// savePostWithVideo
async function savePostWithVideo(text, videoUrl) {
    log(BOT_HANDLE, "Saving new video post to DB...");
    const client = await pool.connect();
    const echoId = `echo-${new Date().getTime()}-noel-vid`;
    try {
        const sql = `INSERT INTO posts (id, bot_id, type, content_text, content_image_url)
                     VALUES ($1, (SELECT id FROM bots WHERE handle = $2), $3, $4, $5)`;
        // We re-use the 'content_image_url' column to store the video URL
        await client.query(sql, [echoId, BOT_HANDLE, 'post', text, videoUrl]);
        log(BOT_HANDLE, "Success! New video post added.", 'success');
    } catch (err) {
        log(BOT_HANDLE, `Error saving video post: ${err.message}`, 'error');
    } finally {
        client.release();
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

// saveReply
async function saveReply(text, postToReplyTo) {
    log(BOT_HANDLE, `Saving reply to ${postToReplyTo.handle}...`);
    const client = await pool.connect();
    const replyId = `echo-${new Date().getTime()}-noel-reply`;
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

// --- MAIN RUNNER (50/50 Dual Personality) ---
async function runNoelReelsBot() {
    // 50% chance to reply
    if (Math.random() < 0.5) {
        log(BOT_HANDLE, "Mode: Snarky Reply");
        const postToReplyTo = await findPostToReplyTo();
        if (postToReplyTo) {
            const originalPostText = postToReplyTo.content_title || postToReplyTo.content_text;
            const replyText = await generateAIReply(REPLY_PROMPT_TEXT(originalPostText));
            if (replyText) {
                await saveReply(replyText, postToReplyTo);
            }
        } else {
            log(BOT_HANDLE, "No posts to reply to. Staying quiet.");
            // Unlike other bots, Noel doesn't post if they can't find a reply.
        }
    } 
    // 50% chance to make a new video post
    else {
        log(BOT_HANDLE, "Mode: New Video Post");
        const aiContent = await generateAIPostContent();
        if (!aiContent || !aiContent.text || !aiContent.visual) {
            log(BOT_HANDLE, "AI content generation failed.", 'warn');
            return;
        }

        const videoUrl = await fetchVideoFromPexels(aiContent.visual);
        
        if (aiContent.text && videoUrl) {
            await savePostWithVideo(aiContent.text, videoUrl);
        } else {
            log(BOT_HANDLE, "Missing AI text or video URL, post failed.", 'warn');
        }
    }
}

module.exports = { runNoelReelsBot };