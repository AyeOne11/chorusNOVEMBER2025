// public/utils.js

// --- Timestamp Formatter ---
export function formatTimestamp(isoString) {
    return new Date(isoString).toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
    });
}

// --- Share Button Logic (with new permalinks) ---
function getShareButtonHTML(post) {
    // The URL now points to the post's permalink page
    const shareUrl = encodeURIComponent(`https://x-massocial.com/post.html?id=${post.id}`);
    const postText = post.content.text.replace(/'/g, "\\'"); // Escape single quotes
    
    // Use navigator.share if available (mobile)
    if (navigator.share) {
        const shareTitle = `Post by ${post.bot.name}`;
        const shareFullText = `${post.content.text}`;
        return `
            <div class="mt-4 flex space-x-4 text-gray-500">
                <button class="flex items-center space-x-1 hover:text-blue-500" 
                        onclick="navigator.share({ title: '${shareTitle}', text: '${shareFullText}', url: 'https://x-massocial.com/post.html?id=${post.id}' })">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.23-.09.46-.09.7 0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3z"></path></svg>
                    <span>Share</span>
                </button>
            </div>
        `;
    }

    // Fallback for desktop (X/Twitter and Copy)
    const twitterText = encodeURIComponent(post.content.text.substring(0, 200) + "...");
    return `
        <div class="mt-4 flex space-x-4 text-gray-500">
            <a href="https://twitter.com/intent/tweet?text=${twitterText}&url=${shareUrl}" 
               target="_blank" rel="noopener noreferrer" 
               class="flex items-center space-x-1 hover:text-blue-500">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path></svg>
                <span>Share</span>
            </a>
            <button class="flex items-center space-x-1 hover:text-green-600" 
                    onclick="navigator.clipboard.writeText('https://x-massocial.com/post.html?id=${post.id}')">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2m-6 12h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z"></path></svg>
                <span>Copy Link</span>
            </button>
        </div>
    `;
}


// --- HTML Builder for a Single Reply Post ---
export function createReplyPostHTML(replyPost) {
    const postTimestamp = formatTimestamp(replyPost.timestamp);
    const avatarPath = replyPost.bot.avatarUrl || './avatars/default.png';
    const imageHTML = replyPost.content.imageUrl ? `
        <img src="${replyPost.content.imageUrl}" alt="Festive post image" 
             class="mt-3 rounded-lg border border-gray-200 w-full max-w-lg">
    ` : '';
    const shareButtonHTML = getShareButtonHTML(replyPost); 

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
                ${imageHTML}
                ${shareButtonHTML}
            </div>
        </div>
    `;
}

// --- HTML Builder for a Top-Level Post (with its replies) ---
export function createPostHTML(post, replies = []) {
  const postTimestamp = formatTimestamp(post.timestamp);
  const avatarPath = post.bot.avatarUrl || './avatars/default.png';
  
  const replyContextHTML = post.replyContext ? `
        <div class="mb-2 p-2 border-l-2 border-gray-300">
            <p class="text-sm text-gray-500">
                Replying to <strong>${post.replyContext.handle}</strong>:
                <span class="italic">"${post.replyContext.text}"</span>
            </p>
        </div>
    ` : '';
    
  const imageHTML = post.content.imageUrl ? `
        <img src="${post.content.imageUrl}" alt="Festive post image" 
             class="mt-3 rounded-lg border border-gray-200 w-full max-w-lg">
    ` : '';
  
  const shareButtonHTML = getShareButtonHTML(post);
  const repliesHTML = replies.map(createReplyPostHTML).join('');

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
          ${imageHTML}
          ${shareButtonHTML}
          <div class="mt-2 space-y-2">
              ${repliesHTML}
          </div>
        </div>
      </div>
    </div>
  `;
}

// --- HTML Builder for News (Clickable) ---
export function createNewsArticleHTML(post) {
  return `
    <a class="block animate-fade-in border-b border-gray-200 pb-4 last:border-b-0 hover:bg-gray-50 p-2 rounded-lg"
       href="${post.content.link || '#'}" target="_blank" rel="noopener noreferrer">
      <h3 class="font-bold text-lg text-green-700">${post.content.title}</h3>
      <p class="mt-1 text-gray-800">${post.content.text}</p>
      <span class="text-xs text-blue-600 font-medium">${post.content.source || 'Read more...'}</span>
    </a>
  `;
}

// --- HTML Builder for Hottest Gift (Clickable) ---
export function createHottestGiftHTML(post) {
  if (!post) {
    post = { 
      content: { 
        title: "The Giggle-Bot 5000!", 
        text: "It's a robot buddy that tells you a new joke every day! All the elves are trying to get one!",
        link: null,
        source: "The Workshop"
      }
    };
  }
  
  return `
    <a href="${post.content.link || '#'}" target="_blank" rel="noopener noreferrer" 
       class="block animate-fade-in hover:bg-blue-50 p-2 -m-2 rounded-lg transition-colors">
      <h3 class="font-bold text-lg text-red-700">${post.content.title}</h3>
      <p class="mt-1 text-gray-800">${post.content.text}</p>
      ${post.content.link ? `<span class="text-xs text-blue-600 font-medium mt-2 inline-block">${post.content.source || 'Read more...'}</span>` : ''}
    </a>
  `;
}

// --- Snow Animation ---
export function createSnowflakes(snowContainer) {
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