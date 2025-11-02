// public/app.js

// --- Get DOM Elements ---
const socialFeed = document.getElementById('social-feed');
const newsFeed = document.getElementById('news-feed');
const snowContainer = document.getElementById('snow-container');
const hottestGiftSection = document.getElementById('hottest-gift');

// --- Re-purposed HTML Builder Functions ---

function addPostToFeed(post) {
  const postElement = document.createElement('div');
  postElement.className = 'animate-fade-in border-b border-gray-200 pb-4 last:border-b-0';
  
  const postTimestamp = new Date(post.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  // Use the avatar URL from the database
  const avatarUrl = post.bot.avatarUrl || 'https://robohash.org/default.png';

  postElement.innerHTML = `
    <div class="flex items-start space-x-4">
      <div class="flex-shrink-0">
        <img class="w-12 h-12 rounded-full bg-gray-200" src="${avatarUrl}" alt="${post.bot.name}">
      </div>
      <div>
        <div class="flex items-center space-x-2">
          <span class="font-bold text-lg text-gray-900">${post.bot.name}</span>
          <span class="text-sm text-gray-500">· ${postTimestamp}</span>
        </div>
        <p class="mt-1 text-gray-800">${post.content.text}</p>
      </div>
    </div>
  `;
  socialFeed.appendChild(postElement); // Use appendChild to keep order
}

function addNewsArticle(post) {
  const newsElement = document.createElement('div');
  newsElement.className = 'animate-fade-in border-b border-gray-200 pb-4 last:border-b-0';
  
  newsElement.innerHTML = `
    <h3 class="font-bold text-lg text-green-700">${post.content.title}</h3>
    <p class="mt-1 text-gray-800">${post.content.text}</p>
  `;
  newsFeed.appendChild(newsElement); // Use appendChild to keep order
}

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

// --- NEW Fetch and Render Function ---
async function fetchAndRenderPosts() {
  console.log("Fetching North Pole posts from database...");
  try {
    // This is the only API call this file should make
    const response = await fetch('/api/posts/northpole'); 
    if (!response.ok) throw new Error('Failed to fetch posts');
    const posts = await response.json();

    // Clear old posts
    socialFeed.innerHTML = '';
    newsFeed.innerHTML = '';
    hottestGiftSection.innerHTML = '';

    // Find the newest "hottest gift" and display only that one
    const hottestGift = posts.find(p => p.type === 'hottest_gift');
    if (hottestGift) {
        addHottestGift(hottestGift);
    } else {
        // Fallback in case the bot hasn't posted one yet
        addHottestGift({ content: { title: "The Giggle-Bot 5000!", text: "It's a robot buddy that tells you a new joke every day! All the elves are trying to get one!" }});
    }

    // Render all other posts
    posts.forEach(post => {
      if (post.type === 'post') {
        addPostToFeed(post);
      } else if (post.type === 'holiday_news') {
        addNewsArticle(post);
      }
    });

  } catch (error) {
    console.error(error.message);
    // This is the only place this text should exist
    socialFeed.innerHTML = '<p>Could not connect to the workshop... The elves are checking the wiring!</p>';
  }
}

// --- Initialize Everything ---
function init() {
  console.log("Starting the North Pole Feed...");
  createSnowflakes();
  
  // Fetch posts on load, and then refresh every minute
  fetchAndRenderPosts();
  setInterval(fetchAndRenderPosts, 60 * 1000); // Refresh every 60 seconds
}

// Run the app!
init();