// public/app.js
import { createPostHTML, createHottestGiftHTML, createNewsArticleHTML, createSnowflakes } from './utils.js';

const socialFeed = document.getElementById('social-feed');
const newsFeed = document.getElementById('news-feed');
const snowContainer = document.getElementById('snow-container');
const hottestGiftSection = document.getElementById('hottest-gift');

// --- NEW V1.4 Fetch and Render Function (Builds Threads) ---
async function fetchAndRenderPosts() {
  console.log("Fetching North Pole posts from database...");
  try {
    const response = await fetch('/api/posts/northpole'); 
    if (!response.ok) throw new Error('Failed to fetch posts');
    const posts = await response.json();

    const topLevelPosts = [];
    const replies = new Map(); // Use a Map for easy lookup

    // 1. Sort posts into top-level and replies
    for (const post of posts) {
        if (post.replyContext) {
            const parentId = post.replyContext.id;
            if (!replies.has(parentId)) {
                replies.set(parentId, []);
            }
            replies.get(parentId).push(post);
        } else {
            topLevelPosts.push(post);
        }
    }

    // --- FIX FOR FLICKER: Build HTML in memory ---
    let socialFeedHTML = '';
    let newsFeedHTML = '';
    let hottestGiftHTML = '';

    // 2. Render special posts
    const hottestGift = topLevelPosts.find(p => p.type === 'hottest_gift');
    hottestGiftHTML = createHottestGiftHTML(hottestGift);

    // 3. Render all other posts
    topLevelPosts.forEach(post => {
        if (post.type === 'post') {
            const postReplies = replies.get(post.id) || [];
            // Add to the *beginning* of the string
            socialFeedHTML += createPostHTML(post, postReplies.reverse()); // Show oldest replies first
        } else if (post.type === 'holiday_news') {
            // Add to the *beginning* of the string
            newsFeedHTML += createNewsArticleHTML(post);
        }
        // 'hottest_gift' posts are ignored here
    });

    // --- 4. Render to the page all at once ---
    socialFeed.innerHTML = socialFeedHTML || '<p class="text-center text-lg text-gray-600">The elves are quiet right now... check back soon!</p>';
    newsFeed.innerHTML = newsFeedHTML || '<p class="text-center text-sm text-gray-500">No holiday news to report at the moment.</p>';
    hottestGiftSection.innerHTML = hottestGiftHTML;

  } catch (error) {
    console.error(error.message);
    socialFeed.innerHTML = '<p>Could not connect to the workshop... The elves are checking the wiring!</p>';
  }
}

// --- Initialize Everything ---
function init() {
  console.log("Starting the North Pole Feed...");
  createSnowflakes(document.getElementById('snow-container')); // Pass container
  
  fetchAndRenderPosts();
  setInterval(fetchAndRenderPosts, 60 * 1000); // Refresh every 60 seconds
}

init();