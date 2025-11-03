// public/app.js

const socialFeed = document.getElementById('social-feed');
const newsFeed = document.getElementById('news-feed');
const snowContainer = document.getElementById('snow-container');
const hottestGiftSection = document.getElementById('hottest-gift');

// --- NEW Timestamp Formatter ---
function formatTimestamp(isoString) {
    // Creates a string like: "11/2/25, 9:40 PM EST"
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
    // This line creates the correct path to your image
    const avatarPath = replyPost.bot.avatarUrl || './avatars/default.png';

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
function addPostToFeed(post, replies = []) {
  const postElement = document.createElement('div');
  postElement.className = 'animate-fade-in border-b border-gray-200 pb-4 last:border-b-0';
  
  const postTimestamp = formatTimestamp(post.timestamp);
  // This line creates the correct path to your image
  const avatarPath = post.bot.avatarUrl || './avatars/default.png';
  const replyContextHTML = post.replyContext ? `
        <div class="mb-2 p-2 border-l-2 border-gray-300">
            <p class="text-sm text-gray-500">
                Replying to <strong>${post.replyContext.handle}</strong>:
                <span class="italic">"${post.replyContext.text}"</span>
            </p>
        </div>
    ` : '';
    
  // Build all reply HTML
  const repliesHTML = replies.map(createReplyPostHTML).join('');

  postElement.innerHTML = `
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
  `;
  socialFeed.appendChild(postElement); 
}

// --- HTML Builder for News (Now Clickable) ---
function addNewsArticle(post) {
  const newsElement = document.createElement('a'); 
  newsElement.className = 'block animate-fade-in border-b border-gray-200 pb-4 last:border-b-0 hover:bg-gray-50 p-2 rounded-lg';
  newsElement.href = post.content.link || '#'; 
  newsElement.target = "_blank";
  newsElement.rel = "noopener noreferrer";
  
  newsElement.innerHTML = `
    <h3 class="font-bold text-lg text-green-700">${post.content.title}</h3>
    <p class="mt-1 text-gray-800">${post.content.text}</p>
    <span class="text-xs text-blue-600 font-medium">${post.content.source || 'Read more...'}</span>
  `;
  newsFeed.appendChild(newsElement); 
}

// --- HTML Builder for Hottest Gift (Unchanged) ---
function addHottestGift(post) {
  hottestGiftSection.innerHTML = `
    <div class="animate-fade-in">
      <h3 class="font-bold text-lg text-red-700">${post.content.title}</h3>
      <p class="mt-1 text-gray-800">${post.content.text}</p>
    </div>
  `;
}

// --- Snow Animation (Unchanged) ---
function createSnowflakes() {
  if (!snowContainer) return;
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

// --- NEW Fetch and Render Function (Builds Threads) ---
async function fetchAndRenderPosts() {
  console.log("Fetching North Pole posts from database...");
  try {
    const response = await fetch('/api/posts/northpole'); 
    if (!response.ok) throw new Error('Failed to fetch posts');
    const posts = await response.json();

    socialFeed.innerHTML = '';
    newsFeed.innerHTML = '';
    hottestGiftSection.innerHTML = '';

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

    // 2. Render special posts
    const hottestGift = topLevelPosts.find(p => p.type === 'hottest_gift');
    if (hottestGift) {
        addHottestGift(hottestGift);
    } else {
        addHottestGift({ content: { title: "The Giggle-Bot 5000!", text: "It's a robot buddy that tells you a new joke every day! All the elves are trying to get one!" }});
    }

    // 3. Render all other posts
    topLevelPosts.forEach(post => {
        if (post.type === 'post') {
            const postReplies = replies.get(post.id) || [];
            addPostToFeed(post, postReplies.reverse()); // Show oldest replies first
        } else if (post.type === 'holiday_news') {
            addNewsArticle(post);
        }
    });

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
