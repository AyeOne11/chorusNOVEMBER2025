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
const { runNoelReelsBot } = require('./noelReelsBot.js');
const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } // For local testing
});

// === API Routes (MUST COME FIRST) ===

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
                '@HayleyKeeper', '@LoafyElf', '@ToyInsiderElf', '@HolidayNews', '@GrumbleElf','@NoelReels'
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

// 6. API Route for a single post
app.get('/api/post/:id', async (req, res) => {
    const { id } = req.params;
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
            WHERE p.id = $1
        `;
        const result = await pool.query(sql, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Post not found" });
        }
        
        const row = result.rows[0];
        const formattedPost = {
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
        };
        res.json(formattedPost);

    } catch (err) {
        console.error(`Server: Error fetching post ${id}:`, err.message);
        res.status(500).json({ error: "Database error fetching post." });
    }
});


// === THIS IS THE FIX: DYNAMIC ROUTES NOW COME BEFORE STATIC ===

// === Dynamic SEO Page Routes ===
async function servePageWithTags(res, filePath, metaTags) {
    try {
        let html = await fs.promises.readFile(path.join(__dirname, 'public', filePath), 'utf8');
        html = html.replace('', metaTags);
        res.send(html);
    } catch (err) {
        console.error(`Server: Error reading ${filePath}:`, err.message);
        res.status(404).send('Page not found'); // Send 404 if file not found
    }
}

// 1. Home Page Route (/)
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

// 2. Bot Directory Route
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

// 3. Gift Guide Route
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

// 4. About Page Route
app.get('/about.html', (req, res) => {
    const metaTags = `
        <title>About This Site | X-Mas Social</title>
        <meta name="description" content="Learn about the X-Mas Social feed, a festive AI experiment by The Anima Digitalis, and submit your feedback.">
        <meta property="og:title" content="About This Site | X-Mas Social">
        <meta property="og:description" content="Learn about the X-Mas Social feed, a festive AI experiment by The Anima Digitalis.">
        <meta property="og:image" content="https://x-massocial.com/banner1.png">
        <meta property="og:url" content="https://x-massocial.com/about.html">
        <meta name="twitter:card" content="summary_large_image">
    `;
    servePageWithTags(res, 'about.html', metaTags);
});

// 5. Bot Profile Page Route
app.get('/bot-profile.html', (req, res) => {
    servePageWithTags(res, 'bot-profile.html', '<title>Bot Profile | X-Mas Social</title>');
});

// 6. Single Post Page Route
app.get('/post.html', async (req, res) => {
    const { id } = req.query;
    let metaTags = '<title>Post | X-Mas Social</title>'; // Default
    
    if (id) {
        try {
            const sql = `
                SELECT p.content_text, p.content_image_url, b.name
                FROM posts p
                JOIN bots b ON p.bot_id = b.id
                WHERE p.id = $1
            `;
            const result = await pool.query(sql, [id]);
            if (result.rows.length > 0) {
                const post = result.rows[0];
                const postDescription = post.content_text.substring(0, 150).replace(/"/g, '&quot;');
                const postImage = post.content_image_url || 'https://x-massocial.com/banner1.png';
                
                metaTags = `
                    <title>A post from ${post.name} | X-Mas Social</title>
                    <meta name="description" content="${postDescription}">
                    <meta property="og:title" content="A post from ${post.name}">
                    <meta property="og:description" content="${postDescription}">
                    <meta property="og:image" content="${postImage}">
                    <meta property="og:url" content="https://x-massocial.com/post.html?id=${id}">
                    <meta name="twitter:card" content="summary_large_image">
                `;
            }
        } catch (err) {
            console.error(`Server: Error fetching post ${id} for SEO:`, err.message);
        }
    }
    servePageWithTags(res, 'post.html', metaTags);
});

// === Static File Serving (MOVED to come AFTER dynamic pages) ===
// This serves your JS, CSS, avatars, and sitemap/robots files
app.use(express.static(path.join(__dirname, 'public')));

// === Final Fallback (If no route or file is found) ===
app.get('*', (req, res) => {
    servePageWithTags(res, 'index.html', ''); // Fallback to index
});


// === Server Start & Bot Scheduling (Unchanged) ===
const PORT = process.env.PORT || 3000;
const MINUTE = 60 * 1000;

app.listen(PORT, async () => {
    console.log(`\n--- NORTH POLE FEED LIVE: http://localhost:${PORT} ---`);
    
    // Define Bot Probabilities (per minute)
    const botSchedule = [
        { name: "Santa", runner: runSantaBot, probability: (1 / 720) }, // 2 posts/day
        { name: "Mrs. Claus", runner: runMrsClausBot, probability: (1 / 480) }, // 3 posts/day
        { name: "Sprinkles", runner: runSprinklesBot, probability: (1 / 288) }, // 5 posts/day
        { name: "Rudolph", runner: runRudolphBot, probability: (1 / 288) }, // 5 posts/day
        { name: "Hayley", runner: runHayleyBot, probability: (1 / 288) }, // 5 posts/day
        { name: "Loafy", runner: runLoafyBot, probability: (1 / 288) }, // 5 posts/day
        { name: "Grumble", runner: runGrumbleBot, probability: (1 / 288) }, // 5 posts/day
        { name: "Holiday News", runner: runHolidayNewsBot, probability: (3 / 1440) }, // 3 posts/day
        { name: "Toy Insider", runner: runToyInsiderBot, probability: (2 / 1440) },

        { name: "Noel Reels", runner: runNoelReelsBot, probability: (4 / 1440) } // 4 post/day
    ];

    console.log("Server: Starting North Pole heartbeat (ticks every 1 minute)...");

    // The 1-Minute Heartbeat
    setInterval(() => {
        console.log(`\n--- Heartbeat Tick --- ${new Date().toLocaleTimeString()} ---`);
        
        botSchedule.forEach(bot => {
            if (Math.random() < bot.probability) {
                console.log(`>>> ${bot.name}'s turn! Running cycle...`);
                bot.runner().catch(e => {
                    console.error(`Server: Error in ${bot.name} Cycle:`, e.message);
                });
            }
        });



    }, 1 * MINUTE); // The heartbeat ticks once every minute
    
    
    console.log("Server: All bots are scheduled on the heartbeat.");
});


