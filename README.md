# streamflix





in cloudflare worker script/code and the api key : 488eb36776275b8ae18600751059fb49

worker url: https://streamflix.22afed28-f0b2-46d0-8804-c90e25c90bd4.workers.dev/








export default {

&nbsp; async fetch(request, env, ctx) {

&nbsp;   // Handle CORS preflight

&nbsp;   if (request.method === 'OPTIONS') {

&nbsp;     return new Response(null, {

&nbsp;       status: 200,

&nbsp;       headers: {

&nbsp;         'Access-Control-Allow-Origin': '\*',

&nbsp;         'Access-Control-Allow-Headers': '\*',

&nbsp;         'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',

&nbsp;       },

&nbsp;     });

&nbsp;   }



&nbsp;   const url = new URL(request.url);

&nbsp;   const apiPath = url.pathname;

&nbsp;   const query = url.searchParams;



&nbsp;   // Add the API key from secret

&nbsp;   query.set('api\_key', env.TMDB\_API\_KEY);



&nbsp;   const tmdbUrl = `https://api.themoviedb.org/3${apiPath}?${query}`;



&nbsp;   try {

&nbsp;     const response = await fetch(tmdbUrl);

&nbsp;     const responseBody = await response.text();



&nbsp;     return new Response(responseBody, {

&nbsp;       status: response.status,

&nbsp;       headers: {

&nbsp;         'Access-Control-Allow-Origin': '\*',

&nbsp;         'Access-Control-Allow-Headers': '\*',

&nbsp;         'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',

&nbsp;         'Content-Type': 'application/json',

&nbsp;         ...Object.fromEntries(response.headers.entries()),

&nbsp;       },

&nbsp;     });

&nbsp;   } catch (error) {

&nbsp;     return new Response(JSON.stringify({ error: 'Failed to fetch from TMDB' }), {

&nbsp;       status: 500,

&nbsp;       headers: {

&nbsp;         'Access-Control-Allow-Origin': '\*',

&nbsp;         'Content-Type': 'application/json',

&nbsp;       },

&nbsp;     });

&nbsp;   }

&nbsp; },

};

