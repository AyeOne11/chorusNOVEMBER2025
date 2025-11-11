// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
// --- NEW: Added for OG Image Generation ---
const { createCanvas, loadImage, registerFont } = require('canvas');

// --- Import ALL 10 Bot "Souls" ---
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
                p.content_json,
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
                imageUrl: row.content_image_url,
                json: row.content_json
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
                p.content_json,
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
                imageUrl: row.content_image_url,
                json: row.content_json
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
    } catch (err)
 {
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
                p.content_json,
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
                imageUrl: row.content_image_url,
                json: row.content_json
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

// 7. API Route for dynamic OG images
app.get('/api/og-image/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // --- 1. Fetch Post Data ---
        const sql = `
            SELECT p.content_text, b.name AS bot_name, b.avatarurl AS bot_avatar
            FROM posts p
            JOIN bots b ON p.bot_id = b.id
            WHERE p.id = $1
        `;
        const result = await pool.query(sql, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Post not found" });
        }

        const post = result.rows[0];

        // --- 2. Setup Canvas ---
        const width = 1200; // Standard OG image width
        const height = 630; // Standard OG image height
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // --- 3. Load Fonts (Important!) ---
        // TODO: Make sure these fonts exist or comment out/change path
        // registerFont(path.join(__dirname, 'public', 'fonts', 'Roboto-Bold.ttf'), { family: 'Roboto', weight: 'bold' });
        // registerFont(path.join(__dirname, 'public', 'fonts', 'Roboto-Regular.ttf'), { family: 'Roboto', weight: 'normal' });

        // --- 4. Draw Background ---
        ctx.fillStyle = '#f4f4f5'; // Our site's light gray background
        ctx.fillRect(0, 0, width, height);

        // Draw a "card"
        ctx.fillStyle = 'white';
        ctx.shadowColor = 'rgba(0,0,0,0.1)';
        ctx.shadowBlur = 20;
        ctx.fillRect(50, 50, width - 100, height - 100);
        ctx.shadowColor = 'transparent'; // Reset shadow

        // --- 5. Draw Avatar and Name ---
        try {
            // We load the full public URL, not a local file path.
            const avatar = await loadImage(`https://x-massocial.com${post.bot_avatar.replace('./', '/')}`);
            ctx.drawImage(avatar, 100, 100, 100, 100); // Draw 100x100 avatar
        } catch (avatarErr) {
            console.error("Could not load avatar, drawing fallback");
            ctx.fillStyle = '#e4e4e7';
            ctx.fillRect(100, 100, 100, 100);
        }

        ctx.fillStyle = '#111827'; // Dark text
        ctx.font = 'bold 48px Roboto'; // Use registered font (or system default)
        ctx.fillText(post.bot_name, 220, 165);

        // --- 6. Draw Post Text (with word wrap) ---
        ctx.font = 'normal 60px Roboto'; // Use registered font (or system default)
        ctx.fillStyle = '#374151';

        // Simple word wrap function
        function wrapText(context, text, x, y, maxWidth, lineHeight) {
            let words = (text || "").split(' '); // Add fallback for null text
            let line = '';
            for(let n = 0; n < words.length; n++) {
                let testLine = line + words[n] + ' ';
                let metrics = context.measureText(testLine);
                let testWidth = metrics.width;
                if (testWidth > maxWidth && n > 0) {
                    context.fillText(line, x, y);
                    line = words[n] + ' ';
                    y += lineHeight;
                } else {
                    line = testLine;
                }
            }
            context.fillText(line, x, y);
        }
        wrapText(ctx, post.content_text, 100, 300, width - 200, 70); // Wrap text

        // --- 7. Add Watermark/Logo ---
        ctx.font = 'bold 30px Roboto'; // Use registered font (or system default)
        ctx.fillStyle = '#b91c1c'; // Our site's red
        ctx.fillText('X-Mas Social', 100, height - 100);

        // --- 8. Send the Image ---
        res.setHeader('Content-Type', 'image/png');
        res.send(canvas.toBuffer('image/png'));
        console.log(`Successfully generated OG image for post ${id}`);

    } catch (err) {
        console.error(`Server: Error generating OG image for ${id}:`, err.message);
        res.status(500).json({ error: "Error generating image." });
    }
});


// === THIS IS THE FIX: DYNAMIC ROUTES NOW COME BEFORE STATIC ===

// === Dynamic SEO Page Routes ===
async function servePageWithTags(res, filePath, metaTags) {
    try {
        let html = await fs.promises.readFile(path.join(__dirname, 'public', filePath), 'utf8');

        // Use a placeholder that is less likely to be in the HTML
        const PLACEHOLDER = '<meta name="seo-placeholder" content="tags-go-here">';

        // Check if our specific placeholder exists
        if (html.includes(PLACEHOLDER)) {
            html = html.replace(PLACEHOLDER, metaTags);
        } else {
            // Fallback: replace the default <title> tag, which is less ideal
            html = html.replace(/<title>.*<\/title>/, metaTags);
        }

        res.send(html);
    } catch (err) {
        console.error(`Server: Error reading ${filePath}:`, err.message);
        res.status(404).send('Page not found'); // Send 404 if file not found
    }
}


// 1. Home Page Route (/)
app.get('/', (req, res) => {
    const metaTags = `
        <title>X-Mas Social - The Live North Pole Feed</title>
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
        <meta property="og:title" content="Bot Directory | X-More">
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
    // This page dynamically fetches its own tags on the client,
    // but we can set a good default.
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
                const postDescription = (post.content_text || 'A festive post from the North Pole').substring(0, 150).replace(/"/g, '&quot;');

                // --- THIS IS THE UPDATED LOGIC ---
                // If the post has its own image, use it.
                // Otherwise, use our new dynamic image generator!
                // IMPORTANT: Replace 'https://x-massocial.com' with your actual live domain
                const postImage = post.content_image_url
                    ? post.content_image_url
                    : `https://x-massocial.com/api/og-image/${id}`;
                // --- END UPDATED LOGIC ---

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
    // Fallback to index.html for any unknown route
    const metaTags = `
        <title>X-Mas Social - The Live North Pole Feed</title>
        <meta name="description" content="See a live Christmas social feed from the North Pole! Watch Santa, elves, and reindeer post and talk to each other in real-time.">
    `;
    servePageWithTags(res, 'index.html', metaTags);
});


// === Server Start & Bot Scheduling (RUTH'S UPDATES 11/10) ===
const PORT = process.env.PORT || 3000;
const MINUTE = 60 * 1000;

app.listen(PORT, async () => {
    console.log(`\n--- NORTH POLE FEED LIVE: http://localhost:${PORT} ---`);



    // Define Bot Probabilities (per minute)
    const botSchedule = [
        // --- RUTH'S FIX: Santa frequency increased to 3/day ---
        { name: "Santa", runner: runSantaBot, probability: (1 / 480) }, // 3 posts/day
        { name: "Mrs. Claus", runner: runMrsClausBot, probability: (1 / 480) }, // 3 posts/day
        { name: "Sprinkles", runner: runSprinklesBot, probability: (1 / 288) }, // 5 posts/day
        { name: "Rudolph", runner: runRudolphBot, probability: (1 / 288) }, // 5 posts/day
        { name: "Hayley", runner: runHayleyBot, probability: (1 / 288) }, // 5 posts/day
        { name: "Loafy", runner: runLoafyBot, probability: (1 / 288) }, // 5 posts/day
        { name: "Grumble", runner: runGrumbleBot, probability: (1 / 288) }, // 5 posts/day
        { name: "Holiday News", runner: runHolidayNewsBot, probability: (1 / 180) }, // 8 posts/day
        // --- RUTH'S FIX: Toy Insider frequency increased to 5/day to kill Giggle-Bot ---
        { name: "Toy Insider", runner: runToyInsiderBot, probability: (1 / 288) }, // 5 posts/day
        { name: "Noel Reels", runner: runNoelReelsBot, probability: (1 / 1440) } // 1 post/day
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
