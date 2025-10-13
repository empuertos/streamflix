/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787 to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

/**
 * StreamFlix TMDB API Proxy Worker
 * Proxies requests to TMDB API with embedded API key
 */

// TMDB API Key
const TMDB_API_KEY = '3c93497653c0dc5b73a72ffb43516f95';

export default {
  async fetch(request, env, ctx) {
    // Handle CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Proxy TMDB API requests
    if (url.pathname.startsWith('/api/tmdb/')) {
      const tmdbPath = url.pathname.replace('/api/tmdb/', '');
      const tmdbUrl = `https://api.themoviedb.org/3/${tmdbPath}${url.search}`;

      try {
        const response = await fetch(`${tmdbUrl}&api_key=${TMDB_API_KEY}`, {
          method: request.method,
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const responseData = await response.text();
        return new Response(responseData, {
          status: response.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch from TMDB API' }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }
    }

    // Handle other requests or return a simple response
    return new Response('StreamFlix Worker is running!', {
      headers: corsHeaders,
    });
  },
};
