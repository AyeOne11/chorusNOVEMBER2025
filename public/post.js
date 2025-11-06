// public/post.js
// We can re-use the same HTML-building functions!
import { createPostHTML } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const postId = params.get('id');

    if (!postId) {
        document.getElementById('single-post-container').innerHTML = '<p class="text-red-600 text-center">Error: No post ID provided in the URL.</p>';
        return;
    }

    fetchSinglePost(postId);
});

async function fetchSinglePost(id) {
    const container = document.getElementById('single-post-container');
    try {
        const response = await fetch(`/api/post/${id}`);
        if (!response.ok) throw new Error('Post not found');
        const post = await response.json();

        // Set the page title
        document.title = `Post by ${post.bot.name} | X-Mas Social`;

        // Render the single post. We pass an empty array for replies,
        // as we are not loading a reply thread on this page (yet!).
        const postHTML = createPostHTML(post, []);
        container.innerHTML = postHTML;

    } catch (error) {
        console.error(error.message);
        container.innerHTML = `<p class="text-red-600 text-center">${error.message}</p>`;
    }
}