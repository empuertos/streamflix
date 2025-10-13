// StreamFlix Main Application
document.addEventListener('DOMContentLoaded', () => {
    // Configuration
    const CONFIG = {
        API_URL: 'https://streamflix.22afed28-f0b2-46d0-8804-c90e25c90bd4.workers.dev/',
        IMG_BASE_URL: 'https://image.tmdb.org/t/p/',
        ITEMS_PER_PAGE: 20,
        SITE_URL: 'https://streamflix-use.vercel.app'
    };

    // State management
    const state = {
        currentPage: 1,
        totalPages: 1,
        searchQuery: '',
        isSearching: false,
        favorites: JSON.parse(localStorage.getItem('streamflix_favorites') || '[]'),
        deferredPrompt: null
    };

    // DOM Elements
    const dom = {
        searchInput: document.getElementById('searchInput'),
        searchBtn: document.getElementById('searchBtn'),
        popularGrid: document.getElementById('popularGrid'),
        resultsGrid: document.getElementById('resultsGrid'),
        loadMoreBtn: document.getElementById('loadMoreBtn'),
        movieModal: document.getElementById('movieModal'),
        modalPoster: document.getElementById('modalPoster'),
        modalTitle: document.getElementById('modalTitle'),
        modalYear: document.getElementById('modalYear'),
        modalGenres: document.getElementById('modalGenres'),
        modalRating: document.getElementById('modalRating'),
        ratingValue: document.getElementById('ratingValue'),
        modalReleaseDate: document.getElementById('modalReleaseDate'),
        modalLanguage: document.getElementById('modalLanguage'),
        modalDirector: document.getElementById('modalDirector'),
        modalOverview: document.getElementById('modalOverview'),
        trailerFrame: document.getElementById('trailerFrame'),
        watchNowBtn: document.getElementById('watchNowBtn'),
        favoriteBtn: document.getElementById('favoriteBtn'),
        shareBtn: document.getElementById('shareBtn'),
        closeModal: document.querySelector('.close-modal'),
        installBtn: document.getElementById('installBtn'),
        popularSection: document.getElementById('popularSection'),
        searchResults: document.getElementById('searchResults')
    };

    // Initialize app
    async function init() {
        setupEventListeners();
        setupPWA();
        await loadPopularMovies();
        setupKeyboardShortcuts();
    }

    // Event Listeners
    function setupEventListeners() {
        dom.searchBtn.addEventListener('click', handleSearch);
        dom.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSearch();
        });
        dom.loadMoreBtn.addEventListener('click', loadMoreMovies);
        dom.closeModal.addEventListener('click', closeModal);
        dom.watchNowBtn.addEventListener('click', handleWatchNow);
        dom.favoriteBtn.addEventListener('click', toggleFavorite);
        dom.shareBtn.addEventListener('click', handleShare);
        dom.installBtn.addEventListener('click', installPWA);

        // Close modal when clicking outside
        dom.movieModal.addEventListener('click', (e) => {
            if (e.target === dom.movieModal) closeModal();
        });
    }

    // PWA Installation
    function setupPWA() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            state.deferredPrompt = e;
            dom.installBtn.style.display = 'flex';
        });

        window.addEventListener('appinstalled', () => {
            dom.installBtn.style.display = 'none';
            state.deferredPrompt = null;
        });
    }

    async function installPWA() {
        if (state.deferredPrompt) {
            state.deferredPrompt.prompt();
            const { outcome } = await state.deferredPrompt.userChoice;
            state.deferredPrompt = null;
            if (outcome === 'accepted') {
                dom.installBtn.style.display = 'none';
            }
        }
    }

    // API Functions
    async function fetchFromAPI(endpoint) {
        try {
            const response = await fetch(`${CONFIG.API_URL}${endpoint}`);
            if (!response.ok) throw new Error('API request failed');
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    async function loadPopularMovies() {
        try {
            showLoading(dom.popularGrid);
            const data = await fetchFromAPI(`/movie/popular?page=${state.currentPage}`);
            renderMovies(data.results, dom.popularGrid);
            state.totalPages = data.total_pages;
            updateLoadMoreButton();
        } catch (error) {
            showError(dom.popularGrid, 'Failed to load popular movies');
        }
    }

    async function loadMoreMovies() {
        if (state.currentPage >= state.totalPages) return;

        state.currentPage++;
        try {
            const data = await fetchFromAPI(`/movie/popular?page=${state.currentPage}`);
            renderMovies(data.results, dom.popularGrid, true);
            updateLoadMoreButton();
        } catch (error) {
            console.error('Error loading more movies:', error);
        }
    }

    async function handleSearch() {
        const query = dom.searchInput.value.trim();
        if (!query) return;

        state.searchQuery = query;
        state.isSearching = true;
        state.currentPage = 1;

        try {
            showLoading(dom.resultsGrid);
            dom.popularSection.style.display = 'none';
            dom.searchResults.style.display = 'block';

            const data = await fetchFromAPI(`/search/multi?query=${encodeURIComponent(query)}&page=1`);
            renderMovies(data.results, dom.resultsGrid);
        } catch (error) {
            showError(dom.resultsGrid, 'Search failed. Please try again.');
        }
    }

    // Movie Rendering
    function renderMovies(movies, container, append = false) {
        if (!append) container.innerHTML = '';

        movies.forEach(movie => {
            if (!movie.poster_path) return;

            const movieCard = createMovieCard(movie);
            container.appendChild(movieCard);
        });
    }

    function createMovieCard(movie) {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.dataset.id = movie.id;
        card.dataset.type = movie.media_type || 'movie';

        const posterUrl = movie.poster_path
            ? `${CONFIG.IMG_BASE_URL}w500${movie.poster_path}`
            : 'https://via.placeholder.com/300x450/1a1a2e/00FF9D?text=No+Image';

        const title = movie.title || movie.name;
        const year = (movie.release_date || movie.first_air_date || '').substring(0, 4);
        const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';

        card.innerHTML = `
            <img src="${posterUrl}" alt="${title}" class="movie-poster" loading="lazy">
            <div class="movie-info">
                <h3 class="movie-title">${title}</h3>
                <div class="movie-meta">
                    <span>${year}</span>
                    <span class="movie-rating">★ ${rating}</span>
                </div>
            </div>
        `;

        card.addEventListener('click', () => openMovieModal(movie));
        return card;
    }

    // Modal Functions
    async function openMovieModal(movie) {
        try {
            const details = await fetchFromAPI(`/${movie.media_type || 'movie'}/${movie.id}?append_to_response=credits,videos`);

            // Update modal content
            updateModalContent(details, movie.media_type || 'movie');
            dom.movieModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';

            // Load trailer
            loadTrailer(details.videos?.results || []);
        } catch (error) {
            console.error('Error loading movie details:', error);
            alert('Failed to load movie details. Please try again.');
        }
    }

    function updateModalContent(movie, type) {
        const posterUrl = movie.poster_path
            ? `${CONFIG.IMG_BASE_URL}w500${movie.poster_path}`
            : 'https://via.placeholder.com/300x450/1a1a2e/00FF9D?text=No+Image';

        dom.modalPoster.src = posterUrl;
        dom.modalTitle.textContent = movie.title || movie.name;
        dom.modalYear.textContent = (movie.release_date || movie.first_air_date || '').substring(0, 4);
        dom.modalGenres.textContent = movie.genres?.map(g => g.name).join(', ') || 'N/A';
        dom.ratingValue.textContent = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
        dom.modalReleaseDate.textContent = movie.release_date || movie.first_air_date || 'N/A';
        dom.modalLanguage.textContent = movie.original_language?.toUpperCase() || 'N/A';

        // Find director
        const director = movie.credits?.crew?.find(person => person.job === 'Director');
        dom.modalDirector.textContent = director ? director.name : 'N/A';

        dom.modalOverview.textContent = movie.overview || 'No description available.';

        // Update watch button
        dom.watchNowBtn.dataset.id = movie.id;
        dom.watchNowBtn.dataset.type = type;

        // Update favorite button
        const isFavorited = state.favorites.some(fav => fav.id === movie.id && fav.type === type);
        updateFavoriteButton(isFavorited);
    }

    function loadTrailer(videos) {
        const trailer = videos.find(video =>
            video.type === 'Trailer' && video.site === 'YouTube'
        );

        if (trailer) {
            dom.trailerFrame.src = `https://www.youtube.com/embed/${trailer.key}`;
        } else {
            dom.trailerFrame.src = '';
            dom.trailerFrame.style.display = 'none';
        }
    }

    function closeModal() {
        dom.movieModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        dom.trailerFrame.src = '';
    }

    // Watch Now Function
    function handleWatchNow() {
        const movieId = dom.watchNowBtn.dataset.id;
        const type = dom.watchNowBtn.dataset.type;

        if (!movieId) return;

        // Generate secure token
        const token = generateSecureToken();
        sessionStorage.setItem('streamflix_access_token', token);

        // Open player in new tab
        const playerUrl = `player.html?id=${movieId}&mode=${type}&token=${token}`;
        window.open(playerUrl, '_blank');
    }

    function generateSecureToken() {
        return btoa(Date.now() + Math.random().toString(36).substr(2, 9));
    }

    // Favorites
    function toggleFavorite() {
        const movieId = parseInt(dom.watchNowBtn.dataset.id);
        const type = dom.watchNowBtn.dataset.type;
        const title = dom.modalTitle.textContent;
        const poster = dom.modalPoster.src;

        const existingIndex = state.favorites.findIndex(fav => fav.id === movieId && fav.type === type);

        if (existingIndex > -1) {
            state.favorites.splice(existingIndex, 1);
        } else {
            state.favorites.push({ id: movieId, type, title, poster });
        }

        localStorage.setItem('streamflix_favorites', JSON.stringify(state.favorites));
        updateFavoriteButton(existingIndex === -1);
    }

    function updateFavoriteButton(isFavorited) {
        const icon = dom.favoriteBtn.querySelector('i');
        if (isFavorited) {
            dom.favoriteBtn.classList.add('favorited');
            icon.className = 'fas fa-heart';
        } else {
            dom.favoriteBtn.classList.remove('favorited');
            icon.className = 'far fa-heart';
        }
    }

    // Share Function
    function handleShare() {
        const title = dom.modalTitle.textContent;
        const url = window.location.href;

        if (navigator.share) {
            navigator.share({
                title: `Watch ${title} on StreamFlix`,
                text: `Check out ${title} on StreamFlix!`,
                url: url
            });
        } else {
            // Fallback to clipboard
            navigator.clipboard.writeText(`${title} - ${url}`).then(() => {
                alert('Link copied to clipboard!');
            });
        }
    }

    // Utility Functions
    function showLoading(container) {
        container.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Loading...</p>
            </div>
        `;
    }

    function showError(container, message) {
        container.innerHTML = `
            <div class="error">
                <h3>⚠️ Error</h3>
                <p>${message}</p>
            </div>
        `;
    }

    function updateLoadMoreButton() {
        if (state.currentPage >= state.totalPages) {
            dom.loadMoreBtn.style.display = 'none';
        } else {
            dom.loadMoreBtn.style.display = 'block';
        }
    }

    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;

            switch (e.key.toLowerCase()) {
                case 'escape':
                    if (dom.movieModal.style.display === 'flex') {
                        closeModal();
                    }
                    break;
                case '/':
                    e.preventDefault();
                    dom.searchInput.focus();
                    break;
            }
        });
    }

    // Start the application
    init();
});
