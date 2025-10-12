/**
 * Welcome to Cloudflare Workers!
 *
 * This worker acts as a secure proxy and API endpoint for the StreamFlix application.
 * - It proxies requests to the TMDB API, securely injecting the API key.
 * - It provides a list of streaming providers.
 * - It generates stream URLs for the selected content.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

/**
 * @typedef {Object} Env
 * @property {string} TMDB_API_KEY - The Movie Database API key
 */

const ALLOWED_ORIGINS = [
    'https://streamflix-use.vercel.app', // Your production frontend
    'http://localhost',
    'http://127.0.0.1',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    '*' // Allow all origins for deployment readiness
];

// Centralized provider configuration
const PROVIDERS = {
    'vidora.su': { name: 'Alpha', movie: 'https://vidora.su/movie/{id}', tv: 'https://vidora.su/tv/{id}/{season}/{episode}' },
    'autoembed.pro': { name: 'Bravo', movie: 'https://autoembed.pro/embed/movie/{id}', tv: 'https://autoembed.pro/embed/tv/{id}?season={season}&episode={episode}' },
    'vidrock.net': { name: 'Charlie', movie: 'https://vidrock.net/movie/{id}', tv: 'https://vidrock.net/tv/{id}/{season}/{episode}' },
    '111movies': { name: 'Delta', movie: 'https://111movies.com/movie/{id}', tv: 'https://111movies.com/tv/{id}/{season}/{episode}' },
    'vidsrc': { name: 'Echo', movie: 'https://vidsrc.cc/v2/embed/movie/{id}', tv: 'https://vidsrc.cc/v2/embed/tv/{id}/{season}/{episode}' },
    'vidsrc.to': { name: 'Foxtrot', movie: 'https://vidsrc.to/embed/movie/{id}', tv: 'https://vidsrc.to/embed/tv/{id}/{season}/{episode}' },
    'moviemaze.cc': { name: 'Golf', movie: 'https://moviemaze.cc/watch/movie/{id}', tv: 'https://moviemaze.cc/watch/tv/{id}?ep={episode}&season={season}' },
    'vidlink': { name: 'Hotel', movie: 'https://vidlink.pro/movie/{id}', tv: 'https://vidlink.pro/tv/{id}/{season}/{episode}' },
    'vixsrc.to': { name: 'India', movie: 'https://vixsrc.to/movie/{id}/', tv: 'https://vixsrc.to/tv/{id}/{season}/{episode}/' },
};

const DEFAULT_PROVIDER = 'vidora.su';

/**
 * Generates a stream URL based on the provider and content details.
 * @param {string} provider - The key of the provider (e.g., 'vidora.su').
 * @param {string} id - The TMDB ID of the movie or TV show.
 * @param {'movie'|'tv'} mode - The type of content.
 * @param {string} season - The season number (for TV shows).
 * @param {string} episode - The episode number (for TV shows).
 * @returns {string|null} The generated stream URL or null if provider is invalid.
 */
function generateStreamUrl(provider, id, mode, season, episode) {
    const providerData = PROVIDERS[provider] || PROVIDERS[DEFAULT_PROVIDER];
    if (!providerData || !providerData[mode]) {
        return null;
    }

    let url = providerData[mode];
    return url.replace('{id}', id).replace('{season}', season).replace('{episode}', episode);
}

/**
 * Responds with a list of available providers and their friendly names.
 * @param {Headers} corsHeaders - The CORS headers to apply to the response.
 */
async function handleProviders(corsHeaders) {
    const providerList = Object.entries(PROVIDERS).reduce((acc, [key, { name }]) => {
        acc[key] = name;
        return acc;
    }, {});

    return new Response(JSON.stringify(providerList), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

/**
 * Responds with the generated stream URL for the requested content.
 * @param {URL} url - The request URL object.
 * @param {Headers} corsHeaders - The CORS headers to apply to the response.
 */
async function handleStream(url, corsHeaders) {
      const query = url.searchParams;
      const provider = query.get('provider');
      const id = query.get('id');
      const mode = query.get('mode');
      const season = query.get('season');
      const episode = query.get('episode');

      if (!provider || !id || !mode) {
          return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
      }

      const streamUrl = generateStreamUrl(provider, id, mode, season, episode);
      return new Response(JSON.stringify({ url: streamUrl }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
  }

/**
 * Proxies a request to the TMDB API, injecting the API key.
 * @param {URL} url - The request URL object.
 * @param {Env} env - The worker environment with secrets.
 * @param {Headers} corsHeaders - The CORS headers to apply to the response.
 */
async function handleTmdbProxy(url, env, corsHeaders) {
      const query = url.searchParams;
      if (!env.TMDB_API_KEY) {
          return new Response(JSON.stringify({ error: 'TMDB_API_KEY not configured in worker secrets' }), { status: 500 });
      }
      query.set('api_key', env.TMDB_API_KEY);

      const tmdbUrl = `https://api.themoviedb.org/3${url.pathname}?${query}`;

      const response = await fetch(tmdbUrl);
      const newResponse = new Response(response.body, response);

      // Add CORS headers to the proxied response
      Object.entries(corsHeaders).forEach(([key, value]) => {
          newResponse.headers.set(key, value);
      });

      return newResponse;
  }

  export default {
      async fetch(request, env, ctx) {
          const requestOrigin = request.headers.get('Origin');
          let corsOrigin = '';

          // Dynamically set CORS origin based on the request
          if (requestOrigin) {
              const originUrl = new URL(requestOrigin);
              if (ALLOWED_ORIGINS.includes(originUrl.origin) || ALLOWED_ORIGINS.includes(originUrl.hostname) || ALLOWED_ORIGINS.includes('*')) {
                  corsOrigin = requestOrigin;
              }
          }

          // Allow all origins if '*' is in ALLOWED_ORIGINS
          if (ALLOWED_ORIGINS.includes('*')) {
              corsOrigin = '*';
          }

          const corsHeaders = {
              'Access-Control-Allow-Origin': corsOrigin,
              'Access-Control-Allow-Methods': 'GET, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
          };

          // Handle CORS preflight requests
          if (request.method === 'OPTIONS') {
              return new Response(null, { headers: corsHeaders });
          }

          const url = new URL(request.url);
          const path = url.pathname;

          if (path.startsWith('/providers')) {
              return handleProviders(corsHeaders);
          }

          if (path.startsWith('/stream')) {
              return handleStream(url, corsHeaders);
          }

          if (path.startsWith('/movie/') || path.startsWith('/tv/') || path.startsWith('/search/') || path.startsWith('/discover/')) {
              return handleTmdbProxy(url, env, corsHeaders);
          }

          return new Response(JSON.stringify({ error: 'Route not found' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
      },
  };
