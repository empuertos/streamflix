/**
 * StreamFlix Cloudflare Worker - ES Module Format
 * Proxies TMDB API requests for the StreamFlix application
 *
 * To deploy:
 * 1. Go to Cloudflare Workers dashboard
 * 2. Create new worker
 * 3. Replace the code with this file
 * 4. Add TMDB_API_KEY to environment variables
 * 5. Deploy
 */

// TMDB API Configuration
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

/**
 * Main fetch handler - ES Module Export
 */
export default {
  async fetch(request, env, ctx) {
    return await handleRequest(request, env);
  },
};

/**
 * Handle incoming requests - ES Module Format
 */
async function handleRequest(request, env) {
  const url = new URL(request.url);

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    // Route requests based on path
    let response;

    if (url.pathname.startsWith('/movie/popular')) {
      response = await fetchPopularMovies(url, env);
    } else if (url.pathname.startsWith('/tv/popular')) {
      response = await fetchPopularTVShows(url, env);
    } else if (url.pathname.startsWith('/search/movie')) {
      response = await searchMovies(url, env);
    } else if (url.pathname.startsWith('/search/tv')) {
      response = await searchTVShows(url, env);
    } else if (url.pathname.startsWith('/movie/')) {
      response = await fetchMovieDetails(url, env);
    } else if (url.pathname.startsWith('/tv/')) {
      response = await fetchTVShowDetails(url, env);
    } else if (url.pathname.startsWith('/stream/')) {
      response = await generateStreamUrl(url, env);
    } else if (url.pathname.startsWith('/providers')) {
      response = await getProviderSelectionHTML(url, env);
    } else if (url.pathname.startsWith('/provider-options')) {
      response = await getProviderOptionsHTML(url, env);
    } else if (url.pathname.startsWith('/video-modal')) {
      response = await getVideoModalHTML(url, env);
    } else {
      return new Response('Not Found', { status: 404 });
    }

    // Add CORS headers to all responses
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
    });

  } catch (error) {
    console.error('Worker error:', error);
    return new Response('Internal Server Error', {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
    });
  }
}

/**
 * Fetch popular movies from TMDB - ES Module Format
 */
async function fetchPopularMovies(url, env) {
  const page = url.searchParams.get('page') || '1';
  const tmdbUrl = `${TMDB_BASE_URL}/movie/popular?api_key=${env.TMDB_API_KEY}&page=${page}`;

  const response = await fetch(tmdbUrl);
  const data = await response.json();

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Generate streaming URL for different providers - ES Module Format
 */
async function generateStreamUrl(url, env) {
  const urlObj = new URL(url);
  const provider = urlObj.searchParams.get('provider');
  const contentType = urlObj.searchParams.get('type'); // 'movie' or 'tv'
  const contentId = urlObj.searchParams.get('id');
  const season = urlObj.searchParams.get('season');
  const episode = urlObj.searchParams.get('episode');

  if (!provider || !contentType || !contentId) {
    return new Response('Missing required parameters: provider, type, id', { status: 400 });
  }

  let streamUrl;

  if (contentType === 'movie') {
    streamUrl = generateMovieUrl(provider, contentId);
  } else if (contentType === 'tv') {
    if (!season || !episode) {
      return new Response('Missing season/episode for TV show', { status: 400 });
    }
    streamUrl = generateTVUrl(provider, contentId, season, episode);
  } else {
    return new Response('Invalid content type. Must be movie or tv', { status: 400 });
  }

  return new Response(JSON.stringify({
    provider: provider,
    url: streamUrl,
    contentType: contentType,
    contentId: contentId,
    season: season,
    episode: episode
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Generate movie streaming URL for specific provider
 */
function generateMovieUrl(provider, movieId) {
  const urls = {
    '111movies': `https://111movies.com/movie/${movieId}`,
    'vidsrc': `https://vidsrc.cc/v2/embed/movie/${movieId}`,
    'autoembed.pro': `https://autoembed.pro/embed/movie/${movieId}`,
    'moviemaze.cc': `https://moviemaze.cc/watch/movie/${movieId}`,
    'videasy': `https://player.videasy.net/movie/${movieId}`,
    'vidfast': `https://vidfast.pro/movie/${movieId}`,
    'vidking.net': `https://www.vidking.net/embed/movie/${movieId}`,
    'vidlink': `https://vidlink.pro/movie/${movieId}`,
    'vidora.su': `https://vidora.su/movie/${movieId}`,
    'vidplus.to': `https://player.vidplus.to/embed/movie/${movieId}`,
    'vidsrc.to': `https://vidsrc.to/embed/movie/${movieId}`,
    'vixsrc.to': `https://vixsrc.to/movie/${movieId}/`
  };

  return urls[provider] || `https://vidsrc.to/embed/movie/${movieId}`;
}

/**
 * Generate TV show streaming URL for specific provider
 */
function generateTVUrl(provider, tvId, season, episode) {
  const urls = {
    '111movies': `https://111movies.com/tv/${tvId}/${season}/${episode}`,
    'vidsrc': `https://vidsrc.cc/v2/embed/tv/${tvId}/${season}/${episode}`,
    'autoembed.pro': `https://autoembed.pro/embed/tv/${tvId}&season=${season}&episode=${episode}`,
    'moviemaze.cc': `https://moviemaze.cc/watch/tv/${tvId}?ep=${episode}&season=${season}`,
    'videasy': `https://player.videasy.net/tv/${tvId}/${season}/${episode}`,
    'vidfast': `https://vidfast.pro/tv/${tvId}/${season}/${episode}`,
    'vidking.net': `https://www.vidking.net/embed/tv/${tvId}/${season}/${episode}`,
    'vidlink': `https://vidlink.pro/tv/${tvId}/${season}/${episode}`,
    'vidora.su': `https://vidora.su/tv/${tvId}/${season}/${episode}`,
    'vidplus.to': `https://player.vidplus.to/embed/tv/${tvId}/${season}/${episode}`,
    'vidsrc.to': `https://vidsrc.to/embed/tv/${tvId}/${season}/${episode}`,
    'vixsrc.to': `https://vixsrc.to/tv/${tvId}/${season}/${episode}/`
  };

  return urls[provider] || `https://vidsrc.to/embed/tv/${tvId}/${season}/${episode}`;
}

/**
 * Get provider selection HTML interface - ES Module Format
 */
async function getProviderSelectionHTML(url, env) {
  const html = `
    <div class="provider-button-container" id="providerButtonContainer" style="display: none;">
        <button class="provider-btn" id="providerBtn" style="
            background-color: var(--primary);
            color: var(--secondary);
            border: none;
            border-radius: 30px;
            padding: 0.8rem 1.5rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            font-size: 1rem;
            margin: 0.5rem;
        ">
            <i class="fas fa-cog"></i> Change Provider
        </button>
    </div>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}

/**
 * Get provider selection options HTML - ES Module Format
 */
async function getProviderOptionsHTML(url, env) {
  const html = `
    <div class="provider-options-modal" id="providerOptionsModal" style="
        position: absolute;
        top: 60px;
        right: 20px;
        background: var(--dark);
        border: 2px solid var(--primary);
        border-radius: 15px;
        padding: 1rem;
        min-width: 200px;
        z-index: 1000;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    ">
        <h4 style="color: var(--primary); margin-bottom: 1rem; text-align: center;">Select Provider</h4>
        <div class="provider-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; max-height: 300px; overflow-y: auto;">
            <button class="provider-option-btn" data-provider="111movies" style="background: var(--secondary); color: var(--text); border: 1px solid var(--primary); padding: 0.5rem; border-radius: 8px; cursor: pointer; transition: all 0.3s; font-size: 0.8rem;">111Movies</button>
            <button class="provider-option-btn" data-provider="autoembed.pro" style="background: var(--secondary); color: var(--text); border: 1px solid var(--primary); padding: 0.5rem; border-radius: 8px; cursor: pointer; transition: all 0.3s; font-size: 0.8rem;">AutoEmbed</button>
            <button class="provider-option-btn" data-provider="moviemaze.cc" style="background: var(--secondary); color: var(--text); border: 1px solid var(--primary); padding: 0.5rem; border-radius: 8px; cursor: pointer; transition: all 0.3s; font-size: 0.8rem;">MovieMaze</button>
            <button class="provider-option-btn" data-provider="videasy" style="background: var(--secondary); color: var(--text); border: 1px solid var(--primary); padding: 0.5rem; border-radius: 8px; cursor: pointer; transition: all 0.3s; font-size: 0.8rem;">VideoEasy</button>
            <button class="provider-option-btn" data-provider="vidfast" style="background: var(--secondary); color: var(--text); border: 1px solid var(--primary); padding: 0.5rem; border-radius: 8px; cursor: pointer; transition: all 0.3s; font-size: 0.8rem;">Vidfast</button>
            <button class="provider-option-btn" data-provider="vidking.net" style="background: var(--secondary); color: var(--text); border: 1px solid var(--primary); padding: 0.5rem; border-radius: 8px; cursor: pointer; transition: all 0.3s; font-size: 0.8rem;">VidKing</button>
            <button class="provider-option-btn" data-provider="vidlink" style="background: var(--secondary); color: var(--text); border: 1px solid var(--primary); padding: 0.5rem; border-radius: 8px; cursor: pointer; transition: all 0.3s; font-size: 0.8rem;">VidLink</button>
            <button class="provider-option-btn" data-provider="vidora.su" style="background: var(--secondary); color: var(--text); border: 1px solid var(--primary); padding: 0.5rem; border-radius: 8px; cursor: pointer; transition: all 0.3s; font-size: 0.8rem;">Vidora</button>
            <button class="provider-option-btn" data-provider="vidplus.to" style="background: var(--secondary); color: var(--text); border: 1px solid var(--primary); padding: 0.5rem; border-radius: 8px; cursor: pointer; transition: all 0.3s; font-size: 0.8rem;">VidPlus</button>
            <button class="provider-option-btn" data-provider="vidsrc" style="background: var(--secondary); color: var(--text); border: 1px solid var(--primary); padding: 0.5rem; border-radius: 8px; cursor: pointer; transition: all 0.3s; font-size: 0.8rem;">Vidsrc</button>
            <button class="provider-option-btn" data-provider="vidsrc.to" style="background: var(--secondary); color: var(--text); border: 1px solid var(--primary); padding: 0.5rem; border-radius: 8px; cursor: pointer; transition: all 0.3s; font-size: 0.8rem;">Vidsrc.to</button>
            <button class="provider-option-btn" data-provider="vixsrc.to" style="background: var(--secondary); color: var(--text); border: 1px solid var(--primary); padding: 0.5rem; border-radius: 8px; cursor: pointer; transition: all 0.3s; font-size: 0.8rem;">VixSrc</button>
        </div>
        <button class="close-provider-options" id="closeProviderOptions" style="
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 0.5rem 1rem;
            cursor: pointer;
            width: 100%;
            margin-top: 1rem;
            font-weight: 600;
        ">Close</button>
    </div>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}

/**
 * Fetch popular TV shows from TMDB - ES Module Format
 */
async function fetchPopularTVShows(url, env) {
  const page = url.searchParams.get('page') || '1';
  const tmdbUrl = `${TMDB_BASE_URL}/tv/popular?api_key=${env.TMDB_API_KEY}&page=${page}`;

  const response = await fetch(tmdbUrl);
  const data = await response.json();

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Search movies from TMDB - ES Module Format
 */
async function searchMovies(url, env) {
  const query = url.searchParams.get('query');
  const page = url.searchParams.get('page') || '1';

  if (!query) {
    return new Response('Missing query parameter', { status: 400 });
  }

  const encodedQuery = encodeURIComponent(query);
  const tmdbUrl = `${TMDB_BASE_URL}/search/movie?api_key=${env.TMDB_API_KEY}&query=${encodedQuery}&page=${page}`;

  const response = await fetch(tmdbUrl);
  const data = await response.json();

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Search TV shows from TMDB - ES Module Format
 */
async function searchTVShows(url, env) {
  const query = url.searchParams.get('query');
  const page = url.searchParams.get('page') || '1';

  if (!query) {
    return new Response('Missing query parameter', { status: 400 });
  }

  const encodedQuery = encodeURIComponent(query);
  const tmdbUrl = `${TMDB_BASE_URL}/search/tv?api_key=${env.TMDB_API_KEY}&query=${encodedQuery}&page=${page}`;

  const response = await fetch(tmdbUrl);
  const data = await response.json();

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Fetch detailed movie information including credits - ES Module Format
 */
async function fetchMovieDetails(url, env) {
  const movieId = url.pathname.split('/movie/')[1]?.split('?')[0];

  if (!movieId) {
    return new Response('Missing movie ID', { status: 400 });
  }

  const tmdbUrl = `${TMDB_BASE_URL}/movie/${movieId}?api_key=${env.TMDB_API_KEY}&append_to_response=credits,external_ids`;

  const response = await fetch(tmdbUrl);
  const data = await response.json();

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Fetch detailed TV show information including credits - ES Module Format
 */
async function fetchTVShowDetails(url, env) {
  const tvId = url.pathname.split('/tv/')[1]?.split('?')[0];

  if (!tvId) {
    return new Response('Missing TV show ID', { status: 400 });
  }

  const tmdbUrl = `${TMDB_BASE_URL}/tv/${tvId}?api_key=${env.TMDB_API_KEY}&append_to_response=credits,external_ids`;

  const response = await fetch(tmdbUrl);
  const data = await response.json();

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Get video modal HTML - ES Module Format
 */
async function getVideoModalHTML(url, env) {
  const html = `
    <!-- Video Player Modal -->
    <div class="video-modal" id="videoModal">
        <div class="video-modal-content">
            <div class="video-header">
                <div class="video-title" id="videoTitle">Now Playing</div>
                <div class="provider-buttons" id="providerButtons">
                    <!-- No-ads providers first -->
                    <button class="provider-btn-small" data-provider="vidsrc">Alpha</button>
                    <button class="provider-btn-small" data-provider="vidsrc.to">Bravo</button>
                    <button class="provider-btn-small" data-provider="vidlink">Charlie</button>
                    <button class="provider-btn-small" data-provider="vidplus.to">Delta</button>
                    <button class="provider-btn-small" data-provider="vixsrc.to">Echo</button>
                    <!-- Providers with ads last -->
                    <button class="provider-btn-small" data-provider="111movies">Foxtrot</button>
                    <button class="provider-btn-small" data-provider="autoembed.pro">Golf</button>
                    <button class="provider-btn-small" data-provider="moviemaze.cc">Hotel</button>
                    <button class="provider-btn-small" data-provider="videasy">India</button>
                    <button class="provider-btn-small" data-provider="vidfast">Juliet</button>
                    <button class="provider-btn-small" data-provider="vidking.net">Kilo</button>
                    <button class="provider-btn-small" data-provider="vidora.su">Lima</button>
                </div>
                <div class="video-quality">HD</div>
                <button class="close-video" id="closeVideo">&times;</button>
            </div>
            <div class="video-player">
                <div class="video-loading" id="videoLoading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>Loading stream...</span>
                </div>
                <iframe class="stream-iframe" id="streamIframe" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"
                    referrerpolicy="strict-origin-when-cross-origin">
                </iframe>
            </div>
        </div>
    </div>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}


