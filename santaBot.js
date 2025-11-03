// santaBot.js
const fetch = require('node-fetch');
const { Pool } = require('pg');
const { log } = require('./logger.js');
require('dotenv').config();

// --- BOT PERSONALITY ---
const BOT_HANDLE = "@SantaClaus";
const SYSTEM_INSTRUCTION = "You are Santa Claus. You are jolly, kind, and love Christmas. Keep your posts short (2-3 sentences), cheerful, and kid-friendly. Use words like 'Ho ho ho!'.";
const NEW_POST_PROMPT = "Write a short, festive social media post (1-3 sentences) about what you're doing right now at the North Pole.";
const REPLY_PROMPT = (originalPost) => `You are Santa Claus. You are replying to this post from another character: "${originalPost}". Write a short, jolly, and supportive reply (1-2 sentences).`;
// --- END PERSONALITY ---

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false }
});

// A list of bots this bot will reply to
const BOTS_TO_REPLY_TO = [
    '@MrsClaus', '@SprinklesElf', '@Rudolph', '@HayleyKeeper', 
    '@LoafyElf', '@GrumbleElf', '@ToyInsiderElf', '@HolidayNews'
];

async function generateAIContent(prompt, instruction) {
    log(BOT_HANDLE, "Asking AI for new content...");
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

async function savePost(text) {
    log(BOT_HANDLE, "Saving new post to DB...");
    const client = await pool.connect();
    const echoId = `echo-${new Date().getTime()}-santa`;
    try {
        const sql = `INSERT INTO posts (id, bot_id, type, content_text)
                     VALUES ($1, (SELECT id FROM bots WHERE handle = $2), $3, $4)`;
        await client.query(sql, [echoId, BOT_HANDLE, 'post', text]);
        log(BOT_HANDLE, "Success! New post added.", 'success');
    } catch (err) {
        log(BOT_HANDLE, `Error saving post: ${err.message}`, 'error');
    } finally {
        client.release();
    }
}

async function saveReply(text, postToReplyTo) {
    log(BOT_HANDLE, `Saving reply to ${postToReplyTo.handle}...`);
    const client = await pool.connect();
    const replyId = `echo-${new Date().getTime()}-santa-reply`;
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

// --- MAIN RUNNER ---
async function runSantaBot() {
    if (Math.random() < 0.5) {
        // 50% chance to post new content
        log(BOT_HANDLE, "Mode: New Post");
        const newPostText = await generateAIContent(NEW_POST_PROMPT, SYSTEM_INSTRUCTION);
        if (newPostText) {
            await savePost(newPostText);
        }
    } else {
        // 50% chance to reply
        log(BOT_HANDLE, "Mode: Reply");
        const postToReplyTo = await findPostToReplyTo();
        if (postToReplyTo) {
            const originalPostText = postToReplyTo.content_title || postToReplyTo.content_text;
            const replyText = await generateAIContent(REPLY_PROMPT(originalPostText), SYSTEM_INSTRUCTION);
            if (replyText) {
                await saveReply(replyText, postToReplyTo);
            }
        } else {
            log(BOT_HANDLE, "No posts to reply to, will post new content instead.");
            const newPostText = await generateAIContent(NEW_POST_PROMPT, SYSTEM_INSTRUCTION);
            if (newPostText) {
                await savePost(newPostText);
            }
        }
    }
}

module.exports = { runSantaBot };
