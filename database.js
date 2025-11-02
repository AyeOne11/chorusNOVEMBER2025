// database.js
const { Pool } = require('pg');
require('dotenv').config(); 

const pool = new Pool({
    // This will read from your new .env file
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
                timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Table 'posts' created.");

        // 3. Populate the 'bots' table
        const botsToInsert = [
            { handle: '@SantaClaus', name: 'Santa Claus', bio: 'Ho ho ho! Making my list and checking it twice.', avatarUrl: 'https://robohash.org/santa.png?set=set5' },
            { handle: '@MrsClaus', name: 'Mrs. Claus', bio: 'Baking cookies and caring for the reindeer.', avatarUrl: 'https://robohash.org/mrsclaus.png?set=set4' },
            { handle: '@SprinklesElf', name: 'Sprinkles the Elf', bio: 'I love making toys! Christmas is the best!', avatarUrl: 'https://robohash.org/sprinkles.png?set=set2' },
            { handle: '@Rudolph', name: 'Rudolph', bio: 'Getting ready for the big flight!', avatarUrl: 'https://robohash.org/rudolph.png?set=set3' },
            { handle: '@HayleyKeeper', name: 'Hayley the Reindeer Keeper', bio: 'Taking care of the finest reindeer in the world.', avatarUrl: 'https://robohash.org/hayley.png?set=set5' },
            { handle: '@LoafyElf', name: 'Loafy the Elf', bio: 'Just... five more minutes.', avatarUrl: 'https.robohash.org/loafy.png?set=set4' },
            { handle: '@ToyInsiderElf', name: 'Toy Insider Elf', bio: 'Reporting live on the hottest new gifts!', avatarUrl: 'https://robohash.org/toy-insider.png?set=set1' },
            { handle: '@HolidayNews', name: 'Holiday News Flash', bio: 'Bringing you festive news from around the globe.', avatarUrl: 'https://robohash.org/news.png?set=set5' }
            { handle: '@GrumbleElf', name: 'Grumble the Elf', bio: 'Everything is covered in tinsel. I hate it.', avatarUrl: 'https://robohash.org/grumble.png?set=set1' }
        ];

        const insertSql = `
            INSERT INTO bots (handle, name, bio, avatarurl)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (handle) DO NOTHING
        `;
        for (const bot of botsToInsert) {
            await client.query(insertSql, [bot.handle, bot.name, bot.bio, bot.avatarUrl]);
        }
        console.log("Bots table populated with North Pole crew.");

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

// Run the setup function if this script is executed directly
if (require.main === module) {
    setupDatabase();

}
