document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);

    // --- Security Check ---
    function validateAccess() {
        const allowedHosts = ["streamflix-use.vercel.app", "localhost", "127.0.0.1"];
        const referrer = document.referrer;
        const token = urlParams.get("token");
        const validToken = sessionStorage.getItem("streamflix_access_token");

        // 1. Always allow local development and main site
        if (allowedHosts.includes(window.location.hostname)) {
            return true;
        }

        // 2. Prioritize token validation as it's more secure than referrer
        if (token && validToken && token === validToken) {
            return true;
        }

        // 3. Fallback to referrer check
        if (referrer) {
            try {
                const referrerHost = new URL(referrer).hostname;
                if (allowedHosts.includes(referrerHost)) {
                    return true;
                }
            } catch (err) {
                console.warn("Invalid referrer URL, access denied.", err);
            }
        }

        // If all checks fail, deny access
        document.body.innerHTML = `<div class="error" style="display: flex;"><h3>🚫 Access Denied</h3><p>This content can only be accessed from the main site.</p><a href="https://streamflix-use.vercel.app/" style="color: #00FF9D; text-decoration: none; margin-top: 1rem;">Go to StreamFlix</a></div>`;
        return false;
    }

    if (!validateAccess()) {
        // Clean up token if access is denied
        sessionStorage.removeItem("streamflix_access_token");
        throw new Error("Access blocked — invalid referrer or token.");
    }
    // Clean up token after successful validation
    sessionStorage.removeItem("streamflix_access_token");


    // --- State & Config ---
    const state = {
        movieId: urlParams.get('id'),
        mode: urlParams.get('mode') || 'movie',
        season: urlParams.get('season') || '1',
        episode: urlParams.get('episode') || '1',
        providers: {},
        providerKeys: [],
        currentProvider: localStorage.getItem('streamflixLastProvider') || 'vidora.su',
        currentProviderIndex: 0,
        autoplayTimer: null,
        countdownInterval: null,
        hideControlsTimer: null,
        loadTimeout: null,
    };

    const CONFIG = {
        LOAD_TIMEOUT_DURATION: 10000, // 10 seconds
        API_URL: 'https://streamflix.22afed28-f0b2-46d0-8804-c90e25c90bd4.workers.dev/',
        IMG_URL: 'https://image.tmdb.org/t/p/w300',
    };

    // --- DOM Elements ---
    const dom = {
        loadingDiv: document.getElementById('loading'),
        errorDiv: document.getElementById('error'),
        playerContainer: document.getElementById('playerContainer'),
        movieFrame: document.getElementById('movieFrame'),
        movieTitle: document.getElementById('movieTitle'),
        moviePoster: document.getElementById('moviePoster'),
        providerButtonsContainer: document.getElementById('providerButtons'),
        prevEpisodeBtn: document.getElementById('prevEpisodeBtn'),
        refreshBtn: document.getElementById('refreshBtn'),
        closePlayerBtn: document.getElementById('closePlayerBtn'),
        nextEpisodeBtn: document.getElementById('nextEpisodeBtn'),
        autoplayOverlay: document.getElementById('autoplayOverlay'),
        autoplayCountdown: document.getElementById('autoplayCountdown'),
        autoplayCancelBtn: document.getElementById('autoplayCancelBtn'),
        pipBtn: document.getElementById('pipBtn'),
        episodeLoadingOverlay: document.getElementById('episodeLoadingOverlay'),
        controls: document.querySelector('.controls'),
        loadingMessage: document.querySelector('#loading p'),
        retryBtn: document.getElementById('retryBtn'),
    };

    // --- Initialization ---
    async function init() {
        if (state.movieId) {
            await setupProviderButtons();
            await fetchMovieDetails();
            loadMovie();
        } else {
            showError();
        }

        setupEventListeners();
        setupAdBlocker();
        setupPipButton();
        setupKeyboardShortcuts();
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        dom.playerContainer.addEventListener('mousemove', showControls);
        dom.playerContainer.addEventListener('mouseleave', hideControlsImmediately);
        showControls(); // Initial call

        dom.refreshBtn.addEventListener('click', () => {
            console.log('Refreshing player with current provider...');
            loadMovie(state.currentProvider);
        });

        dom.closePlayerBtn.addEventListener('click', () => window.close());
        dom.autoplayCancelBtn.addEventListener('click', cancelAutoplay);
        dom.retryBtn.addEventListener('click', () => {
            state.currentProviderIndex = 0;
            state.currentProvider = state.providerKeys[0];
            loadMovie();
        });

        if (state.mode === 'tv') {
            dom.prevEpisodeBtn.addEventListener('click', (e) => {
                const prevEpisode = parseInt(state.episode) - 1;
                changeEpisode(prevEpisode, e.currentTarget);
            });
            dom.nextEpisodeBtn.addEventListener('click', (e) => {
                const nextEpisode = parseInt(state.episode) + 1;
                changeEpisode(nextEpisode, e.currentTarget);
            });
        }

        dom.movieFrame.addEventListener('error', () => {
            console.error(`Iframe failed to load for provider: ${state.currentProvider}`);
            handleLoadFailure(state.currentProvider);
        });
    }

    // --- Core Player Logic ---
    async function loadMovie(provider = state.currentProvider) {
        if (!state.movieId) {
            showError();
            return;
        }

        try {
            dom.episodeLoadingOverlay.style.display = 'none';
            dom.loadingDiv.style.display = 'flex';
            dom.errorDiv.style.display = 'none';
            dom.playerContainer.style.display = 'none';
            dom.loadingMessage.textContent = `Loading from ${state.providers[provider]}...`;

            updateActiveProviderButton(provider);

            const streamApiUrl = `${CONFIG.API_URL}/stream?provider=${provider}&id=${state.movieId}&mode=${state.mode}&season=${state.season}&episode=${state.episode}`;
            const response = await fetch(streamApiUrl);
            const data = await response.json();
            const streamUrl = data.url;

            if (!streamUrl) throw new Error(`Could not get stream URL for provider '${provider}'`);

            console.log(`Loading movie from provider '${provider}':`, streamUrl);
            dom.movieFrame.src = streamUrl;

            if (state.loadTimeout) clearTimeout(state.loadTimeout);

            dom.movieFrame.onload = function() {
                console.log(`Provider '${provider}' loaded successfully.`);
                localStorage.setItem('streamflixLastProvider', provider);
                clearTimeout(state.loadTimeout);
                dom.loadingDiv.style.display = 'none';
                dom.episodeLoadingOverlay.style.display = 'none';
                restoreEpisodeButtons();
                dom.playerContainer.style.display = 'block';
            };

            setTimeout(() => {
                if (dom.loadingDiv.style.display === 'flex') {
                    dom.playerContainer.style.display = 'block';
                }
            }, 3000);

            state.loadTimeout = setTimeout(() => handleLoadFailure(provider), CONFIG.LOAD_TIMEOUT_DURATION);

        } catch (error) {
            console.error('Error loading movie:', error);
            handleLoadFailure(provider);
        }
    }

    function handleLoadFailure(failedProvider) {
        console.warn(`Provider '${failedProvider}' failed to load or timed out.`);
        state.currentProviderIndex++;

        if (state.currentProviderIndex < state.providerKeys.length) {
            const nextProvider = state.providerKeys[state.currentProviderIndex];
            console.log(`Trying next provider: '${nextProvider}'`);
            state.currentProvider = nextProvider;
            loadMovie(nextProvider);
        } else {
            restoreEpisodeButtons();
            console.error("All providers failed to load.");
            showError();
        }
    }

    async function fetchMovieDetails() {
        try {
            const response = await fetch(`${CONFIG.API_URL}/${state.mode}/${state.movieId}?append_to_response=credits,videos`);
            const data = await response.json();

            if (response.ok) {
                const title = state.mode === 'movie' ? data.title : data.name;
                const year = state.mode === 'movie'
                    ? (data.release_date ? data.release_date.substring(0, 4) : '')
                    : (data.first_air_date ? data.first_air_date.substring(0, 4) : '');

                const posterPath = data.poster_path ? (data.poster_path.startsWith('http') ? data.poster_path : `${CONFIG.IMG_URL}${data.poster_path}`) : 'https://via.placeholder.com/300x450/1a1a2e/00FF9D?text=No+Image';
                dom.moviePoster.src = posterPath;
                dom.moviePoster.onerror = () => {
                    dom.moviePoster.src = 'https://via.placeholder.com/300x450/1a1a2e/00FF9D?text=No+Image';
                };
                dom.moviePoster.style.display = posterPath ? 'block' : 'none';
                dom.movieTitle.textContent = state.mode === 'movie'
                    ? `${title}${year ? ` (${year})` : ''}`
                    : `${title}${year ? ` (${year})` : ''} - S${state.season}E${state.episode}`;

                if (state.mode === 'tv' && data.episode_run_time && data.episode_run_time.length > 0) {
                    setupAutoplayTimer(data.episode_run_time[0]);
                }

                if (state.mode === 'tv') {
                    dom.nextEpisodeBtn.style.display = 'inline-flex';
                    if (parseInt(state.episode) > 1) dom.prevEpisodeBtn.style.display = 'inline-flex';
                }
            } else {
                throw new Error('Failed to fetch details');
            }
        } catch (error) {
            console.error('Error fetching movie details:', error);
            dom.movieTitle.textContent = state.mode === 'movie'
                ? `Movie: ${state.movieId}`
                : `TV Show: ${state.movieId} - S${state.season}E${state.episode}`;
        }
    }

    // --- UI & Controls ---
    function showError() {
        dom.loadingDiv.style.display = 'none';
        dom.playerContainer.style.display = 'none';
        restoreEpisodeButtons();
        dom.errorDiv.style.display = 'flex';
    }

    async function setupProviderButtons() {
        const response = await fetch(`${CONFIG.API_URL}/providers`);
        state.providers = await response.json();
        state.providerKeys = Object.keys(state.providers);
        state.currentProviderIndex = state.providerKeys.indexOf(state.currentProvider);

        if (state.currentProviderIndex === -1) {
            state.currentProviderIndex = 0;
            state.currentProvider = state.providerKeys[0];
        }

        dom.providerButtonsContainer.innerHTML = Object.entries(state.providers)
            .map(([value, name]) =>
                `<button class="provider-btn ${value === state.currentProvider ? 'active' : ''}" data-provider="${value}">${name}</button>`
            ).join('');

        dom.providerButtonsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('provider-btn')) {
                state.currentProvider = e.target.dataset.provider;
                localStorage.setItem('streamflixLastProvider', state.currentProvider);
                state.currentProviderIndex = state.providerKeys.indexOf(state.currentProvider);
                loadMovie(state.currentProvider);
            }
        });
    }

    function updateActiveProviderButton(provider) {
        document.querySelectorAll('.provider-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.provider-btn[data-provider="${provider}"]`)?.classList.add('active');
    }

    function changeEpisode(newEpisode, clickedButton) {
        if (state.mode !== 'tv' || !newEpisode || newEpisode < 1) return;

        dom.prevEpisodeBtn.disabled = true;
        dom.nextEpisodeBtn.disabled = true;
        if (clickedButton) {
            clickedButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Loading...`;
        }

        dom.episodeLoadingOverlay.style.display = 'flex';
        cancelAutoplay();

        state.episode = newEpisode;
        urlParams.set('episode', state.episode);
        history.pushState({ episode: state.episode }, '', `?${urlParams.toString()}`);

        loadMovie(state.currentProvider);
        fetchMovieDetails(); // Re-fetch details to update title
    }

    function restoreEpisodeButtons() {
        dom.prevEpisodeBtn.disabled = false;
        dom.nextEpisodeBtn.disabled = false;
        dom.prevEpisodeBtn.innerHTML = `<i class="fas fa-arrow-left"></i> Prev Episode`;
        dom.nextEpisodeBtn.innerHTML = `Next Episode <i class="fas fa-arrow-right"></i>`;
    }

    function showControls() {
        dom.controls.classList.remove('hidden');
        clearTimeout(state.hideControlsTimer);
        state.hideControlsTimer = setTimeout(() => {
            dom.controls.classList.add('hidden');
        }, 3000);
    }

    function hideControlsImmediately() {
        clearTimeout(state.hideControlsTimer);
        dom.controls.classList.add('hidden');
    }

    // --- Autoplay ---
    function setupAutoplayTimer(runtimeInMinutes) {
        if (!runtimeInMinutes || runtimeInMinutes <= 2) return;
        const runtimeInSeconds = runtimeInMinutes * 60;
        const triggerDelay = runtimeInSeconds > 300 ? runtimeInSeconds - 90 : runtimeInSeconds * 0.85;

        console.log(`Autoplay overlay will trigger in ${Math.round(triggerDelay / 60)} minutes.`);
        clearTimeout(state.autoplayTimer);
        state.autoplayTimer = setTimeout(showAutoplayOverlay, triggerDelay * 1000);
    }

    function showAutoplayOverlay() {
        dom.autoplayOverlay.classList.add('visible');
        let countdown = 15;
        dom.autoplayCountdown.textContent = countdown;

        clearInterval(state.countdownInterval);
        state.countdownInterval = setInterval(() => {
            countdown--;
            dom.autoplayCountdown.textContent = countdown;
            if (countdown <= 0) {
                clearInterval(state.countdownInterval);
                dom.nextEpisodeBtn.click();
            }
        }, 1000);
    }

    function cancelAutoplay() {
        clearTimeout(state.autoplayTimer);
        clearInterval(state.countdownInterval);
        dom.autoplayOverlay.classList.remove('visible');
        console.log("Autoplay cancelled by user.");
    }

    // --- Advanced Features (PiP, AdBlock, Keyboard) ---
    function setupPipButton() {
        if ('pictureInPictureEnabled' in document) {
            dom.pipBtn.style.display = 'inline-flex';
            dom.pipBtn.addEventListener('click', togglePictureInPicture);
        }
    }

    async function togglePictureInPicture() {
        dom.pipBtn.disabled = true;
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await dom.movieFrame.requestPictureInPicture();
            }
        } catch (error) {
            console.error("PiP Error:", error);
            alert("Could not enter Picture-in-Picture mode. Your browser might have blocked it.");
        } finally {
            dom.pipBtn.disabled = false;
        }
    }

    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            switch (e.key.toLowerCase()) {
                case 'f':
                    e.preventDefault();
                    if (!document.fullscreenElement) dom.playerContainer.requestFullscreen();
                    else document.exitFullscreen();
                    break;
                case ' ':
                    e.preventDefault();
                    dom.movieFrame.focus();
                    break;
            }
        });
    }

    function setupAdBlocker() {
        const originalWindowOpen = window.open;
        window.open = function() {
            console.log('Blocked a pop-up attempt.');
            return null;
        };
    }

    // --- Start Application ---
    init();
});