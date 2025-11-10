// database.js
const { Pool } = require('pg');
require('dotenv').config(); 

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } // For local testing
});

async function setupDatabase() {
    console.log("Connecting to new North Pole database...");
    let client;
    try {
        client = await pool.connect();
        console.log("Connected.");

        // --- DEV ONLY: Reset tables for testing ---
        // await client.query(`DROP TABLE IF EXISTS posts;`);
        // await client.query(`DROP TABLE IF EXISTS bots;`);
        // console.log("Dropped old tables (if any).");

        // 1. Create the 'bots' table
        await client.query(`
            CREATE TABLE IF NOT EXISTS bots (
                id SERIAL PRIMARY KEY,
                handle TEXT NOT NULL UNIQUE,
                name TEXT,
                bio TEXT,
                avatarurl TEXT
            )
        `);
        console.log("Table 'bots' created or already exists.");

        // 2. Create the 'posts' table
        await client.query(`
            CREATE TABLE IF NOT EXISTS posts (
                id TEXT PRIMARY KEY,
                bot_id INTEGER REFERENCES bots(id),
                type TEXT,
                content_text TEXT,
                content_title TEXT,
                timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                reply_to_id TEXT,
                reply_to_handle TEXT,
                reply_to_text TEXT,
                
                content_image_url TEXT,

                -- NEW COLUMN FOR RECIPES
                content_json JSONB, 

                content_link TEXT,
                content_source TEXT
            )
        `);
        console.log("Table 'posts' created or already exists.");

        // --- NEW: Add column if it doesn't exist (for existing DBs) ---
        try {
            await client.query('ALTER TABLE posts ADD COLUMN content_json JSONB');
            console.log("Added 'content_json' column to 'posts' table.");
        } catch (e) {
            if (e.code === '42701') {
                // Column already exists, which is fine
                console.log("'content_json' column already exists.");
            } else {
                throw e;
            }
        }
        // --- END OF ADD COLUMN ---

        // 3. Populate the 'bots' table (with sprinkles.gif)
        const botsToInsert = [
            { handle: '@SantaClaus', name: 'Santa Claus', bio: 'Ho ho ho!', avatarUrl: './avatars/santa.png' },
            { handle: '@MrsClaus', name: 'Mrs. Claus', bio: 'Baking cookies.', avatarUrl: './avatars/mrsclaus.png' },
            { handle: '@SprinklesElf', name: 'Sprinkles the Elf', bio: 'Christmas is the best!', avatarUrl: './avatars/sprinkles.gif' },
            { handle: '@Rudolph', name: 'Rudolph', bio: 'Ready for the big flight!', avatarUrl: './avatars/rudolph.png' },
            { handle: '@HayleyKeeper', name: 'Hayley the Reindeer Keeper', bio: 'Taking care of the reindeer.', avatarUrl: './avatars/hayley.png' },
            { handle: '@LoafyElf', name: 'Loafy the Elf', bio: 'Just... five more minutes.', avatarUrl: './avatars/loafy.png' },
            { handle: '@ToyInsiderElf', name: 'Toy Insider Elf', bio: 'Reporting on the hottest gifts!', avatarUrl: './avatars/toyinsider.png' },
            { handle: '@HolidayNews', name: 'Holiday News Flash', bio: 'Festive news from around the globe.', avatarUrl: './avatars/news.png' },
            { handle: '@GrumbleElf', name: 'Grumble the Elf', bio: 'Everything is covered in tinsel. I hate it.', avatarUrl: './avatars/grumble.png' },
            { handle: '@NoelReels', name: 'Noel Reels', bio: 'Capturing the North Pole\'s magic, one frame at a time.', avatarUrl: './avatars/noel.png' }
        ];

        const insertSql = `
            INSERT INTO bots (handle, name, bio, avatarurl)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (handle) DO NOTHING
        `;
        for (const bot of botsToInsert) {
            await client.query(insertSql, [bot.handle, bot.name, bot.bio, bot.avatarUrl]);
        }
        console.log("Bots table populated with North Pole crew (and avatars).");

        console.log("Database schema setup complete.");

    } catch (err) {
        console.error("Database setup error:", err.message);
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
        console.log("Database connection closed.");
    }
}

if (require.main === module) {
    setupDatabase();
}
