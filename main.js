document.addEventListener('DOMContentLoaded', () => {
    // Configuration from config.js, de-structured for easy access
    const { API_URLS, IMG_URL, IMG_URL_W780, IMG_URL_ORIGINAL, HERO_SLIDESHOW_INTERVAL, FEATURES, TMDB_API_KEY } = window.STREAMFLIX_CONFIG;
    const API_URL = API_URLS[0]; // Use the primary API URL

    // API key is now handled securely by the Cloudflare Worker
    const API_KEY_PARAM = '';

    // Application State
    const state = {
        currentPage: 1,
        currentQuery: '',
        currentGenre: '',
        isFetching: false,
        currentMode: 'movie',
        currentItem: null,
        currentSeason: 1,
        currentEpisode: 1,
        tvSeasons: [],
        heroMovies: [],
        currentHeroIndex: 0,
    };

    // DOM Elements Cache
    const dom = {
        contentGrid: document.getElementById('contentGrid'),
        latestGrid: document.getElementById('latestGrid'),
        loadingElement: document.getElementById('loading'),
        searchInput: document.getElementById('searchInput'),
        searchBtn: document.getElementById('searchBtn'),
        movieModeBtn: document.getElementById('movieMode'),
        tvModeBtn: document.getElementById('tvMode'),
        loadMoreBtn: document.getElementById('loadMore'),
        detailModal: document.getElementById('detailModal'),
        closeModalBtn: document.getElementById('closeModal'),
        modalTitle: document.getElementById('modalTitle'),
        modalPoster: document.getElementById('modalPoster'),
        modalDate: document.getElementById('modalDate'),
        modalRating: document.getElementById('modalRating'),
        modalLanguage: document.getElementById('modalLanguage'),
        modalRuntime: document.getElementById('modalRuntime'),
        modalGenres: document.getElementById('modalGenres'),
        modalDirector: document.getElementById('modalDirector'),
        modalOverview: document.getElementById('modalOverview'),
        seasonSelector: document.getElementById('seasonSelector'),
        seasonSelect: document.getElementById('seasonSelect'),
        episodeSelect: document.getElementById('episodeSelect'),
        castContainer: document.getElementById('castContainer'),
        castGrid: document.getElementById('castGrid'),
        watchBtn: document.getElementById('watchBtn'),
        favoriteBtn: document.getElementById('favoriteBtn'),
        trailerBtn: document.getElementById('trailerBtn'),
        trailerModal: document.getElementById('trailerModal'),
        trailerPlayer: document.getElementById('trailerPlayer'),
        closeTrailerModal: document.getElementById('closeTrailerModal'),
        shareBtn: document.getElementById('shareBtn'),
        startWatchingBtn: document.getElementById('startWatchingBtn'),
        moreInfoBtn: document.getElementById('moreInfoBtn'),
        settingsBtn: document.getElementById('settingsBtn'),
        settingsModal: document.getElementById('settingsModal'),
        closeSettingsModal: document.getElementById('closeSettingsModal'),
        themeSwitch: document.getElementById('themeSwitch'),
        clearHistoryBtn: document.getElementById('clearHistoryBtn'),
        clearFavoritesBtn: document.getElementById('clearFavoritesBtn'),
        backToTopBtn: document.getElementById('backToTopBtn'),
        searchSuggestions: document.getElementById('searchSuggestions'),
        genreButtons: document.getElementById('genreButtons'),
        hero: document.querySelector('.hero'),
        heroTitle: document.getElementById('heroTitle'),
        heroDesc: document.getElementById('heroDesc'),
    };

    let activeElementBeforeModal;
    let heroInterval;
    let deferredPrompt;

    // --- Retry Utility ---
    async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                if (attempt === maxRetries) {
                    throw error;
                }
                const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000; // Exponential backoff with jitter
                console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // --- Genres Data ---
    const genres = [
        { id: "", name: "All" }, { id: 28, name: "Action" }, { id: 12, name: "Adventure" },
        { id: 16, name: "Animation" }, { id: 35, name: "Comedy" }, { id: 80, name: "Crime" },
        { id: 99, name: "Documentary" }, { id: 18, name: "Drama" }, { id: 10751, name: "Family" },
        { id: 14, name: "Fantasy" }, { id: 36, name: "History" }, { id: 27, name: "Horror" },
        { id: 10402, name: "Music" }, { id: 9648, name: "Mystery" }, { id: 10749, name: "Romance" },
        { id: 878, name: "Science Fiction" }, { id: 10770, name: "TV Movie" }, { id: 53, name: "Thriller" },
        { id: 10752, name: "War" }, { id: 37, name: "Western" }];

    // --- Initialization ---
    function init() {
        const urlParams = new URLSearchParams(window.location.search);
        const shareId = urlParams.get('id');
        const shareMode = urlParams.get('mode');

        setupEventListeners();
        applyInitialTheme();
        populateGenreButtons();

        if (shareId && shareMode) {
            state.currentMode = shareMode;
            showDetails(shareId);
        } else {
            fetchContent();
            fetchLatest();
        }

        fetchHeroMovies();
        displayFavorites();
        displayWatchHistory();

        if ('serviceWorker' in navigator && FEATURES.ENABLE_PWA) {
            navigator.serviceWorker.register('/worker.js')
                .then(reg => console.log('Service Worker registered successfully.'))
                .catch(err => console.error('Service Worker registration failed:', err));
        }
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        dom.searchBtn.addEventListener('click', handleSearch);
        dom.searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') handleSearch();
        });
        dom.searchInput.addEventListener('input', handleSearchInput);
        dom.searchInput.addEventListener('blur', () => setTimeout(hideSuggestions, 200));

        dom.movieModeBtn.addEventListener('click', () => switchMode('movie'));
        dom.tvModeBtn.addEventListener('click', () => switchMode('tv'));

        dom.genreButtons.addEventListener('click', handleGenreClick);

        dom.settingsBtn.addEventListener('click', () => openModal(dom.settingsModal));
        dom.closeSettingsModal.addEventListener('click', () => closeModalWindow(dom.settingsModal));

        dom.themeSwitch.addEventListener('change', toggleTheme);

        dom.loadMoreBtn.addEventListener('click', loadMore);
        dom.closeModalBtn.addEventListener('click', () => closeModalWindow(dom.detailModal));

        dom.closeTrailerModal.addEventListener('click', () => closeModalWindow(dom.trailerModal));

        dom.watchBtn.addEventListener('click', () => {
            updateWatchHistory();
            openExternalPlayer();
        });

        dom.clearHistoryBtn.addEventListener('click', () => {
            clearWatchHistory();
            alert('Watch history cleared.');
        });

        dom.clearFavoritesBtn.addEventListener('click', () => {
            clearFavorites();
            alert('Favorites cleared.');
        });

        dom.favoriteBtn.addEventListener('click', toggleFavorite);
        dom.shareBtn.addEventListener('click', handleShare);

        dom.seasonSelect.addEventListener('change', (e) => {
            state.currentSeason = parseInt(e.target.value);
            updateEpisodesForSeason(state.currentSeason);
        });

        dom.episodeSelect.addEventListener('change', (e) => {
            state.currentEpisode = parseInt(e.target.value);
        });

        dom.startWatchingBtn.addEventListener('click', () => {
            if (state.heroMovies.length > 0) {
                openExternalPlayer(state.heroMovies[state.currentHeroIndex]);
            }
        });

        dom.moreInfoBtn.addEventListener('click', () => {
            if (state.heroMovies.length > 0) {
                state.currentMode = 'movie';
                showDetails(state.heroMovies[state.currentHeroIndex].id);
            }
        });

        window.addEventListener('scroll', handleScroll);
        dom.backToTopBtn.addEventListener('click', scrollToTop);

        document.querySelectorAll('.horizontal-scroll-container').forEach(setupScrollArrows);

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            if (isMobile() && FEATURES.ENABLE_PWA) {
                console.log('`beforeinstallprompt` event was fired.');
            }
        });
    }

    // --- Search ---
    function handleSearchInput() {
        const query = dom.searchInput.value.trim();
        if (query.length === 0) {
            state.currentQuery = '';
            state.currentPage = 1;
            dom.contentGrid.innerHTML = '';
            fetchContent();
            hideSuggestions();
            return;
        }
        if (FEATURES.ENABLE_SEARCH_SUGGESTIONS) {
            fetchSuggestions(query);
        }
    }

    async function fetchSuggestions(query) {
        try {
            await retryWithBackoff(async () => {
                const endpoint = `${API_URL}/search/multi${API_KEY_PARAM}&query=${encodeURIComponent(query)}&page=1`;
                const response = await fetch(endpoint);
                if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                const data = await response.json();
                displaySuggestions(data.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv').slice(0, 10));
            });
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        }
    }

    function displaySuggestions(items) {
        dom.searchSuggestions.innerHTML = '';
        if (items.length === 0) {
            hideSuggestions();
            return;
        }
        items.forEach(item => {
            const div = document.createElement('div');
            const itemMode = item.media_type;
            div.className = 'search-suggestion-item';
            const title = itemMode === 'movie' ? item.title : item.name;
            const year = itemMode === 'movie'
                ? (item.release_date ? item.release_date.substring(0, 4) : '')
                : (item.first_air_date ? item.first_air_date.substring(0, 4) : '');
            div.innerHTML = `${title} (${year}) <span style="font-size: 0.8em; color: #aaa; margin-left: 5px;">${itemMode === 'tv' ? 'TV' : 'Movie'}</span>`;
            div.addEventListener('click', () => {
                hideSuggestions();
                state.currentMode = itemMode;
                showDetails(item.id);
            });
            dom.searchSuggestions.appendChild(div);
        });
        dom.searchSuggestions.style.display = 'block';
    }

    function hideSuggestions() {
        dom.searchSuggestions.style.display = 'none';
    }

    function handleSearch() {
        state.currentQuery = dom.searchInput.value.trim();
        state.currentPage = 1;
        state.currentGenre = '';
        dom.contentGrid.innerHTML = '';
        hideSuggestions();

        document.querySelectorAll('.genre-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.genre === '');
        });

        fetchContent();
    }

    // --- Mode & Genre Switching ---
    function switchMode(mode) {
        state.currentMode = mode;
        state.currentPage = 1;
        state.currentGenre = '';
        dom.contentGrid.innerHTML = '';

        dom.movieModeBtn.classList.toggle('active', mode === 'movie');
        dom.tvModeBtn.classList.toggle('active', mode === 'tv');

        document.querySelectorAll('.genre-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.genre === '');
        });

        fetchContent();
        fetchLatest();
    }

    function handleGenreClick(e) {
        if (e.target.classList.contains('genre-btn')) {
            const genreId = e.target.dataset.genre;
            switchGenre(genreId);
        }
    }

    function switchGenre(genre) {
        state.currentGenre = genre;
        state.currentPage = 1;
        dom.contentGrid.innerHTML = '';

        document.querySelectorAll('.genre-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.genre === genre);
        });

        fetchContent();
    }

    // --- API Fetching & Content Display ---
    async function fetchContent() {
        if (state.isFetching) return;
        state.isFetching = true;
        dom.loadMoreBtn.style.display = 'none';

        try {
            await retryWithBackoff(async () => {
                let endpoint;
                const baseParams = `page=${state.currentPage}${state.currentGenre ? `&with_genres=${state.currentGenre}` : ''}`;

                if (state.currentQuery) {
                    if (state.currentPage === 1) displaySkeletons();
                    endpoint = `${API_URL}/search/multi${API_KEY_PARAM}&query=${encodeURIComponent(state.currentQuery)}&page=${state.currentPage}`;
                } else {
                    if (state.currentPage === 1) displaySkeletons();
                    const discoverOrPopular = state.currentGenre ? 'discover' : 'popular';
                    endpoint = `${API_URL}/${state.currentMode === 'movie' ? 'movie' : 'tv'}/${discoverOrPopular}${API_KEY_PARAM}&${baseParams}`;
                }

                const response = await fetch(endpoint);
                if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                const data = await response.json();

                if (state.currentPage === 1) {
                    dom.contentGrid.innerHTML = '';
                }

                appendContent(data.results);

                if (data.page < data.total_pages) {
                    dom.loadMoreBtn.style.display = 'inline-block';
                }
            });
        } catch (error) {
            console.error('Error fetching content:', error);
            dom.contentGrid.innerHTML = '<p>Error loading content. Please check your internet connection and try again in a few minutes.</p><button id="retryBtn" class="retry-btn">Retry</button>';
            document.getElementById('retryBtn').addEventListener('click', () => {
                state.currentPage = 1;
                dom.contentGrid.innerHTML = '';
                fetchContent();
            });
        } finally {
            state.isFetching = false;
        }
    }

    async function fetchLatest() {
        try {
            await retryWithBackoff(async () => {
                const endpoint = state.currentMode === 'movie'
                    ? `${API_URL}/movie/now_playing${API_KEY_PARAM}&page=1`
                    : `${API_URL}/tv/airing_today${API_KEY_PARAM}&page=1`;

                const response = await fetch(endpoint);
                if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                const data = await response.json();

                if (data.results) {
                    displayContent(data.results.slice(0, 10), dom.latestGrid);
                }
            });
        } catch (error) {
            console.error('Error fetching latest content:', error);
            if (dom.latestGrid) {
                dom.latestGrid.innerHTML = '<p>Error loading latest releases. Please check your internet connection and try again in a few minutes.</p>';
            }
        }
    }

    function displayContent(items, gridElement = dom.contentGrid, isHistory = false) {
        if (items.length === 0) {
            if (!isHistory) gridElement.innerHTML = '<p>No results found. Try a different search.</p>';
            return;
        }

        const fragment = document.createDocumentFragment();
        items.forEach((item, index) => {
            fragment.appendChild(createContentCard(item, index));
        });

        gridElement.innerHTML = '';
        gridElement.appendChild(fragment);
    }

    function appendContent(items, gridElement = dom.contentGrid) {
        const fragment = document.createDocumentFragment();
        items.forEach((item, index) => {
            fragment.appendChild(createContentCard(item, (state.currentPage - 1) * 20 + index));
        });
        gridElement.appendChild(fragment);
    }

    function createContentCard(item, index) {
        const card = document.createElement('div');
        card.className = 'content-card';
        const itemMode = item.media_type || item.mode || state.currentMode;
        const title = itemMode === 'movie' ? item.title : item.name;
        const date = itemMode === 'movie' ? item.release_date : item.first_air_date;
        const posterPath = item.poster_path ? (item.poster_path.startsWith('http') ? item.poster_path : `${IMG_URL}${item.poster_path}`) : 'https://via.placeholder.com/300x450/1a1a2e/00FF9D?text=No+Image';

        card.style.animationDelay = `${index * 50}ms`;

        card.innerHTML = `
            <img src="${posterPath}" alt="${title}" class="card-img" loading="lazy" decoding="async" width="220" height="330" onerror="this.src='https://via.placeholder.com/300x450/1a1a2e/00FF9D?text=No+Image'">
            <div class="card-content">
                <h3 class="card-title" title="${title}">${title}</h3>
                <div class="card-info">
                    <span>${date ? date.substring(0, 4) : 'N/A'}</span>
                    <span class="card-rating"><i class="fas fa-star"></i> ${item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}</span>
                </div>
            </div>
        `;

        card.addEventListener('click', () => {
            state.currentMode = itemMode;
            showDetails(item.id);
        });

        return card;
    }

    function loadMore() {
        state.currentPage++;
        fetchContent();
    }

    // --- Detail Modal ---
    async function showDetails(itemId) {
        try {
            await retryWithBackoff(async () => {
                const endpoint = `${API_URL}/${state.currentMode}/${itemId}${API_KEY_PARAM}&append_to_response=credits,external_ids,videos`;
                const response = await fetch(endpoint);
                if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                const item = await response.json();

                state.currentItem = item;

                updateModalUI(item);
                renderCast(item.credits?.cast || []);
                setupTrailerButton(item.videos?.results || []);

                openModal(dom.detailModal);
                updateFavoriteButton();
            });
        } catch (error) {
            console.error('Error showing details:', error);
            alert('Could not load details for this item. Please check your internet connection and try again in a few minutes.');
        }
    }

    function updateModalUI(item) {
        const title = state.currentMode === 'movie' ? item.title : item.name;
        const date = state.currentMode === 'movie' ? item.release_date : item.first_air_date;
        const posterPath = item.poster_path ? (item.poster_path.startsWith('http') ? item.poster_path : `${IMG_URL_W780}${item.poster_path}`) : 'https://via.placeholder.com/780x1170/1a1a2e/00FF9D?text=No+Image';

        dom.modalTitle.textContent = title;
        dom.modalPoster.src = posterPath;
        dom.modalDate.textContent = date || 'N/A';
        dom.modalRating.textContent = item.vote_average ? `${item.vote_average.toFixed(1)}/10` : 'N/A';
        dom.modalLanguage.textContent = item.original_language ? item.original_language.toUpperCase() : 'N/A';
        dom.modalOverview.textContent = item.overview || 'No overview available.';
        dom.modalGenres.textContent = item.genres ? item.genres.map(g => g.name).join(', ') : 'N/A';

        const director = item.credits?.crew?.find(c => c.job === 'Director');
        dom.modalDirector.textContent = director ? director.name : 'N/A';

        if (state.currentMode === 'movie') {
            dom.modalRuntime.textContent = item.runtime ? `${item.runtime} min` : 'N/A';
            dom.seasonSelector.style.display = 'none';
        } else { // tv
            dom.modalRuntime.textContent = item.episode_run_time && item.episode_run_time.length > 0 ? `${item.episode_run_time[0]} min` : 'N/A';
            dom.seasonSelector.style.display = 'block';
            loadTVSeasons(item);
        }
    }

    function renderCast(cast) {
        dom.castGrid.innerHTML = '';
        if (cast.length > 0) {
            dom.castContainer.style.display = 'block';
            const castToShow = cast.slice(0, 10);
            castToShow.forEach(member => {
            const profilePath = member.profile_path ? (member.profile_path.startsWith('http') ? member.profile_path : `${IMG_URL}${member.profile_path}`) : 'https://via.placeholder.com/70x70/1a1a2e/00FF9D?text=N/A';
                const castMemberEl = document.createElement('div');
                castMemberEl.className = 'cast-member';
                castMemberEl.innerHTML = `
                    <img src="${profilePath}" alt="${member.name}">
                    <div class="cast-member-name">${member.name}</div>
                `;
                dom.castGrid.appendChild(castMemberEl);
            });
        } else {
            dom.castContainer.style.display = 'none';
        }
    }

    function setupTrailerButton(videos) {
        const officialTrailer = videos.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official);
        const anyTrailer = videos.find(v => v.site === 'YouTube' && v.type === 'Trailer');
        const trailer = officialTrailer || anyTrailer;

        if (trailer) {
            dom.trailerBtn.style.display = 'inline-flex';
            dom.trailerBtn.onclick = () => {
                dom.trailerPlayer.innerHTML = `
                    <iframe class="stream-iframe" 
                        src="https://www.youtube.com/embed/${trailer.key}?autoplay=1&rel=0" 
                        title="YouTube video player" 
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen></iframe>`;
                openModal(dom.trailerModal);
            };
        } else {
            dom.trailerBtn.style.display = 'none';
        }
    }

    function loadTVSeasons(tvData) {
        try {
            state.tvSeasons = tvData.seasons || [];
            dom.seasonSelect.innerHTML = '';
            state.tvSeasons.forEach(season => {
                if (season.season_number > 0) {
                    const option = document.createElement('option');
                    option.value = season.season_number;
                    option.textContent = `Season ${season.season_number}`;
                    dom.seasonSelect.appendChild(option);
                }
            });

            state.currentSeason = dom.seasonSelect.value ? parseInt(dom.seasonSelect.value) : 1;
            updateEpisodesForSeason(state.currentSeason);
        } catch (error) {
            console.error('Error loading TV seasons:', error);
            dom.seasonSelect.innerHTML = '';
            for (let i = 1; i <= 5; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `Season ${i}`;
                dom.seasonSelect.appendChild(option);
            }
            updateEpisodesForSeason(1);
        }
    }

    function updateEpisodesForSeason(seasonNumber) {
        const season = state.tvSeasons.find(s => s.season_number === seasonNumber);
        dom.episodeSelect.innerHTML = '';

        if (season && season.episode_count) {
            for (let i = 1; i <= season.episode_count; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `Episode ${i}`;
                dom.episodeSelect.appendChild(option);
            }
        } else {
            for (let i = 1; i <= 10; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `Episode ${i}`;
                dom.episodeSelect.appendChild(option);
            }
        }

        state.currentEpisode = 1;
        dom.episodeSelect.value = '1';
    }

    // --- Hero Section ---
    async function fetchHeroMovies() {
        try {
            await retryWithBackoff(async () => {
                const response = await fetch(`${API_URL}/movie/popular${API_KEY_PARAM}&page=1`);
                if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                const data = await response.json();
                state.heroMovies = data.results.slice(0, 5);
                updateHero();
                heroInterval = setInterval(() => {
                    state.currentHeroIndex = (state.currentHeroIndex + 1) % state.heroMovies.length;
                    updateHero();
                }, HERO_SLIDESHOW_INTERVAL);
            });
        } catch (error) {
            console.error('Error fetching hero movies:', error);
        }
    }

    function updateHero() {
        if (state.heroMovies.length === 0) return;
        const movie = state.heroMovies[state.currentHeroIndex];
        const backdropUrl = movie.backdrop_path ? (movie.backdrop_path.startsWith('http') ? movie.backdrop_path : `${IMG_URL_ORIGINAL}${movie.backdrop_path}`) : 'https://via.placeholder.com/1920x1080/1a1a2e/00FF9D?text=No+Image';
        dom.hero.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url('${backdropUrl}')`;
        dom.heroTitle.textContent = movie.title;
        dom.heroDesc.textContent = movie.overview || 'No description available.';
    }

    // --- Data Persistence (History & Favorites) ---
    function getFromStorage(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    }

    function saveToStorage(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    function updateWatchHistory() {
        if (!state.currentItem) return;
        let history = getFromStorage('streamflixWatchHistory');
        history = history.filter(entry => entry.item.id !== state.currentItem.id);

        const newEntry = {
            item: {
                id: state.currentItem.id,
                title: state.currentMode === 'movie' ? state.currentItem.title : state.currentItem.name,
                poster_path: state.currentItem.poster_path,
                vote_average: state.currentItem.vote_average,
                release_date: state.currentItem.release_date,
                first_air_date: state.currentItem.first_air_date,
            },
            mode: state.currentMode,
            watchedAt: new Date().toISOString()
        };
        history.unshift(newEntry);

        if (history.length > 10) {
            history = history.slice(0, 10);
        }

        saveToStorage('streamflixWatchHistory', history);
        displayWatchHistory();
    }

    function clearWatchHistory() {
        localStorage.removeItem('streamflixWatchHistory');
        document.getElementById('continueWatchingSection').style.display = 'none';
        document.getElementById('continueWatchingGrid').innerHTML = '';
    }

    function displayWatchHistory() {
        const history = getFromStorage('streamflixWatchHistory');
        const section = document.getElementById('continueWatchingSection');
        const grid = document.getElementById('continueWatchingGrid');

        if (history.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        displayContent(history.map(entry => ({ ...entry.item, mode: entry.mode })), grid, true);
    }

    function isFavorite(itemId) {
        const favorites = getFromStorage('streamflixFavorites');
        return favorites.some(fav => fav.item.id === itemId);
    }

    function toggleFavorite() {
        if (!state.currentItem) return;
        let favorites = getFromStorage('streamflixFavorites');
        const itemId = state.currentItem.id;

        if (isFavorite(itemId)) {
            favorites = favorites.filter(fav => fav.item.id !== itemId);
        } else {
            const newFavorite = {
                item: {
                    id: state.currentItem.id,
                    title: state.currentMode === 'movie' ? state.currentItem.title : state.currentItem.name,
                    poster_path: state.currentItem.poster_path,
                    vote_average: state.currentItem.vote_average,
                    release_date: state.currentItem.release_date,
                    first_air_date: state.currentItem.first_air_date,
                },
                mode: state.currentMode
            };
            favorites.unshift(newFavorite);
        }

        saveToStorage('streamflixFavorites', favorites);
        updateFavoriteButton();
        displayFavorites();
    }

    function updateFavoriteButton() {
        if (isFavorite(state.currentItem.id)) {
            dom.favoriteBtn.classList.add('active');
            dom.favoriteBtn.innerHTML = `<i class="fas fa-heart"></i> In Favorites`;
        } else {
            dom.favoriteBtn.classList.remove('active');
            dom.favoriteBtn.innerHTML = `<i class="fas fa-heart"></i> Add to Favorites`;
        }
    }

    function clearFavorites() {
        localStorage.removeItem('streamflixFavorites');
        document.getElementById('favoritesSection').style.display = 'none';
        document.getElementById('favoritesGrid').innerHTML = '';
    }

    function displayFavorites() {
        const favorites = getFromStorage('streamflixFavorites');
        const section = document.getElementById('favoritesSection');
        const grid = document.getElementById('favoritesGrid');

        if (favorites.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        displayContent(favorites.map(entry => ({ ...entry.item, mode: entry.mode })), grid, true);
    }

    // --- UI & Utility Functions ---
    function openExternalPlayer(item) {
        const movieItem = item || state.currentItem;
        if (!movieItem) return;

        const token = Math.random().toString(36).substring(2);
        sessionStorage.setItem('streamflix_access_token', token);

        const externalUrl = `player.html?id=${movieItem.id}&mode=${state.currentMode}&season=${state.currentSeason}&episode=${state.currentEpisode}&token=${token}`;
        const newWindow = window.open(externalUrl, '_blank', 'noopener,noreferrer');

        if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
            sessionStorage.removeItem('streamflix_access_token');
            alert('Please allow popups for this site to watch content.');
        }
    }

    function handleShare() {
        if (!state.currentItem) return;

        const shareUrl = `${window.location.origin}${window.location.pathname}?id=${state.currentItem.id}&mode=${state.currentMode}`;
        const title = state.currentMode === 'movie' ? state.currentItem.title : state.currentItem.name;
        const text = `Check out ${title} on StreamFlix!`;

        if (navigator.share) {
            navigator.share({ title, text, url: shareUrl })
                .then(() => console.log('Successful share'))
                .catch((error) => console.log('Error sharing', error));
        } else {
            navigator.clipboard.writeText(shareUrl).then(() => {
                alert('Link copied to clipboard!');
            }).catch(err => {
                console.error('Could not copy text: ', err);
                alert('Could not copy link. Please copy it manually.');
            });
        }
    }

    function applyInitialTheme() {
        const savedTheme = localStorage.getItem('streamflixTheme') || 'dark';
        document.body.setAttribute('data-theme', savedTheme);
        dom.themeSwitch.checked = savedTheme === 'dark';
    }

    function toggleTheme() {
        const newTheme = dom.themeSwitch.checked ? 'dark' : 'light';
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('streamflixTheme', newTheme);
    }

    function populateGenreButtons() {
        dom.genreButtons.innerHTML = genres.map(genre =>
            `<button class="genre-btn ${genre.id === '' ? 'active' : ''}" data-genre="${genre.id}">${genre.name}</button>`
        ).join('');
    }

    function openModal(modalElement) {
        activeElementBeforeModal = document.activeElement;
        modalElement.style.display = 'block';

        const focusableElement = modalElement.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusableElement) {
            focusableElement.focus();
        } else {
            modalElement.querySelector('.modal-content').focus();
        }

        document.addEventListener('keydown', handleModalKeydown);
        modalElement.addEventListener('click', handleModalClick);
    }

    function closeModalWindow(modalElement) {
        if (modalElement.id === 'trailerModal') {
            dom.trailerPlayer.innerHTML = '';
        }
        modalElement.style.display = 'none';
        if (activeElementBeforeModal) {
            activeElementBeforeModal.focus();
        }
        document.removeEventListener('keydown', handleModalKeydown);
        modalElement.removeEventListener('click', handleModalClick);
    }

    function handleModalKeydown(event) {
        const openModalElement = document.querySelector('.modal[style*="display: block"]');
        if (!openModalElement) return;

        if (event.key === 'Escape') {
            closeModalWindow(openModalElement);
        }

        if (event.key === 'Tab') {
            const focusableElements = Array.from(openModalElement.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (event.shiftKey && document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            } else if (!event.shiftKey && document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        }
    }

    function handleModalClick(event) {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target);
        }
    }

    function displaySkeletons(count = 10, gridElement = dom.contentGrid) {
        gridElement.innerHTML = '';
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            const skeletonCard = document.createElement('div');
            skeletonCard.className = 'skeleton-card';
            skeletonCard.innerHTML = `
                <div class="skeleton-img"></div>
                <div class="skeleton-content">
                    <div class="skeleton-title"></div>
                    <div class="skeleton-info"></div>
                </div>
            `;
            fragment.appendChild(skeletonCard);
        }
        gridElement.appendChild(fragment);
    }

    function handleScroll() {
        if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
            dom.backToTopBtn.classList.add('show');
        } else {
            dom.backToTopBtn.classList.remove('show');
        }
    }

    function scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function setupScrollArrows(container) {
        const grid = container.querySelector('.horizontal-scroll-grid');
        const leftArrow = container.querySelector('.left-arrow');
        const rightArrow = container.querySelector('.right-arrow');

        function updateArrowVisibility() {
            const scrollLeft = grid.scrollLeft;
            const scrollWidth = grid.scrollWidth;
            const clientWidth = grid.clientWidth;

            leftArrow.style.display = scrollLeft > 0 ? 'block' : 'none';
            rightArrow.style.display = scrollLeft < (scrollWidth - clientWidth - 1) ? 'block' : 'none';
        }

        leftArrow.addEventListener('click', () => {
            grid.scrollBy({ left: -grid.clientWidth * 0.8, behavior: 'smooth' });
        });

        rightArrow.addEventListener('click', () => {
            grid.scrollBy({ left: grid.clientWidth * 0.8, behavior: 'smooth' });
        });

        grid.addEventListener('scroll', updateArrowVisibility);

        const observer = new MutationObserver(() => {
            setTimeout(updateArrowVisibility, 100);
        });
        observer.observe(grid, { childList: true });
    }

    function isMobile() {
        return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // --- Start the application ---
    init();
});