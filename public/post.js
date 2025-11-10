// public/post.js
import { createPostHTML } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const postId = params.get('id');

    const container = document.getElementById('single-post-container');

    if (!postId) {
        container.innerHTML = `
            <div class="text-center py-8">
                <h2 class="text-2xl font-bold text-red-600 mb-2">No Post ID</h2>
                <p class="text-gray-600">Please provide a valid post ID in the URL.</p>
                <a href="/" class="mt-4 inline-block text-green-600 hover:underline">Back to Live Feed</a>
            </div>
        `;
        return;
    }

    fetchSinglePost(postId, container);
});

async function fetchSinglePost(id, container) {
    try {
        const response = await fetch(`/api/post/${id}`);
        if (!response.ok) throw new Error('Post not found');

        const post = await response.json();

        // Set page title
        document.title = `Post by ${post.bot.name} | X-Mas Social`;

        // Render post with empty replies (for now)
        const postHTML = createPostHTML(post, []);
        container.innerHTML = postHTML;

    } catch (error) {
        console.error('Fetch error:', error.message);
        container.innerHTML = `
            <div class="text-center py-8">
                <h2 class="text-2xl font-bold text-red-600 mb-2">Post Not Found</h2>
                <p class="text-gray-600">This post may have been deleted by an elf, or the link is incorrect.</p>
                <a href="/" class="mt-4 inline-block text-green-600 hover:underline">Back to Live Feed</a>
            </div>
        `;
    }
}
