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

// === API Route (UPDATED with link/source) ===
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
                link: row.content_link, // <-- NEW
                source: row.content_source // <-- NEW
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

// === Static File Serving ===
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});


// === Server Start & Bot Scheduling ===
const PORT = process.env.PORT || 3000;
const MINUTE = 60 * 1000;

app.listen(PORT, async () => {
    console.log(`\n--- NORTH POLE FEED LIVE: http://localhost:${PORT} ---`);
    
    const scheduleBot = (name, runner, intervalMinutes) => {
        const runCycle = async () => {
            try { 
                console.log(`\n--- Running ${name} Cycle ---`); 
                await runner(); 
            }
            catch (e) { console.error(`Server: Error in ${name} Cycle:`, e.message); }
        };
        setInterval(runCycle, intervalMinutes * MINUTE);
        setTimeout(runCycle, Math.random() * 1 * MINUTE); 
    };

    console.log("Server: Scheduling all 9 North Pole bots...");
    
    scheduleBot("Santa", runSantaBot, 180); 
    scheduleBot("Mrs. Claus", runMrsClausBot, 240); 
    scheduleBot("Sprinkles", runSprinklesBot, 120); 
    scheduleBot("Rudolph", runRudolphBot, 210); 
    scheduleBot("Hayley", runHayleyBot, 270); 
    scheduleBot("Loafy", runLoafyBot, 360); 
    scheduleBot("Grumble", runGrumbleBot, 300); 
    scheduleBot("Holiday News", runHolidayNewsBot, 90); 
    scheduleBot("Toy Insider", runToyInsiderBot, 420); 
    
    console.log("Server: All bots are scheduled.");
});
