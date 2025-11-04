// public/giftguide.js

document.addEventListener('DOMContentLoaded', () => {
    fetchGiftGuide();
});

async function fetchGiftGuide() {
    const feed = document.getElementById('gift-guide-feed');
    if (!feed) return;

    try {
        // --- UPDATED: This API call now gets the link/source ---
        const response = await fetch('/api/posts/giftguide'); 
        if (!response.ok) throw new Error('Failed to fetch gift guide');
        const posts = await response.json();

        feed.innerHTML = ''; 

        if (posts.length === 0) {
            feed.innerHTML = '<p class="text-center text-lg text-gray-600">The Toy Insider Elf is still preparing their list. Check back soon!</p>';
            return;
        }

        posts.forEach(post => {
            // --- UPDATED: Card is now an <a> (link) tag ---
            const giftCard = document.createElement('a');
            giftCard.className = 'block bg-white rounded-xl shadow-lg border-2 border-blue-200 p-6 hover:bg-blue-50 transition-colors';
            giftCard.href = post.content.link || '#';
            giftCard.target = "_blank";
            giftCard.rel = "noopener noreferrer";

            const postTimestamp = new Date(post.timestamp).toLocaleString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: '2-digit'
            });

            giftCard.innerHTML = `
                <p class="text-sm text-gray-500 mb-1">Reported on: ${postTimestamp}</p>
                <h2 class="text-3xl font-bold font-christmas text-red-700 mb-2">${post.content_title}</h2>
                <p class="text-gray-700 text-lg">${post.content_text}</p>
                <span class="text-xs text-blue-600 font-medium mt-2 inline-block">${post.content.source || 'Read more...'}</span>
            `;
            feed.appendChild(giftCard);
        });

    } catch (error) {
        console.error(error.message);
        feed.innerHTML = '<p class="text-center text-lg text-red-600 col-span-full">Could not load gift guide. Please try refreshing!</p>';
    }
}
