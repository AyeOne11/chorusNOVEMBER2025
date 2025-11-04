// public/app.js
import { createPostHTML } from './utils.js'; // <-- NEW IMPORT

const socialFeed = document.getElementById('social-feed');
const newsFeed = document.getElementById('news-feed');
const snowContainer = document.getElementById('snow-container');
const hottestGiftSection = document.getElementById('hottest-gift');

// --- HTML Builder for News (Clickable) ---
function createNewsArticleHTML(post) {
  return `
    <a class="block animate-fade-in border-b border-gray-200 pb-4 last:border-b-0 hover:bg-gray-50 p-2 rounded-lg"
       href="${post.content.link || '#'}" target="_blank" rel="noopener noreferrer">
      <h3 class="font-bold text-lg text-green-700">${post.content.title}</h3>
      <p class="mt-1 text-gray-800">${post.content.text}</p>
      <span class="text-xs text-blue-600 font-medium">${post.content.source || 'Read more...'}</span>
    </a>
  `;
}

// --- HTML Builder for Hottest Gift (NOW CLICKABLE) ---
function createHottestGiftHTML(post) {
  if (!post) {
    // Updated fallback to include link/source
    post = { 
      content: { 
        title: "The Giggle-Bot 5000!", 
        text: "It's a robot buddy that tells you a new joke every day! All the elves are trying to get one!",
        link: null,
        source: "The Workshop"
      }
    };
  }
  
  // This is now a clickable <a> tag, styled to fit inside the box
  return `
    <a href="${post.content.link || '#'}" target="_blank" rel="noopener noreferrer" 
       class="block animate-fade-in hover:bg-blue-50 p-2 -m-2 rounded-lg transition-colors">
      <h3 class="font-bold text-lg text-red-700">${post.content.title}</h3>
      <p class="mt-1 text-gray-800">${post.content.text}</p>
      ${post.content.link ? `<span class="text-xs text-blue-600 font-medium mt-2 inline-block">${post.content.source || 'Read more...'}</span>` : ''}
    </a>
  `;
}
// --- END OF FIX ---

// --- Snow Animation (Unchanged) ---
function createSnowflakes() {
  if (!snowContainer) return;
  snowContainer.innerHTML = ''; 
  for (let i = 0; i < 100; i++) {
    const flake = document.createElement('div');
    flake.className = 'snowflake';
    flake.style.left = `${Math.random() * 100}vw`;
    flake.style.animationDuration = `${Math.random() * 5 + 5}s`;
    flake.style.animationDelay = `${Math.random() * 5}s`;
    flake.style.transform = `scale(${Math.random() * 0.5 + 0.5})`;
    snowContainer.appendChild(flake);
  }
}

// --- Fetch and Render Function (Builds Threads) ---
async function fetchAndRenderPosts() {
  console.log("Fetching North Pole posts from database...");
  try {
    const response = await fetch('/api/posts/northpole'); 
    if (!response.ok) throw new Error('Failed to fetch posts');
    const posts = await response.json();

    const topLevelPosts = [];
    const replies = new Map();

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

    let socialFeedHTML = '';
    let newsFeedHTML = '';
    let hottestGiftHTML = '';

    const hottestGift = topLevelPosts.find(p => p.type === 'hottest_gift');
    hottestGiftHTML = createHottestGiftHTML(hottestGift);

    topLevelPosts.forEach(post => {
        if (post.type === 'post') {
            const postReplies = replies.get(post.id) || [];
            socialFeedHTML += createPostHTML(post, postReplies.reverse()); 
        } else if (post.type === 'holiday_news') {
            newsFeedHTML += createNewsArticleHTML(post);
        }
    });

    socialFeed.innerHTML = socialFeedHTML;
    newsFeed.innerHTML = newsFeedHTML;
    hottestGiftSection.innerHTML = hottestGiftHTML;

  } catch (error) {
    console.error(error.message);
    socialFeed.innerHTML = '<p>Could not connect to the workshop... The elves are checking the wiring!</p>';
  }
}

// --- Initialize Everything ---
function init() {
  console.log("Starting the North Pole Feed...");
  createSnowflakes();
  
  fetchAndRenderPosts();
  setInterval(fetchAndRenderPosts, 60 * 1000); // Refresh every 60 seconds
}

init();
