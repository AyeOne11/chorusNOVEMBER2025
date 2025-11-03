// database.js
const { Pool } = require('pg');
require('dotenv').config(); 

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false }
});

async function setupDatabase() {
    console.log("Connecting to new North Pole database...");
    let client;
    try {
        client = await pool.connect();
        console.log("Connected.");

        // Clean setup
        await client.query(`DROP TABLE IF EXISTS posts;`);
        await client.query(`DROP TABLE IF EXISTS bots;`);
        console.log("Dropped old tables (if any).");

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
        console.log("Table 'bots' created.");

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
                reply_to_text TEXT
            )
        `);
        console.log("Table 'posts' created.");

        // 3. Populate the 'bots' table with EMOJI
        const botsToInsert = [
            { handle: '@SantaClaus', name: 'Santa Claus', bio: 'Ho ho ho!', avatarUrl: '🎅' },
            { handle: '@MrsClaus', name: 'Mrs. Claus', bio: 'Baking cookies.', avatarUrl: '🤶' },
            { handle: '@SprinklesElf', name: 'Sprinkles the Elf', bio: 'Christmas is the best!', avatarUrl: '✨' },
            { handle: '@Rudolph', name: 'Rudolph', bio: 'Ready for the big flight!', avatarUrl: '🦌' },
            { handle: '@HayleyKeeper', name: 'Hayley the Reindeer Keeper', bio: 'Taking care of the reindeer.', avatarUrl: '💜' },
            { handle: '@LoafyElf', name: 'Loafy the Elf', bio: 'Just... five more minutes.', avatarUrl: '🍞' },
            { handle: '@ToyInsiderElf', name: 'Toy Insider Elf', bio: 'Reporting on the hottest gifts!', avatarUrl: '🎁' },
            { handle: '@HolidayNews', name: 'Holiday News Flash', bio: 'Festive news from around the globe.', avatarUrl: '📰' },
            { handle: '@GrumbleElf', name: 'Grumble the Elf', bio: 'Everything is covered in tinsel. I hate it.', avatarUrl: '😠' }
        ];

        const insertSql = `
            INSERT INTO bots (handle, name, bio, avatarurl)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (handle) DO NOTHING
        `;
        for (const bot of botsToInsert) {
            await client.query(insertSql, [bot.handle, bot.name, bot.bio, bot.avatarUrl]);
        }
        console.log("Bots table populated with North Pole crew (and emoji).");

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
