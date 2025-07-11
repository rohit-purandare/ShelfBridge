import axios from 'axios';
import { RateLimiter } from './utils.js';
import logger from './logger.js';

const MAX_PARALLEL_WORKERS = 8;

export class AudiobookshelfClient {
    constructor(baseUrl, token, maxWorkers = 3) {
        this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
        this.token = token;
        this.maxWorkers = maxWorkers;
        this.rateLimiter = new RateLimiter(600); // 10 requests per second = 600 per minute

        // Create axios instance with default config
        this.axios = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 second timeout
        });

        // Add request interceptor for rate limiting and logging
        this.axios.interceptors.request.use(async (config) => {
            await this.rateLimiter.waitIfNeeded();
            return config;
        });

        // Add response interceptor for logging
        this.axios.interceptors.response.use(
            (response) => {
                logger.debug(`${response.config.method?.toUpperCase()} ${response.config.url} -> ${response.status}`);
                return response;
            },
            (error) => {
                const status = error.response?.status || 'ERR';
                logger.debug(`${error.config?.method?.toUpperCase()} ${error.config?.url} -> ${status}`);
                return Promise.reject(error);
            }
        );

        logger.debug('AudiobookshelfClient initialized', { 
            baseUrl: this.baseUrl, 
            maxWorkers: this.maxWorkers 
        });
    }

    async testConnection() {
        try {
            const response = await this._makeRequest('GET', '/ping');
            return response !== null;
        } catch (error) {
            logger.error('Audiobookshelf connection test failed', { 
            error: error.message, 
            stack: error.stack 
        });
            return false;
        }
    }

    async getReadingProgress() {
        logger.debug('Fetching reading progress from Audiobookshelf');

        try {
            // Get user info first
            const userData = await this._getCurrentUser();
            if (!userData) {
                throw new Error('Could not get current user data, aborting sync.');
            }

            // Get library items in progress (these have some progress)
            const progressItems = await this._getItemsInProgress();
            logger.debug('Found items in progress', { count: progressItems.length });

            // Also get all library items to catch books with 0% progress or unknown status
            const allLibraries = await this.getLibraries();
            logger.debug('Found libraries', { count: allLibraries.length });
            
            const allBooks = [];

            // Collect all books from all libraries
            for (const library of allLibraries) {
                logger.debug('Fetching books from library', { 
                    libraryName: library.name, 
                    libraryId: library.id 
                });
                const libraryBooks = await this.getLibraryItems(library.id, 1000);
                logger.debug('Library books count', { 
                    libraryName: library.name, 
                    count: libraryBooks.length 
                });
                allBooks.push(...libraryBooks);
            }

            logger.debug('Total books across all libraries', { count: allBooks.length });

            // Create a set of IDs that are already in progress
            const progressItemIds = new Set(progressItems.map(item => item.id));
            logger.debug('Progress item IDs', { ids: Array.from(progressItemIds) });

            // Combine progress items with other books that might need syncing
            const booksToSync = [];

            // Fetch details for progress items in parallel
            const progressPromises = progressItems.map(item => 
                this._getLibraryItemDetails(item.id).catch(error => {
                    logger.error('Error fetching details for item', { 
                        itemId: item.id, 
                        error: error.message 
                    });
                    return null;
                })
            );

            const progressResults = await Promise.all(progressPromises);
            booksToSync.push(...progressResults.filter(Boolean));
            logger.debug('Added progress items to sync list', { 
                count: progressResults.filter(Boolean).length 
            });

            // Fetch details for other books (with 0% or unknown progress) in parallel
            const otherBooks = allBooks.filter(book => !progressItemIds.has(book.id));
            logger.debug('Found other books not in progress', { count: otherBooks.length });
            
            const otherPromises = otherBooks.map(book => 
                this._getLibraryItemDetails(book.id).catch(error => {
                    logger.error('Error fetching details for book', { 
                        bookId: book.id, 
                        error: error.message 
                    });
                    return null;
                })
            );

            const otherResults = await Promise.all(otherPromises);
            const otherBooksWithProgress = otherResults.filter(Boolean).map(book => {
                if (!book.progress_percentage) {
                    book.progress_percentage = 0.0;
                }
                return book;
            });
            booksToSync.push(...otherBooksWithProgress);
            logger.debug('Added other books to sync list', { count: otherBooksWithProgress.length });

            logger.debug('Total books to check for sync', { count: booksToSync.length });

            // Debug: print all book titles and their progress
            booksToSync.forEach(book => {
                const title = (book.media && book.media.metadata && book.media.metadata.title) || book.title || 'Unknown';
                const progress = book.progress_percentage || 0;
                logger.debug('Book progress', { title, progress });
            });

            return booksToSync;

        } catch (error) {
            logger.error('Error fetching reading progress', { 
                error: error.message, 
                stack: error.stack 
            });
            return [];
        }
    }

    async _getCurrentUser() {
        try {
            const response = await this._makeRequest('GET', '/api/me');
            return response;
        } catch (error) {
            logger.error('Error getting current user', { 
                error: error.message, 
                stack: error.stack 
            });
            return null;
        }
    }

    async _getItemsInProgress() {
        try {
            const response = await this._makeRequest('GET', '/api/me/items-in-progress');
            return response.libraryItems || [];
        } catch (error) {
            logger.error('Error getting items in progress', { 
                error: error.message, 
                stack: error.stack 
            });
            return [];
        }
    }

    async _getLibraryItemDetails(itemId) {
        try {
            const itemData = await this._makeRequest('GET', `/api/items/${itemId}`);
            
            // Get user's progress for this item
            const progressData = await this._getUserProgress(itemId);

            // Combine item data with progress
            if (progressData) {
                itemData.progress_percentage = progressData.progress * 100;
                itemData.current_time = progressData.currentTime;
                itemData.is_finished = progressData.isFinished;
                
                // Use media progress startedAt if available
                if (progressData.startedAt) {
                    itemData.started_at = progressData.startedAt;
                    logger.debug('Raw startedAt for book', { 
                        title: itemData.media?.metadata?.title,
                        startedAt: progressData.startedAt,
                        startedAtISO: new Date(progressData.startedAt).toISOString()
                    });
                }
                // Use media progress finishedAt if available
                if (progressData.finishedAt) {
                    itemData.finished_at = progressData.finishedAt;
                    logger.debug('Raw finishedAt for book', { 
                        title: itemData.media?.metadata?.title,
                        finishedAt: progressData.finishedAt,
                        finishedAtISO: new Date(progressData.finishedAt).toISOString()
                    });
                }
                // Use media progress lastUpdate for last listened
                if (progressData.lastUpdate) {
                    itemData.last_listened_at = progressData.lastUpdate;
                    logger.debug('Raw lastUpdate for book', { 
                        title: itemData.media?.metadata?.title,
                        lastUpdate: progressData.lastUpdate,
                        lastUpdateISO: new Date(progressData.lastUpdate).toISOString()
                    });
                } else {
                    itemData.last_listened_at = null;
                    logger.debug('No lastUpdate for book', { 
                        title: itemData.media?.metadata?.title 
                    });
                }
            }

            return itemData;
        } catch (error) {
            logger.error('Error getting library item details', { 
                itemId, 
                error: error.message, 
                stack: error.stack 
            });
            return null;
        }
    }
    async _getUserProgress(itemId) {
        try {
            // This endpoint can return 404 if there's no progress, which is normal
            const response = await this._makeRequest('GET', `/api/me/progress/${itemId}`, null, [404]);
            return response;
        } catch (error) {
            // Not an error, just means no progress data
            return null;
        }
    }

    async _getPlaybackSessions() {
        try {
            // Get all user's listening sessions with pagination - this gives us updatedAt timestamps
            let page = 0;
            let allSessions = [];
            let total = 0;
            let itemsPerPage = 10;

            while (true) {
                const response = await this._makeRequest('GET', `/api/sessions?page=${page}`, null, [404]);
                if (!response) break;
                
                if (page === 0) {
                    total = response.total;
                    itemsPerPage = response.itemsPerPage;
                }
                
                allSessions = allSessions.concat(response.sessions || []);
                
                if (allSessions.length >= total) break;
                page++;
            }
            
            logger.debug('Fetched playback sessions', { 
                totalSessions: allSessions.length, 
                pages: page + 1 
            });
            return { sessions: allSessions };
        } catch (error) {
            // Not an error, just means no session data
            logger.error('Error fetching playback sessions', { 
                error: error.message, 
                stack: error.stack 
            });
            return null;
        }
    }



    async getLibraries() {
        try {
            const response = await this._makeRequest('GET', '/api/libraries');
            return response.libraries || [];
        } catch (error) {
            logger.error('Error getting libraries', { 
                error: error.message, 
                stack: error.stack 
            });
            return [];
        }
    }

    async getLibraryItems(libraryId, limit = 50) {
        try {
            const response = await this._makeRequest('GET', `/api/libraries/${libraryId}/items?limit=${limit}`);
            logger.debug('Library items API response', { libraryId, response });
            return response.results || response.libraryItems || [];
        } catch (error) {
            logger.error('Error getting library items', { 
                libraryId, 
                error: error.message, 
                stack: error.stack 
            });
            return [];
        }
    }

    async _makeRequest(method, endpoint, data = null, suppressErrors = []) {
        await this.rateLimiter.waitIfNeeded();

        try {
            const config = {
                method,
                url: endpoint,
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            };

            if (data) {
                config.data = data;
            }

            const response = await this.axios.request(config);
            
            // Validate response
            if (!response || response.status < 200 || response.status >= 300) {
                throw new Error(`API request failed with status ${response?.status}: ${response?.statusText}`);
            }
            
            if (!response.data) {
                throw new Error('API response contains no data');
            }
            
            return response.data;
        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                
                if (suppressErrors.includes(status)) {
                    return null;
                }
                
                logger.error(`HTTP ${status} error for ${method} ${endpoint}`, { 
                    status, 
                    data: error.response.data 
                });
                throw new Error(`HTTP ${status}: ${error.response.data?.message || error.message}`);
            } else if (error.request) {
                logger.error(`Network error for ${method} ${endpoint}`, { 
                    error: error.message 
                });
                throw new Error(`Network error: ${error.message}`);
            } else {
                logger.error(`Request error for ${method} ${endpoint}`, { 
                    error: error.message 
                });
                throw error;
            }
        }
    }
} 