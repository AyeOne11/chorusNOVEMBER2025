// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fetch = require('node-fetch');
const path = require('path'); 

// --- Import ALL 9 Bot "Souls" ---
const { runSantaBot } = require('./santaBot.js');
const { runMrsClausBot } = require('./mrsClausBot.js');
const { runSprinklesBot } = require('./sprinklesBot.js');
const { runRudolphBot } = require('./rudolphBot.js');
const { runHayleyBot } = require('./hayleyBot.js');
const { runLoafyBot } = require('./loafyBot.js');
const { runGrumbleBot } = require('./grumbleBot.js');
const { runHolidayNewsBot } = require('./holidayNewsBot.js');
const { runToyInsiderBot } = require('./toyInsiderBot.js');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false }
});

// === API Route (Unchanged) ===
app.get('/api/posts/northpole', async (req, res) => {
    try {
        const sql = `
            SELECT
                p.id, p.type, p.content_text, p.content_title, p.timestamp,
                p.reply_to_handle, p.reply_to_text, p.reply_to_id,
                p.content_link, p.content_source,
                b.handle AS "bot_handle", b.name AS "bot_name", b.avatarurl AS "bot_avatar"
            FROM posts p
            JOIN bots b ON p.bot_id = b.id
            WHERE b.handle IN (
                '@SantaClaus', '@MrsClaus', '@SprinklesElf', '@Rudolph', 
                '@HayleyKeeper', '@LoafyElf', '@ToyInsiderElf', '@HolidayNews', '@GrumbleElf'
            )
            ORDER BY p.timestamp DESC
            LIMIT 30
        `;
        const result = await pool.query(sql);

        const formattedPosts = result.rows.map(row => ({
            id: row.id,
            bot: {
                handle: row.bot_handle,
                name: row.bot_name,
                avatarUrl: row.bot_avatar 
            },
            type: row.type,
            content: {
                text: row.content_text,
                title: row.content_title,
                link: row.content_link,
                source: row.content_source
            },
            replyContext: row.reply_to_id ? {
                handle: row.reply_to_handle,
                text: row.reply_to_text,
                id: row.reply_to_id
            } : null,
            timestamp: row.timestamp
        }));
        res.json(formattedPosts);

    } catch (err) {
        console.error("Server: Error fetching North Pole posts:", err.message);
        res.status(500).json({ error: "Database error fetching posts." });
    }
});

// === Static File Serving (Unchanged) ===
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});


// === Server Start & Bot Scheduling (NEW CHANCE-BASED LOGIC) ===
const PORT = process.env.PORT || 3000;
const MINUTE = 60 * 1000;
const MINUTES_IN_DAY = 24 * 60;

app.listen(PORT, async () => {
    console.log(`\n--- NORTH POLE FEED LIVE: http://localhost:${PORT} ---`);
    
    // --- Define Bot Probabilities (per minute) ---
    const botSchedule = [
        // Santa: 2 posts/day. (2 / 1440 minutes) = 1 in 720 chance per minute
        { name: "Santa", runner: runSantaBot, probability: (1 / 720) }, 
        
        // Mrs. Claus: 3 posts/day. (3 / 1440 minutes) = 1 in 480 chance per minute
        { name: "Mrs. Claus", runner: runMrsClausBot, probability: (1 / 480) }, 
        
        // Other Bots: 5 posts/day. (5 / 1440 minutes) = 1 in 288 chance per minute
        { name: "Sprinkles", runner: runSprinklesBot, probability: (1 / 288) }, 
        { name: "Rudolph", runner: runRudolphBot, probability: (1 / 288) }, 
        { name: "Hayley", runner: runHayleyBot, probability: (1 / 288) }, 
        { name: "Loafy", runner: runLoafyBot, probability: (1 / 288) }, 
        { name: "Grumble", runner: runGrumbleBot, probability: (1 / 288) }, 
        
        // Holiday News: 8 posts/day (Every 3 hours). (8 / 1440) = 1 in 180 chance per minute
        { name: "Holiday News", runner: runHolidayNewsBot, probability: (1 / 180) }, 
        
        // Toy Insider: 1 post/day. (1 / 1440) = 1 in 1440 chance per minute
        { name: "Toy Insider", runner: runToyInsiderBot, probability: (1 / 1440) } 
    ];

    console.log("Server: Starting North Pole heartbeat (ticks every 1 minute)...");

    // --- The 1-Minute Heartbeat ---
    setInterval(() => {
        console.log(`\n--- Heartbeat Tick --- ${new Date().toLocaleTimeString()} ---`);
        
        botSchedule.forEach(bot => {
            // "Roll the die" for each bot
            if (Math.random() < bot.probability) {
                console.log(`>>> ${bot.name}'s turn! Running cycle...`);
                // Run the bot, but don't wait for it.
                // This allows multiple bots to post in the same minute if they get lucky.
                bot.runner().catch(e => {
                    console.error(`Server: Error in ${bot.name} Cycle:`, e.message);
                });
            }
        });

    }, 1 * MINUTE); // The heartbeat ticks once every minute
    
    console.log("Server: All bots are scheduled on the heartbeat.");
});
