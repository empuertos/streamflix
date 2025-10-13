const sqlite3 = require('sqlite3').verbose();
const WORKER_URL = 'https://streamflix.22afed28-f0b2-46d0-8804-c90e25c90bd4.workers.dev';

async function fetchPopularMovies(page = 1) {
    const response = await fetch(`${WORKER_URL}/movie/popular?page=${page}`);
    const data = await response.json();
    return data.results;
}

async function populateDatabase() {
    console.log('Fetching popular movies from TMDB...');

    // Open database
    const db = new sqlite3.Database('./streamflix.db', (err) => {
        if (err) {
            console.error('Error opening database:', err.message);
            return;
        }
        console.log('Connected to the SQLite database.');
    });

    // Create table if it doesn't exist
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS movies (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            overview TEXT,
            poster_path TEXT,
            backdrop_path TEXT,
            release_date TEXT,
            vote_average REAL,
            genre_ids TEXT,
            popularity REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create indexes
        db.run(`CREATE INDEX IF NOT EXISTS idx_title ON movies(title)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_popularity ON movies(popularity DESC)`);

        // Fetch first 5 pages (100 movies)
        for (let page = 1; page <= 5; page++) {
            console.log(`Fetching page ${page}...`);
            fetchPopularMovies(page).then(movies => {
                if (movies && Array.isArray(movies)) {
                    console.log(`Found ${movies.length} movies on page ${page}`);

                    for (const movie of movies) {
                        // Insert or replace movie data
                        db.run(`INSERT OR REPLACE INTO movies (
                            id, title, overview, poster_path, backdrop_path,
                            release_date, vote_average, genre_ids, popularity
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                            movie.id,
                            movie.title,
                            movie.overview,
                            movie.poster_path,
                            movie.backdrop_path,
                            movie.release_date,
                            movie.vote_average,
                            JSON.stringify(movie.genre_ids),
                            movie.popularity
                        ], function(err) {
                            if (err) {
                                console.error('Error inserting movie:', err.message);
                            } else {
                                console.log(`Inserted/Updated: ${movie.title}`);
                            }
                        });
                    }
                } else {
                    console.error(`No movies found on page ${page}`);
                }
            }).catch(err => console.error('Error fetching page:', err));
        }

        // Close database after a delay to ensure all inserts complete
        setTimeout(() => {
            db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                } else {
                    console.log('Database connection closed.');
                    console.log('Database population script completed!');
                }
            });
        }, 5000);
    });
}

// Run the population script
populateDatabase().catch(console.error);
