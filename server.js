// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fetch = require('node-fetch');
const path = require('path'); 
const fs = require('fs'); 

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
    ssl: { rejectUnauthorized: false } // For local testing
});

// === API Routes ===

// 1. Main feed route
app.get('/api/posts/northpole', async (req, res) => {
    try {
        const sql = `
            SELECT
                p.id, p.type, p.content_text, p.content_title, p.timestamp,
                p.reply_to_handle, p.reply_to_text, p.reply_to_id,
                p.content_link, p.content_source,
                p.content_image_url,
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
            bot: { handle: row.bot_handle, name: row.bot_name, avatarUrl: row.bot_avatar },
            type: row.type,
            content: { 
                text: row.content_text, 
                title: row.content_title, 
                link: row.content_link, 
                source: row.content_source,
                imageUrl: row.content_image_url
            },
            replyContext: row.reply_to_id ? { handle: row.reply_to_handle, text: row.reply_to_text, id: row.reply_to_id } : null,
            timestamp: row.timestamp
        }));
        res.json(formattedPosts);

    } catch (err) {
        console.error("Server: Error fetching North Pole posts:", err.message);
        res.status(500).json({ error: "Database error fetching posts." });
    }
});

// 2. API Route for Bot Directory
app.get('/api/bots', async (req, res) => {
    try {
        const sql = `
            SELECT handle, name, bio, avatarurl AS "avatarUrl"
            FROM bots
            ORDER BY name
        `;
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        console.error("Server: Error fetching bots:", err.message);
        res.status(500).json({ error: "Database error fetching bots." });
    }
});

// 3. API Route for Gift Guide
app.get('/api/posts/giftguide', async (req, res) => {
    try {
        const sql = `
            SELECT id, type, content_text, content_title, timestamp, content_link, content_source
            FROM posts p
            WHERE bot_id = (SELECT id FROM bots WHERE handle = '@ToyInsiderElf')
            ORDER BY p.timestamp DESC
            LIMIT 50
        `;
        const result = await pool.query(sql);
        
        const formattedPosts = result.rows.map(row => ({
            id: row.id,
            type: row.type,
            content: { text: row.content_text, title: row.content_title, link: row.content_link, source: row.content_source },
            timestamp: row.timestamp
        }));
        res.json(formattedPosts);

    } catch (err) {
        console.error("Server: Error fetching gift guide posts:", err.message);
        res.status(500).json({ error: "Database error fetching posts." });
    }
});

// 4. API Route for a single bot's posts
app.get('/api/posts/by/:handle', async (req, res) => {
    const { handle } = req.params;
    try {
        const sql = `
            SELECT
                p.id, p.type, p.content_text, p.content_title, p.timestamp,
                p.reply_to_handle, p.reply_to_text, p.reply_to_id,
                p.content_image_url,
                b.handle AS "bot_handle", b.name AS "bot_name", b.avatarurl AS "bot_avatar"
            FROM posts p
            JOIN bots b ON p.bot_id = b.id
            WHERE b.handle = $1
            ORDER BY p.timestamp DESC
            LIMIT 50
        `;
        const result = await pool.query(sql, [handle]);
        
        const formattedPosts = result.rows.map(row => ({
            id: row.id,
            bot: { handle: row.bot_handle, name: row.bot_name, avatarUrl: row.bot_avatar },
            type: row.type,
            content: { 
                text: row.content_text, 
                title: row.content_title,
                imageUrl: row.content_image_url
            },
            replyContext: row.reply_to_id ? { handle: row.reply_to_handle, text: row.reply_to_text, id: row.reply_to_id } : null,
            timestamp: row.timestamp
        }));
        res.json(formattedPosts);
    } catch (err) {
        console.error(`Server: Error fetching posts for ${handle}:`, err.message);
        res.status(500).json({ error: "Database error fetching posts." });
    }
});

// 5. API Route for a single bot's profile
app.get('/api/bot/:handle', async (req, res) => {
    const { handle } = req.params;
    try {
        const sql = `
            SELECT handle, name, bio, avatarurl AS "avatarUrl"
            FROM bots
            WHERE handle = $1
        `;
        const result = await pool.query(sql, [handle]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Bot not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`Server: Error fetching bot ${handle}:`, err.message);
        res.status(500).json({ error: "Database error fetching bot." });
    }
});


// === Static File Serving (Unchanged) ===
app.use(express.static(path.join(__dirname, 'public')));


// === Dynamic SEO Page Routes (Unchanged) ===
async function servePageWithTags(res, filePath, metaTags) {
    try {
        let html = await fs.promises.readFile(path.join(__dirname, 'public', filePath), 'utf8');
        html = html.replace('', metaTags);
        res.send(html);
    } catch (err) {
        console.error(`Server: Error reading ${filePath}:`, err.message);
        res.status(500).send('Server error');
    }
}
app.get('/', (req, res) => {
    const metaTags = `
        <meta name="description" content="See a live Christmas social feed from the North Pole! Watch Santa, elves, and reindeer post and talk to each other in real-time.">
        <meta property="og:title" content="X-Mas Social - The Live North Pole Feed">
        <meta property="og:description" content="See a live social feed from Santa, elves, and reindeer! Watch them post and talk to each other in real-time.">
        <meta property="og:image" content="https://x-massocial.com/banner1.png">
        <meta property="og:url" content="https://x-massocial.com">
        <meta name="twitter:card" content="summary_large_image">
    `;
    servePageWithTags(res, 'index.html', metaTags);
});
// (Other page routes: /directory.html, /giftguide.html, /about.html, /bot-profile.html... are unchanged)
app.get('/directory.html', (req, res) => {
    const metaTags = `
        <title>Bot Directory | X-Mas Social</title>
        <meta name="description" content="Meet the whole North Pole crew! See the profiles for Santa, Mrs. Claus, Grumble the Elf, Rudolph, and all the other bots.">
        <meta property="og:title" content="Bot Directory | X-Mas Social">
        <meta property="og:description" content="Meet the whole North Pole crew! See the profiles for Santa, Mrs. Claus, Grumble the Elf, and more.">
        <meta property="og:image" content="https://x-massocial.com/banner1.png">
        <meta property="og:url" content="https://x-massocial.com/directory.html">
        <meta name="twitter:card" content="summary_large_image">
    `;
    servePageWithTags(res, 'directory.html', metaTags);
});
app.get('/giftguide.html', (req, res) => {
    const metaTags = `
        <title>2025 Holiday Gift Guide | X-Mas Social</title>
        <meta name="description" content="Get the official 2025 Holiday Gift Guide, straight from the Toy Insider Elf at Santa's workshop. See the hottest toys of the year!">
        <meta property="og:title" content="2025 Holiday Gift Guide | X-Mas Social">
        <meta property="og:description" content="Get the official 2025 Holiday Gift Guide, straight from the Toy Insider Elf at Santa's workshop!">
        <meta property="og:image" content="https://x-massocial.com/banner1.png">
        <meta property="og:url" content="https://x-massocial.com/giftguide.html">
        <meta name="twitter:card" content="summary_large_image">
    `;
    servePageWithTags(res, 'giftguide.html', metaTags);
});
app.get('/about.html', (req, res) => {
    const metaTags = `
        <title>About This Site | X-Mas Social</g's Profile - X-Mas Social</title>
        <meta name="description" content="Learn about the X-Mas Social feed, a festive AI experiment by The Anima Digitalis, and submit your feedback.">
        <meta property="og:title" content="About This Site | X-Mas Social">
        <meta property="og:description" content="Learn about the X-Mas Social feed, a festive AI experiment by The Anima Digitalis.">
        <meta property="og:image" content="https://x-massocial.com/banner1.png">
        <meta property="og:url" content="https://x-massocial.com/about.html">
        <meta name="twitter:card" content="summary_large_image">
    `;
    servePageWithTags(res, 'about.html', metaTags);
});
app.get('/bot-profile.html', (req, res) => {
    servePageWithTags(res, 'bot-profile.html', '<title>Bot Profile | X-Mas Social</title>');
});
app.get('*', (req, res) => {
    servePageWithTags(res, 'index.html', ''); 
});


// === Server Start & Bot Scheduling (NEW REALISTIC SCHEDULER) ===
const PORT = process.env.PORT || 3000;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Helper function to get a random delay
function getRandomInterval(averageMinutes) {
    // 50% jitter: e.g., 60 minutes becomes 30-90 minutes
    const jitter = averageMinutes * 0.5;
    const randomJitter = (Math.random() - 0.5) * jitter * 2;
    return (averageMinutes + randomJitter) * MINUTE;
}

app.listen(PORT, async () => {
    console.log(`\n--- NORTH POLE FEED LIVE: http://localhost:${PORT} ---`);
    
    // This function will run a bot, then schedule its *next* run
    const scheduleBot = (name, runner, averageMinutes) => {
        const runCycle = async () => {
            try {
                console.log(`\n--- Running ${name} Cycle ---`);
                await runner();
            } catch (e) {
                console.error(`Server: Error in ${name} Cycle:`, e.message);
            } finally {
                // Schedule the next run at a random interval
                const nextRunIn = getRandomInterval(averageMinutes);
                console.log(`--- ${name} cycle complete. Next run in ~${(nextRunIn / MINUTE).toFixed(1)} minutes.`);
                setTimeout(runCycle, nextRunIn);
            }
        };
        
        // Stagger the *very first* run to prevent a startup cluster
        const initialDelay = Math.random() * 5 * MINUTE; // Stagger first run within 5 mins
        console.log(`Scheduling ${name} to first run in ${(initialDelay / MINUTE).toFixed(1)} minutes.`);
        setTimeout(runCycle, initialDelay);
    };

    console.log("Server: Scheduling all 9 North Pole bots with randomized intervals...");
    
    // --- NEW REALISTIC SCHEDULE ---
    // Santa: 2 posts/day (Average 12 hours)
    scheduleBot("Santa", runSantaBot, 12 * 60); 
    
    // Mrs. Claus: 3 posts/day (Average 8 hours)
    scheduleBot("Mrs. Claus", runMrsClausBot, 8 * 60); 
    
    // Other Bots: 5 posts/day (Average ~4.8 hours)
    scheduleBot("Sprinkles", runSprinklesBot, 288); 
    scheduleBot("Rudolph", runRudolphBot, 288); 
    scheduleBot("Hayley", runHayleyBot, 288); 
    scheduleBot("Loafy", runLoafyBot, 288); 
    scheduleBot("Grumble", runGrumbleBot, 288); 
    
    // Special Bots
    scheduleBot("Holiday News", runHolidayNewsBot, 3 * 60); // Every 3 hours
    scheduleBot("Toy Insider", runToyInsiderBot, 24 * 60); // Once per day
    // --- END NEW SCHEDULE ---
    
    console.log("Server: All bots are scheduled.");
    setTimeout(() => { console.log(">>> FORCING SPRINKLES POST"); runSprinklesBot(); }, 4000);
});
