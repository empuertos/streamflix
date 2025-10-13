// Configuration for StreamFlix application
const CONFIG = {
    // Primary API endpoint - always use Cloudflare Worker for security
    API_URLS: [
        'https://streamflix.22afed28-f0b2-46d0-8804-c90e25c90bd4.workers.dev',
        // Add alternative endpoints here as fallbacks
        // 'https://your-backup-api.workers.dev',
        // 'http://localhost:8787'  // For local development
    ],

    // TMDB API Key for direct access (fallback if worker fails)
    TMDB_API_KEY: 'your_tmdb_api_key_here', // Fallback API key

    // TMDB Image URLs
    IMG_URL: 'https://streamflix.22afed28-f0b2-46d0-8804-c90e25c90bd4.workers.dev/t/p/w500',
    IMG_URL_ORIGINAL: 'https://streamflix.22afed28-f0b2-46d0-8804-c90e25c90bd4.workers.dev/t/p/original',
    IMG_URL_W780: 'https://streamflix.22afed28-f0b2-46d0-8804-c90e25c90bd4.workers.dev/t/p/w780',

    // App settings
    APP_NAME: 'StreamFlix',
    DEFAULT_THEME: 'dark',
    MAX_HISTORY_ITEMS: 10,
    HERO_SLIDESHOW_INTERVAL: 5000,

    // Feature flags
    FEATURES: {
        ENABLE_PWA: true,
        ENABLE_SEARCH_SUGGESTIONS: true,
        ENABLE_GENRE_FILTER: true,
        ENABLE_FAVORITES: true,
        ENABLE_WATCH_HISTORY: true
    },

    // Maintenance mode
    MAINTENANCE_MODE: false, // Set to true to enable maintenance mode
    MAINTENANCE_MESSAGE: "We're currently performing some scheduled maintenance to improve your experience. StreamFlix will be back online shortly.",
    MAINTENANCE_ESTIMATED_TIME: "Soon"
};

// Get the best available API URL
function getApiUrl() {
    // In a real application, you might want to test each URL
    // For now, return the first one (primary)
    return CONFIG.API_URLS[0];
}

// Export for use in other files
window.STREAMFLIX_CONFIG = CONFIG;
window.getApiUrl = getApiUrl;
