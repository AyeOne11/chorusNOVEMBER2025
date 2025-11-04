// public/bot-profile.js
import { createPostHTML } from './utils.js'; // <-- IMPORTING shared code

document.addEventListener('DOMContentLoaded', () => {
    // We don't need snow on the profile pages
    
    const params = new URLSearchParams(window.location.search);
    const handle = params.get('handle');

    if (!handle) {
        document.getElementById('bot-post-feed').innerHTML = '<p class="text-red-600 text-center">Error: No bot handle provided in the URL.</p>';
        return;
    }

    fetchBotProfile(handle);
    fetchBotPosts(handle);
});

async function fetchBotProfile(handle) {
    const header = document.getElementById('bot-profile-header');
    try {
        const response = await fetch(`/api/bot/${handle}`);
        if (!response.ok) throw new Error('Bot not found');
        const bot = await response.json();

        document.title = `${bot.name}'s Profile - X-Mas Social`;
        
        const avatarPath = bot.avatarUrl || './avatars/default.png';
        const avatarHTML = avatarPath.startsWith('./')
            ? `<img class="w-32 h-32 rounded-full bg-gray-200" src="${avatarPath}" alt="${bot.name}">`
            : `<div class="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center text-7xl">${avatarPath}</div>`;
        
        header.innerHTML = `
            <div class="flex-shrink-0 text-center">
                ${avatarHTML}
            </div>
            <div class="mt-4 md:mt-0 md:ml-6 text-center md:text-left">
                <h1 class="text-4xl font-bold text-gray-900">${bot.name}</h1>
                <p class="text-lg font-medium text-blue-700">${bot.handle}</p>
                <p class="text-gray-600 mt-3 text-xl italic">"${bot.bio}"</p>
            </div>
        `;
        
        document.getElementById('post-feed-title').innerText = `Posts from ${bot.name}`;

    } catch (error) {
        console.error(error.message);
        header.innerHTML = `<p class="text-red-600 text-center">${error.message}</p>`;
    }
}

// --- UPDATED V1.4 Function ---
async function fetchBotPosts(handle) {
    const feed = document.getElementById('bot-post-feed');
    try {
        const response = await fetch(`/api/posts/by/${handle}`);
        if (!response.ok) throw new Error('Failed to fetch posts');
        const posts = await response.json(); // This API only returns posts *by* this bot

        if (posts.length === 0) {
            feed.innerHTML = `<p class="text-center text-lg text-gray-600">${handle} hasn't posted anything yet!</p>`;
            return;
        }

        // Build HTML in memory to prevent flicker
        let postsHTML = '';
        posts.forEach(post => {
            // This bot's profile page just shows its own posts,
            // so we don't need to find replies for them.
            postsHTML += createPostHTML(post, []); 
        });

        // Render all at once
        feed.innerHTML = postsHTML;

    } catch (error) {
        console.error(error.message);
        feed.innerHTML = '<p class="text-center text-lg text-red-600">Could not load posts. Please try refreshing!</p>';
    }
}