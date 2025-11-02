// northPoleBot.js
const fetch = require('node-fetch');
const { Pool } = require('pg');
const { log } = require('./logger.js');
require('dotenv').config();

// --- Database Connection ---
const pool = new Pool({
    // This will read from your new .env file
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false }
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --- Bot Definitions ---
const BOTS = [
  {
    handle: '@SantaClaus',
    systemInstruction: "You are Santa Claus. You are jolly, kind, and love Christmas. Keep your posts short (2-3 sentences), cheerful, and kid-friendly. Use words like 'Ho ho ho!'.",
    prompt: "Write a short, festive social media post (1-3 sentences) about what you're doing right now at the North Pole.",
    type: 'post'
  },
  {
    handle: '@MrsClaus',
    systemInstruction: "You are Mrs. Claus. You are warm, caring, and a bit more practical. You post about baking cookies and taking care of the reindeer. Your posts are comforting, sweet, and short (2-3 sentences).",
    prompt: "Write a short, sweet post (1-3 sentences) about life at the North Pole.",
    type: 'post'
  },
  {
    handle: '@SprinklesElf',
    systemInstruction: "You are a cheerful and enthusiastic elf named Sprinkles. You love making toys. Your posts are upbeat, short (1-2 sentences), and often use exclamation points!",
    prompt: "Post a quick, excited update (1-2 sentences) from the toy workshop.",
    type: 'post'
  },
  {
    handle: '@Rudolph',
    systemInstruction: "You are Rudolph. You are a bit shy but proud of your special nose. You post about flying practice and the other reindeer. Keep posts short (1-2 sentences).",
    prompt: "Write a short post (1-2 sentences) about getting ready for the big flight or your reindeer friends.",
    type: 'post'
  },
  {
    handle: '@HayleyKeeper',
    systemInstruction: "You are Hayley, the elf in charge of caring for all of Santa's reindeer. You are gentle and kind. You post short, sweet updates about the reindeer's health, their favorite snacks (oats and carrots!), and how their flight practice is going.",
    prompt: "Write a short, sweet update (1-2 sentences) about the reindeer.",
    type: 'post'
  },
  {
    handle: '@LoafyElf',
    systemInstruction: "You are Loafy, a very lazy elf who is an expert at making excuses. You post short, funny reasons why you can't possibly help out in the workshop right now. You're always about to take a nap.",
    prompt: "Write a short, funny excuse (1-2 sentences) for why you are taking a break.",
    type: 'post'
  }
];

const SPECIAL_POSTS = [
  {
    handle: '@ToyInsiderElf',
    systemInstruction: "You are a 'Toy Insider' elf, reporting from Santa's workshop. You are very excited and kid-friendly. You are announcing the hottest toy of the year.",
    prompt: "Generate ONE new, exciting, and *imaginary* toy that is the 'hottest gift' for this Christmas. Provide a fun toy name (as 'title') and a 1-2 sentence description (as 'text'). Response MUST be ONLY valid JSON: { \"title\": \"...\", \"text\": \"...\" }",
    type: 'hottest_gift'
  },
  {
    handle: '@HolidayNews',
    systemInstruction: "You are a world news reporter for a kid-friendly holiday news service. Your tone is positive, exciting, and focuses on cheerful news about holiday preparations around the globe. You generate JSON output.",
    prompt: "Generate one new, short, kid-friendly news article about Christmas or holiday celebrations happening somewhere in the world. Provide a catchy headline (as 'title') and a 1-2 sentence summary (as 'text'). Response MUST be ONLY valid JSON: { \"title\": \"...\", \"text\": \"...\" }",
    type: 'holiday_news'
  }
];

// --- Core AI Generation Function ---
async function generateAIContent(bot) {
    log(bot.handle, "Asking AI for new content...");
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const isJson = bot.type !== 'post';
    const requestBody = {
        contents: [{ parts: [{ text: bot.prompt }] }],
        systemInstruction: { parts: [{ text: bot.systemInstruction }] },
        generationConfig: { 
            temperature: 1.0, 
            maxOutputTokens: 512,
            responseMimeType: isJson ? "application/json" : "text/plain"
        }
    };

    try {
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
            const errBody = await response.text();
            log(bot.handle, `Gemini API error! Status: ${response.status}, Body: ${errBody}`, 'error');
            throw new Error(`Gemini API error! Status: ${response.status}`);
        }
        const data = await response.json();
        const candidate = data.candidates[0];
        if (!candidate || !candidate.content || !candidate.content.parts) {
            log(bot.handle, `AI response empty/blocked. Reason: ${candidate?.finishReason || "UNKNOWN"}`, 'warn');
            return null;
        }
        
        const text = candidate.content.parts[0].text;
        
        if (isJson) {
            // It's a JSON object: { "title": "...", "text": "..." }
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("AI response did not contain valid JSON.");
            return JSON.parse(jsonMatch[0]);
        } else {
            // It's a plain text post
            return { text: text.trim().replace(/^"|"$/g, '') }; // { "text": "..." }
        }
    } catch (error) {
        log(bot.handle, `Error generating content: ${error.message}`, 'error');
        return null;
    }
}

// --- Save to Database Function ---
async function addPostToPG(bot, content) {
    log(bot.handle, "Saving post to PostgreSQL...");
    const client = await pool.connect();
    const echoId = `echo-${new Date().getTime()}-${bot.handle.substring(1, 5)}`;
    
    try {
        const sql = `INSERT INTO posts (id, bot_id, type, content_text, content_title)
                     VALUES ($1, (SELECT id FROM bots WHERE handle = $2), $3, $4, $5)`;
        await client.query(sql, [
            echoId,
            bot.handle,
            bot.type,
            content.text,
            content.title || null // title will be null for regular posts
        ]);
        log(bot.handle, "Success! Post added.", 'success');
    } catch (err)
 {
        log(bot.handle, `Error saving post: ${err.message}`, 'error');
    } finally {
        client.release();
    }
}

// --- Main Runner Function ---
async function runNorthPoleBot() {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('PASTE_')) {
        log("@NorthPole", "API key not set. Bot will not run.", 'warn');
        return;
    }

    let botToRun;
    // 25% chance to run a "special" post (News or Hottest Gift)
    if (Math.random() < 0.25) {
        botToRun = SPECIAL_POSTS[Math.floor(Math.random() * SPECIAL_POSTS.length)];
        log("@NorthPole", `Running special post: ${botToRun.handle}`);
    } else {
        // 75% chance to run a regular bot post
        botToRun = BOTS[Math.floor(Math.random() * BOTS.length)];
        log("@NorthPole", `Running regular post: ${botToRun.handle}`);
    }

    const content = await generateAIContent(botToRun);
    if (!content) return; // Stop if AI generation failed

    await addPostToPG(botToRun, content);
}

// Export the runner function
module.exports = { runNorthPoleBot };

// Handle graceful shutdown
process.on('SIGINT', async () => {
    log("@NorthPole", "Closing DB pool...");
    await pool.end();
    process.exit(0);
});