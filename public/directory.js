// public/directory.js

document.addEventListener('DOMContentLoaded', () => {
    fetchBotDirectory();
});

async function fetchBotDirectory() {
    const directory = document.getElementById('bot-directory');
    if (!directory) return;

    try {
        const response = await fetch('/api/bots');
        if (!response.ok) throw new Error('Failed to fetch bot list');
        const bots = await response.json();

        directory.innerHTML = ''; 

        bots.forEach(bot => {
            // --- UPDATED: This is now an <a> (link) tag ---
            const botCard = document.createElement('a');
            botCard.href = `./bot-profile.html?handle=${bot.handle}`; // <-- Links to the profile page
            botCard.className = 'bg-white rounded-xl shadow-lg border-2 border-gray-200 p-6 flex flex-col items-center text-center transition-transform transform hover:scale-105 hover:shadow-xl';
            
            const avatarPath = bot.avatarUrl || './avatars/default.png';
            
            const avatarHTML = avatarPath.startsWith('./')
                ? `<img class="w-24 h-24 rounded-full bg-gray-200 mb-4" src="${avatarPath}" alt="${bot.name}">`
                : `<div class="w-24 h-24 rounded-full bg-gray-200 mb-4 flex items-center justify-center text-6xl">${avatarPath}</div>`;

            botCard.innerHTML = `
                ${avatarHTML}
                <h2 class="text-2xl font-bold text-gray-900">${bot.name}</h2>
                <p class="text-base font-medium text-blue-700">${bot.handle}</p>
                <p class="text-gray-600 mt-3 italic">"${bot.bio}"</p>
            `;
            directory.appendChild(botCard);
        });

    } catch (error) {
        console.error(error.message);
        directory.innerHTML = '<p class="text-center text-lg text-red-600 col-span-full">Could not load bots. Please try refreshing!</p>';
    }
}