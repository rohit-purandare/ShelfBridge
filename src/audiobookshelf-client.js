import axios from 'axios';
import { RateLimiter } from './utils.js';

const MAX_PARALLEL_WORKERS = 8;

export class AudiobookshelfClient {
    constructor(baseUrl, token, maxWorkers = MAX_PARALLEL_WORKERS) {
        this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
        this.token = token;
        this.maxWorkers = maxWorkers;
        this.rateLimiter = new RateLimiter(60); // 60 requests per minute
        
        // Setup axios instance with authentication
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 second timeout
        });
        
        console.log(`AudiobookshelfClient initialized for ${this.baseUrl} with ${this.maxWorkers} workers`);
    }

    async testConnection() {
        try {
            const response = await this._makeRequest('GET', '/ping');
            return response !== null;
        } catch (error) {
            console.error('Audiobookshelf connection test failed:', error.message);
            return false;
        }
    }

    async getReadingProgress() {
        console.log('Fetching reading progress from Audiobookshelf...');

        try {
            // Get user info first
            const userData = await this._getCurrentUser();
            if (!userData) {
                throw new Error('Could not get current user data, aborting sync.');
            }

            // Get library items in progress (these have some progress)
            const progressItems = await this._getItemsInProgress();
            console.log(`[DEBUG] Found ${progressItems.length} items in progress`);

            // Also get all library items to catch books with 0% progress or unknown status
            const allLibraries = await this.getLibraries();
            console.log(`[DEBUG] Found ${allLibraries.length} libraries`);
            
            const allBooks = [];

            // Collect all books from all libraries
            for (const library of allLibraries) {
                console.log(`[DEBUG] Fetching books from library: ${library.name} (${library.id})`);
                const libraryBooks = await this.getLibraryItems(library.id, 1000);
                console.log(`[DEBUG] Library ${library.name} has ${libraryBooks.length} books`);
                allBooks.push(...libraryBooks);
            }

            console.log(`[DEBUG] Total books across all libraries: ${allBooks.length}`);

            // Create a set of IDs that are already in progress
            const progressItemIds = new Set(progressItems.map(item => item.id));
            console.log(`[DEBUG] Progress item IDs: ${Array.from(progressItemIds)}`);

            // Combine progress items with other books that might need syncing
            const booksToSync = [];

            // Fetch details for progress items in parallel
            const progressPromises = progressItems.map(item => 
                this._getLibraryItemDetails(item.id).catch(error => {
                    console.error(`Error fetching details for ${item.id}:`, error.message);
                    return null;
                })
            );

            const progressResults = await Promise.all(progressPromises);
            booksToSync.push(...progressResults.filter(Boolean));
            console.log(`[DEBUG] Added ${progressResults.filter(Boolean).length} progress items to sync list`);

            // Fetch details for other books (with 0% or unknown progress) in parallel
            const otherBooks = allBooks.filter(book => !progressItemIds.has(book.id));
            console.log(`[DEBUG] Found ${otherBooks.length} other books not in progress`);
            
            const otherPromises = otherBooks.map(book => 
                this._getLibraryItemDetails(book.id).catch(error => {
                    console.error(`Error fetching details for ${book.id}:`, error.message);
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
            console.log(`[DEBUG] Added ${otherBooksWithProgress.length} other books to sync list`);

            console.log(`Found ${booksToSync.length} total books to check for sync`);

            // Debug: print all book titles and their progress
            booksToSync.forEach(book => {
                const title = (book.media && book.media.metadata && book.media.metadata.title) || book.title || 'Unknown';
                const progress = book.progress_percentage || 0;
                console.log(`[DEBUG] Book: '${title}' - Progress: ${progress}%`);
            });

            return booksToSync;

        } catch (error) {
            console.error('Error fetching reading progress:', error.message);
            return [];
        }
    }

    async _getCurrentUser() {
        try {
            const response = await this._makeRequest('GET', '/api/me');
            return response;
        } catch (error) {
            console.error('Error getting current user:', error.message);
            return null;
        }
    }

    async _getItemsInProgress() {
        try {
            const response = await this._makeRequest('GET', '/api/me/items-in-progress');
            return response.libraryItems || [];
        } catch (error) {
            console.error('Error getting items in progress:', error.message);
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
                    console.log(`[DEBUG] Raw startedAt for ${itemData.media?.metadata?.title}: ${progressData.startedAt} (${new Date(progressData.startedAt).toISOString()})`);
                }
                // Use media progress finishedAt if available
                if (progressData.finishedAt) {
                    itemData.finished_at = progressData.finishedAt;
                    console.log(`[DEBUG] Raw finishedAt for ${itemData.media?.metadata?.title}: ${progressData.finishedAt} (${new Date(progressData.finishedAt).toISOString()})`);
                }
                // Use media progress lastUpdate for last listened
                if (progressData.lastUpdate) {
                    itemData.last_listened_at = progressData.lastUpdate;
                    console.log(`[DEBUG] Raw lastUpdate for ${itemData.media?.metadata?.title}: ${progressData.lastUpdate} (${new Date(progressData.lastUpdate).toISOString()})`);
                } else {
                    itemData.last_listened_at = null;
                    console.log(`[DEBUG] No lastUpdate for ${itemData.media?.metadata?.title}`);
                }
            }

            return itemData;
        } catch (error) {
            console.error(`Error getting library item details for ${itemId}:`, error.message);
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
            
            console.log(`[DEBUG] Fetched ${allSessions.length} total sessions across ${page + 1} pages`);
            return { sessions: allSessions };
        } catch (error) {
            // Not an error, just means no session data
            console.error('Error fetching playback sessions:', error.message);
            return null;
        }
    }



    async getLibraries() {
        try {
            const response = await this._makeRequest('GET', '/api/libraries');
            return response.libraries || [];
        } catch (error) {
            console.error('Error getting libraries:', error.message);
            return [];
        }
    }

    async getLibraryItems(libraryId, limit = 50) {
        try {
            const response = await this._makeRequest('GET', `/api/libraries/${libraryId}/items?limit=${limit}`);
            console.log(`[DEBUG] Library items API response for ${libraryId}:`, JSON.stringify(response, null, 2));
            return response.results || response.libraryItems || [];
        } catch (error) {
            console.error(`Error getting library items for ${libraryId}:`, error.message);
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

            const response = await this.client.request(config);
            
            console.debug(`${method} ${endpoint} -> ${response.status}`);
            
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
                
                console.error(`HTTP ${status} error for ${method} ${endpoint}:`, error.response.data);
                throw new Error(`HTTP ${status}: ${error.response.data?.message || error.message}`);
            } else if (error.request) {
                console.error(`Network error for ${method} ${endpoint}:`, error.message);
                throw new Error(`Network error: ${error.message}`);
            } else {
                console.error(`Request error for ${method} ${endpoint}:`, error.message);
                throw error;
            }
        }
    }
} 