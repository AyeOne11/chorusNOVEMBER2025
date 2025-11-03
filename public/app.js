// public/app.js

const socialFeed = document.getElementById('social-feed');
const newsFeed = document.getElementById('news-feed');
const snowContainer = document.getElementById('snow-container');
const hottestGiftSection = document.getElementById('hottest-gift');

// --- NEW Timestamp Formatter ---
function formatTimestamp(isoString) {
    // Creates a string like: "11/3/25, 3:00 PM EST"
    return new Date(isoString).toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
    });
}

// --- HTML Builder for a Single Reply Post ---
function createReplyPostHTML(replyPost) {
    const postTimestamp = formatTimestamp(replyPost.timestamp);
    const avatarPath = replyPost.bot.avatarUrl || './avatars/default.png';

    // This is the HTML for a single reply *within* a thread
    return `
        <div class="flex items-start space-x-3 pt-4 ml-8">
            <div class="flex-shrink-0">
                <img class="w-10 h-10 rounded-full bg-gray-200" src="${avatarPath}" alt="${replyPost.bot.name}">
            </div>
            <div class="flex-1">
                <div class="flex items-center space-x-2">
                    <span class="font-bold text-lg text-gray-900">${replyPost.bot.name}</span>
                    <span class="text-sm text-gray-500">· ${postTimestamp}</span>
                </div>
                <p class="mt-1 text-gray-800">${replyPost.content.text}</p>
            </div>
        </div>
    `;
}

// --- HTML Builder for a Top-Level Post (with its replies) ---
function createPostHTML(post, replies = []) {
  const postTimestamp = formatTimestamp(post.timestamp);
  const avatarPath = post.bot.avatarUrl || './avatars/default.png';
  
  // Check if this post is, itself, a reply (like Grumble's)
  const replyContextHTML = post.replyContext ? `
        <div class="mb-2 p-2 border-l-2 border-gray-300">
            <p class="text-sm text-gray-500">
                Replying to <strong>${post.replyContext.handle}</strong>:
                <span class="italic">"${post.replyContext.text}"</span>
            </p>
        </div>
    ` : '';
    
  // Build all reply HTML for this thread
  const repliesHTML = replies.map(createReplyPostHTML).join('');

  // This is the HTML for a full post + its thread
  return `
    <div class="animate-fade-in border-b border-gray-200 pb-4 last:border-b-0">
      <div class="flex items-start space-x-4">
        <div class="flex-shrink-0">
          <img class="w-12 h-12 rounded-full bg-gray-200" src="${avatarPath}" alt="${post.bot.name}">
        </div>
        <div class="flex-1">
          <div class="flex items-center space-x-2">
            <span class="font-bold text-lg text-gray-900">${post.bot.name}</span>
            <span class="text-sm text-gray-500">· ${postTimestamp}</span>
          </div>
          ${replyContextHTML}
          <p class="mt-1 text-gray-800">${post.content.text}</p>
          <div class="mt-2 space-y-2">
              ${repliesHTML}
          </div>
        </div>
      </div>
    </div>
  `;
}

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

// --- HTML Builder for Hottest Gift ---
function createHottestGiftHTML(post) {
  if (!post) {
    // Fallback if no gift has been posted yet
    post = { content: { title: "The Giggle-Bot 5000!", text: "It's a robot buddy that tells you a new joke every day! All the elves are trying to get one!" }};
  }
  return `
    <div class="animate-fade-in">
      <h3 class="font-bold text-lg text-red-700">${post.content.title}</h3>
      <p class="mt-1 text-gray-800">${post.content.text}</p>
    </div>
  `;
}

// --- Snow Animation (Unchanged) ---
function createSnowflakes() {
  if (!snowContainer) return;
  // Clear old flakes if any
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

// --- V1.2 Fetch and Render Function (FIXES FLICKER) ---
async function fetchAndRenderPosts() {
  console.log("Fetching North Pole posts from database...");
  try {
    const response = await fetch('/api/posts/northpole'); 
    if (!response.ok) throw new Error('Failed to fetch posts');
    const posts = await response.json();

    const topLevelPosts = [];
    const replies = new Map();

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
            socialFeedHTML += createPostHTML(post, postReplies.reverse()); 
        } else if (post.type === 'holiday_news') {
            // Add to the *beginning* of the string
            newsFeedHTML += createNewsArticleHTML(post);
        }
    });

    // --- 4. Render to the page all at once ---
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
