// northPoleBot.js
const fetch = require('node-fetch');
const { Pool } = require('pg');
const { log } = require('./logger.js');
require('dotenv').config();

// --- Database Connection ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false }
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --- Bot Definitions ---
const BOTS = [
  // ... (Keep all 6 bots here, from @SantaClaus to @LoafyElf)
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
  // ... (Keep the 2 special posts, @ToyInsiderElf and @HolidayNews)
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

// List of all bots Grumble can reply to
const NORTH_POLE_BOTS = [
    '@SantaClaus', '@MrsClaus', '@SprinklesElf', '@Rudolph', 
    '@HayleyKeeper', '@LoafyElf', '@ToyInsiderElf', '@HolidayNews'
];

// --- Core AI Generation Function ---
async function generateAIContent(bot) {
    // ... (This function remains exactly the same as before)
    log(bot.handle, "Asking AI for new content...");
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const isJson = bot.type !== 'post';
    const requestBody = {
        contents: [{ parts: [{ text: bot.prompt }] }],
        systemInstruction: { parts: [{ text: bot.systemInstruction }] },
        generationConfig: { 
            temperature: 1.0, 
            maxOutputTokens: 2000,
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
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("AI response did not contain valid JSON.");
            return JSON.parse(jsonMatch[0]);
        } else {
            return { text: text.trim().replace(/^"|"$/g, '') }; 
        }
    } catch (error) {
        log(bot.handle, `Error generating content: ${error.message}`, 'error');
        return null;
    }
}

// --- Save to Database Function ---
async function addPostToPG(bot, content) {
    // ... (This function remains exactly the same as before)
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
            content.title || null 
        ]);
        log(bot.handle, "Success! Post added.", 'success');
    } catch (err) {
        log(bot.handle, `Error saving post: ${err.message}`, 'error');
    } finally {
        client.release();
    }
}

// --- Main Runner Function (Original Posts) ---
async function runNorthPoleBot() {
    // ... (This function remains exactly the same as before)
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('PASTE_')) {
        log("@NorthPole", "API key not set. Bot will not run.", 'warn');
        return;
    }

    let botToRun;
    if (Math.random() < 0.25) {
        botToRun = SPECIAL_POSTS[Math.floor(Math.random() * SPECIAL_POSTS.length)];
        log("@NorthPole", `Running special post: ${botToRun.handle}`);
    } else {
        botToRun = BOTS[Math.floor(Math.random() * BOTS.length)];
        log("@NorthPole", `Running regular post: ${botToRun.handle}`);
    }

    const content = await generateAIContent(botToRun);
    if (!content) return; 

    await addPostToPG(botToRun, content);
}


// --- NEW FUNCTION: GRUMBLE BOT ---
async function runGrumbleBot() {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('PASTE_')) {
        log("@GrumbleElf", "API key not set. Bot will not run.", 'warn');
        return;
    }

    log("@GrumbleElf", "Looking for a post to complain about...");
    const client = await pool.connect();
    let postToReplyTo = null;

    try {
        // Find the most recent post from any *other* NP bot that Grumble hasn't replied to yet
        const findSql = `
            SELECT p.id, p.content_text, p.content_title, b.handle
            FROM posts p
            JOIN bots b ON p.bot_id = b.id
            WHERE b.handle = ANY($1)
              AND NOT EXISTS (
                  SELECT 1 FROM posts r 
                  WHERE r.reply_to_id = p.id 
                  AND r.bot_id = (SELECT id FROM bots WHERE handle = '@GrumbleElf')
              )
            ORDER BY p.timestamp DESC
            LIMIT 1
        `;
        const result = await client.query(findSql, [NORTH_POLE_BOTS]);
        if (result.rows.length === 0) {
            log("@GrumbleElf", "No new posts to complain about. I'll check back later.", 'warn');
            return;
        }
        postToReplyTo = result.rows[0];
        log("@GrumbleElf", `Found post ${postToReplyTo.id} by ${postToReplyTo.handle}. Time to complain.`);

    } catch (err) {
        log("@GrumbleElf", `Error finding post: ${err.message}`, 'error');
        return;
    } finally {
        client.release();
    }

    // --- Generate Grumpy Reply ---
    const originalPostText = postToReplyTo.content_title || postToReplyTo.content_text;
    const grumbleBot = {
        handle: '@GrumbleElf',
        systemInstruction: "You are Grumble the Elf. You are grumpy, sarcastic, and fed up with the workshop. You are replying to another bot's post. Keep your reply to 1-2 short, complaining sentences.",
        prompt: `The other bot posted: "${originalPostText}".\n\nWrite a short, grumpy, sarcastic reply. Complain about the post's topic. Do NOT be friendly.`,
        type: 'post' // Grumble's reply is just a standard 'post' type
    };

    const content = await generateAIContent(grumbleBot);
    if (!content) return;

    // --- Save Grumpy Reply to DB ---
    log("@GrumbleElf", "Saving my complaint to PostgreSQL...");
    const clientReply = await pool.connect();
    const replyId = `echo-${new Date().getTime()}-grumble-reply`;
    
    try {
        // We save this as a 'post' type, but with reply fields populated
        const sql = `INSERT INTO posts 
                        (id, bot_id, type, content_text, reply_to_id, reply_to_handle, reply_to_text)
                     VALUES 
                        ($1, (SELECT id FROM bots WHERE handle = $2), $3, $4, $5, $6, $7)`;
        await clientReply.query(sql, [
            replyId,
            grumbleBot.handle,
            grumbleBot.type,
            content.text,
            postToReplyTo.id, // The ID of the post we're replying to
            postToReplyTo.handle, // The handle of the bot we're replying to
            `${originalPostText.substring(0, 40)}...` // A snippet of the original post
        ]);
        log("@GrumbleElf", "Success! My complaint has been registered.", 'success');
    } catch (err) {
        log("@GrumbleElf", `Error saving reply: ${err.message}`, 'error');
    } finally {
        clientReply.release();
    }
}
// --- END NEW FUNCTION ---


// --- EXPORT BOTH FUNCTIONS ---
module.exports = { runNorthPoleBot, runGrumbleBot };

// Handle graceful shutdown
process.on('SIGINT', async () => {
    log("@NorthPole", "Closing DB pool...");
    await pool.end();
    process.exit(0);
});
