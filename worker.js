// StreamFlix Cloudflare Worker
// This worker handles API requests and hides sensitive information

const TMDB_API_KEY = '3c93497653c0dc5b73a72ffb43516f95'; // Hidden TMDB API Key

const PROVIDER_CONFIGS = {
    'vidora.su': {
        baseUrl: 'https://vidora.su/embed/',
        format: 'iframe'
    },
    'vidsrc.me': {
        baseUrl: 'https://vidsrc.me/embed/',
        format: 'iframe'
    },
    'vidsrc.to': {
        baseUrl: 'https://vidsrc.to/embed/',
        format: 'iframe'
    },
    'embedsoap.com': {
        baseUrl: 'https://www.embedsoap.com/embed/',
        format: 'iframe'
    },
    'multiembed.mov': {
        baseUrl: 'https://multiembed.mov/directstream/',
        format: 'iframe'
    }
};

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Set CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // Route handling
        if (path.startsWith('/movie/') || path.startsWith('/tv/')) {
            return await handleTMDBRequest(path, url.search, corsHeaders);
        }

        if (path === '/search/multi') {
            return await handleTMDBRequest(path, url.search, corsHeaders);
        }

        if (path === '/providers') {
            return await handleProvidersRequest(corsHeaders);
        }

        if (path === '/stream') {
            return await handleStreamRequest(url.searchParams, corsHeaders);
        }

        // Default response
        return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Worker error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

async function handleTMDBRequest(path, searchParams, corsHeaders) {
    const tmdbUrl = `${TMDB_BASE_URL}${path}?api_key=${TMDB_API_KEY}${searchParams ? '&' + searchParams : ''}`;

    const response = await fetch(tmdbUrl);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

async function handleProvidersRequest(corsHeaders) {
    // Return provider names without exposing URLs
    const providers = {
        'vidora.su': 'Vidora',
        'vidsrc.me': 'VidSrc Me',
        'vidsrc.to': 'VidSrc To',
        'embedsoap.com': 'EmbedSoap',
        'multiembed.mov': 'MultiEmbed'
    };

    return new Response(JSON.stringify(providers), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

async function handleStreamRequest(searchParams, corsHeaders) {
    const provider = searchParams.get('provider');
    const id = searchParams.get('id');
    const mode = searchParams.get('mode') || 'movie';
    const season = searchParams.get('season') || '1';
    const episode = searchParams.get('episode') || '1';

    if (!provider || !id) {
        return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const providerConfig = PROVIDER_CONFIGS[provider];
    if (!providerConfig) {
        return new Response(JSON.stringify({ error: 'Invalid provider' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Generate stream URL based on provider and content type
    let streamUrl = '';

    if (mode === 'movie') {
        streamUrl = `${providerConfig.baseUrl}${mode}/${id}`;
    } else if (mode === 'tv') {
        streamUrl = `${providerConfig.baseUrl}${mode}/${id}/${season}/${episode}`;
    }

    return new Response(JSON.stringify({ url: streamUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}
