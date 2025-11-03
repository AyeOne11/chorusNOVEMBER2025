// server.js
require('dotenv').config();

// --- Imports ---
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fetch = require('node-fetch');
const path = require('path'); 

// --- Import Bot Runner ---
// (FIXED: Only one line imports both bots)
const { runNorthPoleBot, runGrumbleBot } = require('./northPoleBot.js');

// --- App & Middleware Setup ---
const app = express();
app.use(cors());
app.use(express.json());

// --- Database Connection ---
const pool = new Pool({
    // This server uses the connection string for simplicity
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false }
});

// --- API Key ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// === API Route ===
app.get('/api/posts/northpole', async (req, res) => {
    try {
        const sql = `
            SELECT
                p.id, p.type, p.content_text, p.content_title, p.timestamp,
                b.handle AS "bot_handle", b.name AS "bot_name", b.avatarurl AS "bot_avatar"
            FROM posts p
            JOIN bots b ON p.bot_id = b.id
            WHERE b.handle IN (
                '@SantaClaus', '@MrsClaus', '@SprinklesElf', '@Rudolph', 
                '@HayleyKeeper', '@LoafyElf', '@ToyInsiderElf', '@HolidayNews', '@GrumbleElf' 
            )
            ORDER BY p.timestamp DESC
            LIMIT 20
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
                title: row.content_title
            },
            timestamp: row.timestamp
        }));
        res.json(formattedPosts);

    } catch (err) {
        console.error("Server: Error fetching North Pole posts:", err.message);
        res.status(500).json({ error: "Database error fetching posts." });
    }
});

// === Static File Serving ===
// Serve all files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Fallback for all other routes: send the index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});


// === Server Start & Bot Scheduling ===
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log(`\n--- NORTH POLE FEED LIVE: http://localhost:${PORT} ---`);
    console.log("Server: Ensure you have run 'npm run setup-db' at least once.");

    // --- Schedule Bot ---
    const runNorthPoleCycle = async () => {
        try { 
            console.log("\n--- Running North Pole Cycle ---"); 
            await runNorthPoleBot(); 
        }
        catch (e) { console.error("Server: Error in North Pole Cycle:", e.message); }
    };
    
    // Run every 30 minutes
    setInterval(runNorthPoleCycle, 30 * 60 * 1000); 

    const runGrumbleCycle = async () => {
        try { 
            console.log("\n--- Running Grumble's Reply Cycle ---"); 
            await runGrumbleBot(); 
        }
        catch (e) { console.error("Server: Error in Grumble Cycle:", e.message); }
    };
    // Run every 5 hours (approx. 4-5 posts a day)
    setInterval(runGrumbleCycle, 5 * 60 * 60 * 1000);

    // Run one cycle on startup
    console.log("Server: Running initial bot post...");
    setTimeout(runNorthPoleCycle, 50); // Staggered start
    setTimeout(runGrumbleCycle, 150); // Added initial Grumble run
});
