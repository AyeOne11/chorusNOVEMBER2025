// mrsClausBot.js
const fetch = require('node-fetch');
const { Pool } = require('pg');
const { log } = require('./logger.js');
require('dotenv').config();

// --- BOT PERSONALITY ---
const BOT_HANDLE = "@MrsClaus";
const SYSTEM_INSTRUCTION = "You are Mrs. Claus. You are warm, matronly, and kind. You love baking, knitting, and taking care of Santa. Your posts are short, gentle, and encouraging (1-2 sentences).";
const REPLY_PROMPT = (originalPost) => `You are Mrs. Claus. You are replying to this post: "${originalPost}". Write a short, warm, and kind reply (1-2 sentences). You could offer them a cookie or a cup of cocoa.`;
const NEW_RECIPE_PROMPT = (recipeName) => `You are Mrs. Claus, sharing a new recipe. Write a very short, warm introduction (1-2 sentences) for your "${recipeName}" recipe.`;
const NEW_TEXT_PROMPT = "Write a short, warm, and gentle post (1-2 sentences) about life at the North Pole, perhaps about Santa, the elves, or a cozy feeling.";
// --- END PERSONALITY ---

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false }
});

const BOTS_TO_REPLY_TO = [
    '@SantaClaus', '@SprinklesElf', '@Rudolph', '@HayleyKeeper', 
    '@LoafyElf', '@GrumbleElf', '@NoelReels'
];

// --- Mrs. Claus' Recipe Database (from your PDF!) ---
// I've filled in the first 3 recipes to get us started!
const RECIPE_DATABASE = [
    {
        name: "Mrs. Claus' Famous Gingerbread Reindeer",
        difficulty: "Medium",
        photo: "https://images.unsplash.com/photo-1606913563752-7b6b70f3b1fd?w=400&h=300&fit=crop",
        ingredients: ["1 cup butter, softened", "1 cup brown sugar", "1/2 cup molasses", "1 egg", "3 cups all-purpose flour", "1 tsp baking soda", "2 tsp ground ginger", "1 tsp cinnamon", "1/2 tsp cloves", "Raisins or candies for eyes"],
        instructions: ["In a large bowl, cream together the butter and brown sugar.", "Beat in the molasses and egg until well combined.", "In a separate bowl, whisk together the flour, baking soda, ginger, cinnamon, and cloves.", "Gradually add the dry ingredients to the wet ingredients and mix well.", "Cover the dough and chill for at least 1 hour.", "Preheat oven to 350°F (175°C).", "Roll out the dough on a floured surface and cut into reindeer shapes.", "Place on a baking sheet and bake for 8-10 minutes.", "Let cool and decorate with raisins!"],
        servings: "2 dozen",
        time: "45 min"
    },
    {
        name: "Snowball Sugar Cookies",
        difficulty: "Easy",
        photo: "https://images.unsplash.com/photo-1483695028997-9abb0fe9b98e?w=400&h=300&fit=crop",
        ingredients: ["1 cup butter, softened", "1/2 cup powdered sugar", "1 tsp vanilla extract", "2 cups all-purpose flour", "1/4 tsp salt", "1 cup chopped pecans (optional)", "More powdered sugar for rolling"],
        instructions: ["Preheat oven to 325°F (165°C).", "In a large bowl, cream the butter and 1/2 cup of powdered sugar until fluffy.", "Stir in the vanilla extract.", "In a separate bowl, whisk together the flour and salt.", "Gradually add the flour mixture to the butter mixture.", "Stir in the chopped pecans, if using.", "Shape the dough into 1-inch balls.", "Place on an ungreased baking sheet.", "Bake for 12-15 minutes, until the bottoms are lightly browned.", "Let cool for a few minutes, then roll in powdered sugar while still warm."],
        servings: "3 dozen",
        time: "30 min"
    },
    {
        name: "Reindeer Hot Cocoa",
        difficulty: "Easy",
        photo: "https://images.unsplash.com/photo-1541592106381-b31e9678029f?w=400&h=300&fit=crop",
        ingredients: ["4 cups whole milk", "1 cup heavy cream", "1 cup semi-sweet chocolate chips", "1/4 cup sugar (or to taste)", "1 tsp vanilla extract", "Whipped cream, mini marshmallows, pretzel twists, and red candies (like M&Ms) for decorating"],
        instructions: ["In a medium saucepan, heat the milk and heavy cream over medium heat.", "Do not let it boil!", "Once warm, whisk in the chocolate chips and sugar.", "Continue whisking until the chocolate is completely melted and the mixture is smooth.", "Remove from heat and stir in the vanilla extract.", "Pour into mugs.", "Top with whipped cream, marshmallows, and use pretzels for 'antlers' and a red candy for a 'nose'!"],
        servings: "4 mugs",
        time: "10 min"
    },
    {
        name: "Elf-Made Peppermint Bark",
        difficulty: "Easy",
        photo: "https://images.unsplash.com/photo-1606913563752-7b6b70f3b1fd?w=400&h=300&fit=crop",
        ingredients: [],
        instructions: [],
        servings: "20 pieces",
        time: "20 min + chill"
    },
    {
        name: "Reindeer Chow Snack Mix",
        difficulty: "Easy",
        photo: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop",
        ingredients: [],
        instructions: [],
        servings: "8 cups",
        time: "15 min"
    },
    {
        name: "Santa's Midnight Cinnamon Rolls",
        difficulty: "Easy",
        photo: "https://images.unsplash.com/photo-1541592106381-b31e9678029f?w=400&h=300&fit=crop",
        ingredients: [],
        instructions: [],
        servings: "8 rolls",
        time: "25 min"
    },
    {
        name: "Polar Bear Paw Cookies",
        difficulty: "Easy",
        photo: "https://images.unsplash.com/photo-1499636136210-1b3c2c3e4d6e?w=400&h=300&fit=crop",
        ingredients: [],
        instructions: [],
        servings: "18 cookies",
        time: "20 min"
    },
    {
        name: "Frosty's Vanilla Snowballs",
        difficulty: "Medium",
        photo: "https://images.unsplash.com/photo-1483695028997-9abb0fe9b98e?w=400&h=300&fit=crop",
        ingredients: [],
        instructions: [],
        servings: "3 dozen",
        time: "35 min"
    },
    {
        name: "North Pole Hot Chocolate Bombs",
        difficulty: "Hard",
        photo: "https://images.unsplash.com/photo-1606913563752-7b6b70f3b1fd?w=400&h=300&fit=crop",
        ingredients: [],
        instructions: [],
        servings: "6 bombs",
        time: "30 min + chill"
    },
    {
        name: "Mrs. Claus' Cranberry Orange Scones",
        difficulty: "Medium",
        photo: "https://images.unsplash.com/photo-1506089670014-7a5b0a3d2a0d?w=400&h=300&fit=crop",
        ingredients: [],
        instructions: [],
        servings: "8 scones",
        time: "30 min"
    },
    {
        name: "Jingle Bell Jam Thumbprints",
        difficulty: "Medium",
        photo: "https://images.unsplash.com/photo-1541592106381-b31e9678029f?w=400&h=300&fit=crop",
        ingredients: [],
        instructions: [],
        servings: "2 dozen",
        time: "30 min"
    },
    {
        name: "Evergreen Sugar Cookies (Cut-Outs)",
        difficulty: "Hard",
        photo: "https://images.unsplash.com/photo-1483695028997-9abb0fe9b98e?w=400&h=300&fit=crop",
        ingredients: [],
        instructions: [],
        servings: "3 dozen",
        time: "2 hours"
    },
    {
        name: "Rudolph's Red Velvet Crinkles",
        difficulty: "Easy",
        photo: "https://images.unsplash.com/photo-1606913563752-7b6b70f3b1fd?w=400&h=300&fit=crop",
        ingredients: [],
        instructions: [],
        servings: "2 dozen",
        time: "45 min"
    }
];
// --- END RECIPE_DATABASE ---

// --- AI function for TEXT ---
async function generateAIText(prompt, instruction) {
    log(BOT_HANDLE, "Asking AI for text content...");
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: instruction }] },
        generationConfig: { 
            temperature: 0.9, 
            maxOutputTokens: 1024,
            responseMimeType: "text/plain" 
        }
    };
    try {
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        if (!response.ok) throw new Error(`Gemini API error! Status: ${response.status}`);
        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        return text.trim().replace(/^"|"$/g, '');
    } catch (error) {
        log(BOT_HANDLE, `Error generating content: ${error.message}`, 'error');
        return null;
    }
}

// --- findPostToReplyTo ---
async function findPostToReplyTo() {
    log(BOT_HANDLE, "Looking for a post to reply to...");
    const client = await pool.connect();
    try {
        const findSql = `
            SELECT p.id, p.content_text, p.content_title, b.handle
            FROM posts p
            JOIN bots b ON p.bot_id = b.id
            WHERE b.handle = ANY($1)
              AND NOT EXISTS (
                  SELECT 1 FROM posts r 
                  WHERE r.reply_to_id = p.id 
                  AND r.bot_id = (SELECT id FROM bots WHERE handle = $2)
              )
            ORDER BY p.timestamp DESC
            LIMIT 1
        `;
        const result = await client.query(findSql, [BOTS_TO_REPLY_TO, BOT_HANDLE]);
        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (err) {
        log(BOT_HANDLE, `Error finding post: ${err.message}`, 'error');
        return null;
    } finally {
        client.release();
    }
}

// --- saveReply ---
async function saveReply(text, postToReplyTo) {
    log(BOT_HANDLE, `Saving reply to ${postToReplyTo.handle}...`);
    const client = await pool.connect();
    const replyId = `echo-${new Date().getTime()}-mrsclaus-reply`;
    const originalPostText = (postToReplyTo.content_title || postToReplyTo.content_text).substring(0, 40) + '...';
    try {
        const sql = `INSERT INTO posts 
                        (id, bot_id, type, content_text, reply_to_id, reply_to_handle, reply_to_text)
                     VALUES 
                        ($1, (SELECT id FROM bots WHERE handle = $2), $3, $4, $5, $6, $7)`;
        await client.query(sql, [
            replyId, BOT_HANDLE, 'post', text,
            postToReplyTo.id, postToReplyTo.handle, originalPostText
        ]);
        log(BOT_HANDLE, "Success! Reply added.", 'success');
    } catch (err) {
        log(BOT_HANDLE, `Error saving reply: ${err.message}`, 'error');
    } finally {
        client.release();
    }
}

// --- savePost (For text-only posts) ---
async function savePost(text) {
    log(BOT_HANDLE, "Saving new text post to DB...");
    const client = await pool.connect();
    const echoId = `echo-${new Date().getTime()}-mrsclaus`;
    try {
        const sql = `INSERT INTO posts (id, bot_id, type, content_text)
                     VALUES ($1, (SELECT id FROM bots WHERE handle = $2), $3, $4)`;
        await client.query(sql, [echoId, BOT_HANDLE, 'post', text]);
        log(BOT_HANDLE, "Success! New text post added.", 'success');
    } catch (err) {
        log(BOT_HANDLE, `Error saving post: ${err.message}`, 'error');
    } finally {
        client.release();
    }
}


// --- saveRecipePost ---
async function saveRecipePost(introText, recipeObject) {
    log(BOT_HANDLE, `Saving new recipe post: ${recipeObject.name}`);
    const client = await pool.connect();
    const echoId = `echo-${new Date().getTime()}-mrsclaus-recipe`;
    
    try {
        const sql = `INSERT INTO posts 
                        (id, bot_id, type, content_text, content_json, content_title)
                     VALUES 
                        ($1, (SELECT id FROM bots WHERE handle = $2), $3, $4, $5, $6)`;
        await client.query(sql, [
            echoId, 
            BOT_HANDLE, 
            'recipe_post', // The frontend will look for this type!
            introText, 
            JSON.stringify(recipeObject), // Save the whole recipe as JSON
            recipeObject.name // Store the name in the title field
        ]);
        log(BOT_HANDLE, "Success! New recipe post added.", 'success');
    } catch (err) {
        log(BOT_HANDLE, `Error saving recipe post: ${err.message}`, 'error');
    } finally {
        client.release();
    }
}

// --- Main Runner (UPDATED with 50/50 Recipe/Text split) ---
async function runMrsClausBot() {
    // 50% chance to reply
    if (Math.random() < 0.5) {
        log(BOT_HANDLE, "Mode: Reply");
        const postToReplyTo = await findPostToReplyTo();
        if (postToReplyTo) {
            const originalPostText = postToReplyTo.content_title || postToReplyTo.content_text;
            const replyText = await generateAIText(REPLY_PROMPT(originalPostText), SYSTEM_INSTRUCTION);
            if (replyText) {
                await saveReply(replyText, postToReplyTo);
            }
        } else {
            log(BOT_HANDLE, "No posts to reply to. Staying quiet.");
            // Default to a new post if no one to reply to
            await runNewPostLogic();
        }
    } 
    // 50% chance to make a new post
    else {
        await runNewPostLogic();
    }
}

// Helper function for new post logic (to avoid code duplication)
async function runNewPostLogic() {
    // 50% chance for a NEW RECIPE post
    if (Math.random() < 0.5) {
        log(BOT_HANDLE, "Mode: New Recipe Post");
        
        // 1. Pick a random recipe
        const recipe = RECIPE_DATABASE[Math.floor(Math.random() * RECIPE_DATABASE.length)];
        
        // 2. Ask AI to write a nice intro for it
        const introText = await generateAIText(NEW_RECIPE_PROMPT(recipe.name), SYSTEM_INSTRUCTION);

        if (introText) {
            // 3. Save the intro + the full recipe object to the DB
            await saveRecipePost(introText, recipe);
        }
    } 
    // 50% chance for a NEW TEXT-ONLY post
    else {
        log(BOT_HANDLE, "Mode: New Text Post");
        const newPostText = await generateAIText(NEW_TEXT_PROMPT, SYSTEM_INSTRUCTION);
        if (newPostText) {
            await savePost(newPostText);
        }
    }
}

module.exports = { runMrsClausBot };
