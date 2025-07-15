import axios from 'axios';
import { RateLimiter } from './utils.js';
import logger from './logger.js';
import { IdentifierLookupService } from './identifier-lookup.js';

const RATE_LIMIT_PER_MINUTE = 55;

export class HardcoverClient {
    constructor(token) {
        // Normalize token by stripping "Bearer" prefix if present
        this.token = this.normalizeToken(token);
        this.baseUrl = 'https://api.hardcover.app/v1/graphql';
        this.rateLimiter = new RateLimiter(RATE_LIMIT_PER_MINUTE);
        this.identifierLookup = new IdentifierLookupService();
        
        // Create axios instance with default config
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 second timeout
        });
        
        logger.debug('HardcoverClient initialized');
    }

    /**
     * Normalize token by stripping "Bearer" prefix if present
     * This handles cases where users accidentally include "Bearer" in their token
     */
    normalizeToken(token) {
        if (!token || typeof token !== 'string') {
            return token;
        }

        const trimmedToken = token.trim();
        
        // Check if token starts with "Bearer " (case-insensitive)
        if (trimmedToken.toLowerCase().startsWith('bearer ')) {
            const originalToken = trimmedToken;
            const normalizedToken = trimmedToken.substring(7); // Remove "Bearer "
            
            logger.warn('Hardcover token contained "Bearer" prefix - automatically removed', {
                originalLength: originalToken.length,
                normalizedLength: normalizedToken.length,
                originalPrefix: originalToken.substring(0, 15) + '...',
                normalizedPrefix: normalizedToken.substring(0, 15) + '...'
            });
            
            return normalizedToken;
        }
        
        return trimmedToken;
    }

    async testConnection() {
        const query = `
            query {
                me {
                    id
                    username
                }
            }
        `;

        try {
            const result = await this._executeQuery(query);
            // Accept both array and object for 'me'
            if (result && result.me) {
                if (Array.isArray(result.me)) {
                    // Accept if array is non-empty and has id/username
                    return result.me.length > 0 && result.me[0].id && result.me[0].username;
                } else {
                    // Accept if object has id/username
                    return result.me.id && result.me.username;
                }
            }
            return false;
        } catch (error) {
            logger.error('Connection test failed:', error.message);
            return false;
        }
    }

    async getSchema() {
        const query = `
            query IntrospectionQuery {
                __schema {
                    mutationType {
                        fields {
                            name
                            args {
                                name
                                type {
                                    name
                                    kind
                                    ofType {
                                        name
                                        kind
                                    }
                                }
                            }
                        }
                    }
                }
            }
        `;

        try {
            const result = await this._executeQuery(query);
            return result;
        } catch (error) {
            logger.error('Error getting schema:', error.message);
            return null;
        }
    }

    async getUserBooks() {
        logger.debug('Fetching user\'s book library from Hardcover...');

        const query = `
            query getUserBooks($offset: Int = 0, $limit: Int = 100) {
                me {
                    user_books(
                        offset: $offset,
                        limit: $limit
                    ) {
                        id
                        status_id
                        book {
                            id
                            title
                            contributions(where: {contributable_type: {_eq: "Book"}}) {
                                author {
                                    id
                                    name
                                }
                            }
                            editions {
                                id
                                isbn_10
                                isbn_13
                                asin
                                pages
                                audio_seconds
                                physical_format
                                reading_format { format }
                            }
                        }
                    }
                }
            }
        `;

        const allBooks = [];
        let offset = 0;
        const limit = 100;

        try {
            while (true) {
                const variables = { offset, limit };
                const result = await this._executeQuery(query, variables);

                if (!result) {
                    logger.error('No result from GraphQL query');
                    break;
                }

                logger.debug(`GraphQL result structure: ${typeof result}`);

                if (!result.me) {
                    logger.error(`'me' key not found in result. Available keys: ${Object.keys(result)}`);
                    break;
                }

                const meData = result.me;
                logger.debug(`Me data type: ${typeof meData}`);

                let books = [];
                
                // Handle both possible response formats
                if (Array.isArray(meData)) {
                    // If meData is a list, extract user_books from the first item
                    if (meData.length > 0 && meData[0].user_books) {
                        books = meData[0].user_books;
                        logger.debug(`Found user_books in me list with ${books.length} items`);
                    } else {
                        logger.error(`Expected user_books in me list but not found. Structure: ${meData.length > 0 ? JSON.stringify(meData[0]) : 'Empty list'}`);
                        books = [];
                    }
                } else if (typeof meData === 'object' && meData.user_books) {
                    // Standard format: me.user_books
                    books = meData.user_books;
                    logger.debug(`Found user_books in me data with ${books.length} items`);
                } else {
                    logger.error(`Unexpected me data structure. Type: ${typeof meData}, Keys: ${typeof meData === 'object' ? Object.keys(meData) : 'Not an object'}`);
                    break;
                }

                if (!books || books.length === 0) {
                    break;
                }

                allBooks.push(...books);

                // If we got fewer books than the limit, we've reached the end
                if (books.length < limit) {
                    break;
                }

                offset += limit;
                logger.debug(`Fetched ${allBooks.length} books so far...`);
            }

            logger.debug(`Retrieved ${allBooks.length} books from Hardcover library`);
            return allBooks;

        } catch (error) {
            logger.error('Error fetching user books:', error.message);
            throw error;
        }
    }

    async updateReadingProgress(userBookId, currentProgress, progressPercentage, editionId, useSeconds = false, startedAt = null, rereadConfig = null) {
        // Check for existing progress
        const progressInfo = await this.getBookCurrentProgress(userBookId);
        
        // Enhanced re-reading detection
        const edition = progressInfo?.latest_read?.edition || null;
        const shouldCreateNewSession = this._shouldCreateNewReadingSession(
            progressInfo, 
            progressPercentage, 
            currentProgress, 
            useSeconds,
            edition,
            rereadConfig
        );
        
        if (shouldCreateNewSession.createNew) {
            logger.info(`Creating new reading session: ${shouldCreateNewSession.reason}`);
            const startDate = startedAt ? startedAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
            return await this.insertUserBookRead(userBookId, currentProgress, editionId, startDate, useSeconds);
        }
        
        // Check for potentially dangerous progress regression
        if (shouldCreateNewSession.isRegression) {
            logger.warn(`Progress regression detected: ${shouldCreateNewSession.reason}`);
            // Could add user confirmation or admin notification here
        }
        
        if (progressInfo && progressInfo.has_progress && progressInfo.latest_read && progressInfo.latest_read.id) {
            // Update existing progress - include started_at if provided
            const readId = progressInfo.latest_read.id;
            const mutation = useSeconds ? `
                mutation UpdateBookProgress($id: Int!, $seconds: Int, $editionId: Int, $startedAt: date) {
                    update_user_book_read(id: $id, object: {
                        progress_seconds: $seconds,
                        edition_id: $editionId,
                        started_at: $startedAt
                    }) {
                        error
                        user_book_read {
                            id
                            progress_seconds
                            edition_id
                            started_at
                        }
                    }
                }
            ` : `
                mutation UpdateBookProgress($id: Int!, $pages: Int, $editionId: Int, $startedAt: date) {
                    update_user_book_read(id: $id, object: {
                        progress_pages: $pages,
                        edition_id: $editionId,
                        started_at: $startedAt
                    }) {
                        error
                        user_book_read {
                            id
                            progress_pages
                            edition_id
                            started_at
                        }
                    }
                }
            `;
            const variables = useSeconds ? {
                id: readId,
                seconds: currentProgress,
                editionId,
                startedAt: startedAt ? startedAt.slice(0, 10) : null
            } : {
                id: readId,
                pages: currentProgress,
                editionId,
                startedAt: startedAt ? startedAt.slice(0, 10) : null
            };
            try {
                const result = await this._executeQuery(mutation, variables);
                if (result && result.update_user_book_read && result.update_user_book_read.user_book_read) {
                    const updatedRecord = result.update_user_book_read.user_book_read;
                    logger.debug(`Updated progress - preserved original start date: ${updatedRecord.started_at}`);
                    return updatedRecord;
                }
                return false;
            } catch (error) {
                logger.error('Error updating reading progress:', error.message);
                return false;
            }
        } else {
            // Insert new progress record - use provided startedAt or current date
            const startDate = startedAt ? startedAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
            return await this.insertUserBookRead(userBookId, currentProgress, editionId, startDate, useSeconds);
        }
    }

    /**
     * Determines if a new reading session should be created based on progress patterns
     * @param {Object} progressInfo - Current progress information from Hardcover
     * @param {number} newProgressPercentage - New progress percentage (0-100)
     * @param {number} newCurrentProgress - New current progress (pages or seconds)
     * @param {boolean} useSeconds - Whether progress is measured in seconds
     * @param {Object} edition - Edition information with total pages/seconds (optional)
     * @param {Object} rereadConfig - Configuration for re-reading detection thresholds
     * @returns {Object} Decision object with createNew flag and reason
     */
    _shouldCreateNewReadingSession(progressInfo, newProgressPercentage, newCurrentProgress, useSeconds, edition = null, rereadConfig = null) {
        const result = {
            createNew: false,
            isRegression: false,
            reason: ''
        };

        // Get thresholds from config or use defaults
        const REREAD_THRESHOLD = rereadConfig?.reread_threshold || 30;
        const HIGH_PROGRESS_THRESHOLD = rereadConfig?.high_progress_threshold || 85;
        const REGRESSION_WARNING_THRESHOLD = rereadConfig?.regression_warn_threshold || 10;

        // No existing progress - normal new session
        if (!progressInfo || !progressInfo.has_progress || !progressInfo.latest_read) {
            return result;
        }

        const latestRead = progressInfo.latest_read;

        // Case 1: Book was previously completed (has finished_at) - always create new session
        if (latestRead.finished_at) {
            result.createNew = true;
            result.reason = 'Book was previously completed (finished_at set)';
            return result;
        }

        // Calculate previous progress percentage more accurately
        let previousProgressPercentage = 0;
        
        if (useSeconds && latestRead.progress_seconds) {
            if (edition && edition.audio_seconds) {
                // Accurate calculation with total duration
                previousProgressPercentage = (latestRead.progress_seconds / edition.audio_seconds) * 100;
            } else {
                // Heuristic: if previous progress is significantly higher than new progress
                const progressRatio = latestRead.progress_seconds / Math.max(newCurrentProgress, 1);
                if (progressRatio > 3) {
                    previousProgressPercentage = Math.min(95, progressRatio * 25); // Rough estimate
                }
            }
        } else if (!useSeconds && latestRead.progress_pages) {
            if (edition && edition.pages) {
                // Accurate calculation with total pages
                previousProgressPercentage = (latestRead.progress_pages / edition.pages) * 100;
            } else {
                // Heuristic: if previous progress is significantly higher than new progress
                const progressRatio = latestRead.progress_pages / Math.max(newCurrentProgress, 1);
                if (progressRatio > 3) {
                    previousProgressPercentage = Math.min(95, progressRatio * 25); // Rough estimate
                }
            }
        }

        // Case 2: Significant progress regression indicating re-reading
        if (previousProgressPercentage >= HIGH_PROGRESS_THRESHOLD && newProgressPercentage <= REREAD_THRESHOLD) {
            result.createNew = true;
            result.reason = `Significant progress regression detected: ${previousProgressPercentage.toFixed(1)}% → ${newProgressPercentage.toFixed(1)}% (likely re-reading)`;
            return result;
        }

        // Case 3: Progress regression protection (warn but don't create new session)
        if (previousProgressPercentage > 0 && 
            (previousProgressPercentage - newProgressPercentage) > REGRESSION_WARNING_THRESHOLD &&
            previousProgressPercentage >= HIGH_PROGRESS_THRESHOLD) {
            result.isRegression = true;
            result.reason = `Progress regression: ${previousProgressPercentage.toFixed(1)}% → ${newProgressPercentage.toFixed(1)}%`;
        }

        return result;
    }

    async markBookCompleted(userBookId, editionId, totalValue, useSeconds = false, finishedAt = null, startedAt = null) {
        // First get the user_book_read record ID
        const progressInfo = await this.getBookCurrentProgress(userBookId);
        let readId;
        
        if (!progressInfo || !progressInfo.latest_read || !progressInfo.latest_read.id) {
            // No existing progress record, create one with 100% progress
            logger.debug('No existing progress record found, creating new one for completion');
            const newRecord = await this.insertUserBookRead(userBookId, totalValue, editionId, startedAt, useSeconds);
            if (!newRecord) {
                logger.error('Failed to create new progress record for completion');
                return false;
            }
            readId = newRecord.id;
        } else {
            readId = progressInfo.latest_read.id;
        }

        // Build mutation with optional finishedAt and startedAt
        let mutation, variables;
        if (useSeconds) {
            mutation = `
                mutation markBookCompleted($id: Int!, $editionId: Int!, $seconds: Int!${finishedAt ? ", $finishedAt: date" : ""}${startedAt ? ", $startedAt: date" : ""}) {
                    update_user_book_read(
                        id: $id,
                        object: {
                            progress_seconds: $seconds,
                            edition_id: $editionId${finishedAt ? ",\n                            finished_at: $finishedAt" : ""}${startedAt ? ",\n                            started_at: $startedAt" : ""}
                        }
                    ) {
                        error
                        user_book_read {
                            id
                            progress_seconds
                            finished_at
                            started_at
                            edition_id
                        }
                    }
                }
            `;
            variables = {
                id: readId,
                editionId,
                seconds: totalValue
            };
            if (finishedAt) variables.finishedAt = finishedAt;
            if (startedAt) variables.startedAt = startedAt;
        } else {
            mutation = `
                mutation markBookCompleted($id: Int!, $editionId: Int!, $pages: Int!${finishedAt ? ", $finishedAt: date" : ""}${startedAt ? ", $startedAt: date" : ""}) {
                    update_user_book_read(
                        id: $id,
                        object: {
                            progress_pages: $pages,
                            edition_id: $editionId${finishedAt ? ",\n                            finished_at: $finishedAt" : ""}${startedAt ? ",\n                            started_at: $startedAt" : ""}
                        }
                    ) {
                        error
                        user_book_read {
                            id
                            progress_pages
                            finished_at
                            started_at
                            edition_id
                        }
                    }
                }
            `;
            variables = {
                id: readId,
                editionId,
                pages: totalValue
            };
            if (finishedAt) variables.finishedAt = finishedAt;
            if (startedAt) variables.startedAt = startedAt;
        }

        try {
            const result = await this._executeQuery(mutation, variables);
            if (result && result.update_user_book_read && result.update_user_book_read.user_book_read) {
                // Also update the book status to "Read" (status_id = 3)
                const statusUpdated = await this.updateBookStatus(userBookId, 3);
                if (!statusUpdated) {
                    logger.warn('Progress updated but failed to change book status to Read');
                }
                return result.update_user_book_read.user_book_read;
            }
            return false;
        } catch (error) {
            logger.error('Error marking book completed:', error.message);
            return false;
        }
    }

    async updateBookStatus(userBookId, statusId) {
        const mutation = `
            mutation updateBookStatus($userBookId: Int!, $statusId: Int!) {
                update_user_book(
                    id: $userBookId,
                    object: {
                        status_id: $statusId
                    }
                ) {
                    error
                    user_book {
                        id
                        status_id
                    }
                }
            }
        `;

        const variables = {
            userBookId,
            statusId
        };

        try {
            const result = await this._executeQuery(mutation, variables);
            return result && result.update_user_book && result.update_user_book.user_book;
        } catch (error) {
            logger.error('Error updating book status:', error.message);
            return false;
        }
    }

    async getBookCurrentProgress(userBookId) {
        const query = `
            query getBookProgress($userBookId: Int!) {
                user_book_reads(where: {user_book_id: {_eq: $userBookId}}, order_by: {id: desc}, limit: 1) {
                    id
                    progress_pages
                    progress_seconds
                    user_book_id
                    edition_id
                    started_at
                    finished_at
                    edition {
                        id
                        pages
                        audio_seconds
                    }
                }
                user_books(where: {id: {_eq: $userBookId}}) {
                    id
                    status_id
                    book {
                        id
                        editions {
                            id
                            pages
                            audio_seconds
                        }
                    }
                }
            }
        `;
        const variables = { userBookId };
        try {
            const result = await this._executeQuery(query, variables);
            if (result && result.user_book_reads && result.user_book_reads.length > 0) {
                return {
                    latest_read: result.user_book_reads[0],
                    user_book: result.user_books && result.user_books[0] ? result.user_books[0] : null,
                    has_progress: true
                };
            }
            return { latest_read: null, user_book: null, has_progress: false };
        } catch (error) {
            logger.error('Error getting book current progress:', error.message);
            return { latest_read: null, user_book: null, has_progress: false };
        }
    }

    async insertUserBookRead(userBookId, currentProgress, editionId, startedAt, useSeconds = false) {
        const mutation = useSeconds ? `
            mutation InsertUserBookRead($id: Int!, $seconds: Int, $editionId: Int, $startedAt: date) {
                insert_user_book_read(user_book_id: $id, user_book_read: {
                    progress_seconds: $seconds,
                    edition_id: $editionId,
                    started_at: $startedAt
                }) {
                    error
                    user_book_read {
                        id
                        started_at
                        finished_at
                        edition_id
                        progress_seconds
                    }
                }
            }
        ` : `
            mutation InsertUserBookRead($id: Int!, $pages: Int, $editionId: Int, $startedAt: date) {
                insert_user_book_read(user_book_id: $id, user_book_read: {
                    progress_pages: $pages,
                    edition_id: $editionId,
                    started_at: $startedAt
                }) {
                    error
                    user_book_read {
                        id
                        started_at
                        finished_at
                        edition_id
                        progress_pages
                    }
                }
            }
        `;
        const variables = useSeconds ? {
            id: userBookId,
            seconds: currentProgress,
            editionId,
            startedAt
        } : {
            id: userBookId,
            pages: currentProgress,
            editionId,
            startedAt
        };
        try {
            const result = await this._executeQuery(mutation, variables);
            if (result && result.insert_user_book_read && result.insert_user_book_read.user_book_read) {
                const newRecord = result.insert_user_book_read.user_book_read;
                logger.debug(`Created new progress record with start date: ${newRecord.started_at}`);
                return newRecord;
            }
            return null;
        } catch (error) {
            logger.error('Error inserting user book read:', error.message);
            return null;
        }
    }

    async searchBooksByIsbn(isbn) {
        const query = `
            query searchBooksByIsbn($isbn: String!) {
                editions(where: { _or: [{ isbn_10: { _eq: $isbn } }, { isbn_13: { _eq: $isbn } }] }) {
                    id
                    isbn_10
                    isbn_13
                    pages
                    audio_seconds
                    physical_format
                    reading_format { format }
                    book {
                        id
                        title
                        contributions(where: {contributable_type: {_eq: "Book"}}) {
                            author {
                                id
                                name
                            }
                        }
                    }
                }
            }
        `;

        const variables = { isbn };

        try {
            const result = await this._executeQuery(query, variables);
            return result && result.editions ? result.editions : [];
        } catch (error) {
            logger.error('Error searching books by ISBN:', error.message);
            return [];
        }
    }

    async searchBooksByAsin(asin) {
        const query = `
            query searchBooksByAsin($asin: String!) {
                editions(where: { asin: { _eq: $asin } }) {
                    id
                    isbn_10
                    isbn_13
                    asin
                    pages
                    audio_seconds
                    physical_format
                    reading_format { format }
                    book {
                        id
                        title
                        contributions(where: {contributable_type: {_eq: "Book"}}) {
                            author {
                                id
                                name
                            }
                        }
                    }
                }
            }
        `;

        const variables = { asin };

        try {
            const result = await this._executeQuery(query, variables);
            return result && result.editions ? result.editions : [];
        } catch (error) {
            logger.error('Error searching books by ASIN:', error.message);
            return [];
        }
    }

    async addBookToLibrary(bookId, statusId = 2, editionId = null) {
        console.log('DEBUG: Running addBookToLibrary with insert_user_book mutation');
        const mutation = `
            mutation addBookToLibrary($bookId: Int!, $statusId: Int!, $editionId: Int) {
                insert_user_book(object: {
                    book_id: $bookId,
                    status_id: $statusId,
                    edition_id: $editionId
                }) {
                    id
                }
            }
        `;

        const variables = {
            bookId,
            statusId,
            editionId
        };

        try {
            const result = await this._executeQuery(mutation, variables);
            if (result && result.insert_user_book && result.insert_user_book.id) {
                // Return a minimal object with just the id since that's all we get
                return { id: result.insert_user_book.id };
            }
            return null;
        } catch (error) {
            logger.error('Error adding book to library:', error.message);
            return null;
        }
    }

    async getDetailedSchema() {
        const query = `
            query DetailedIntrospectionQuery {
                __schema {
                    types {
                        name
                        kind
                        fields {
                            name
                            type {
                                name
                                kind
                                ofType {
                                    name
                                    kind
                                }
                            }
                        }
                        inputFields {
                            name
                            type {
                                name
                                kind
                                ofType {
                                    name
                                    kind
                                }
                            }
                        }
                    }
                }
            }
        `;

        try {
            const result = await this._executeQuery(query);
            return result;
        } catch (error) {
            logger.error('Error getting detailed schema:', error.message);
            return null;
        }
    }

    async _executeQuery(query, variables = null) {
        // Use single identifier for all Hardcover requests to respect 55/minute total limit
        const identifier = 'hardcover-api';
        
        await this.rateLimiter.waitIfNeeded(identifier);

        // Restore requestType for logging
        const requestType = query.trim().startsWith('mutation') ? 'mutation' : 'query';

        // Debug logging for mutations
        if (requestType === 'mutation') {
            logger.debug('🔍 [DEBUG] Hardcover Mutation:');
            logger.debug('Query:', query);
            logger.debug('Variables:', JSON.stringify(variables, null, 2));
        }

        try {
            const requestData = {
                query,
                variables
            };

            const response = await this.client.post('', requestData);
            
            // Validate response
            if (!response || !response.data) {
                throw new Error('Invalid response from GraphQL API');
            }
            
            if (response.status < 200 || response.status >= 300) {
                throw new Error(`GraphQL API request failed with status ${response.status}: ${response.statusText}`);
            }
            
            logger.debug(`GraphQL query executed successfully`);
            
            if (response.data.errors) {
                logger.error('GraphQL errors:', response.data.errors);
                throw new Error(`GraphQL errors: ${response.data.errors.map(e => e.message).join(', ')}`);
            }
            
            if (!response.data.data) {
                throw new Error('GraphQL response contains no data');
            }
            
            // Debug logging for mutation responses
            if (query.trim().startsWith('mutation')) {
                logger.debug('🔍 [DEBUG] Hardcover Response:');
                logger.debug(JSON.stringify(response.data, null, 2));
            }
            
            return response.data.data;
        } catch (error) {
            if (error.response) {
                logger.error(`HTTP ${error.response.status} error:`, error.response.data);
                throw new Error(`HTTP ${error.response.status}: ${error.response.data?.message || error.message}`);
            } else if (error.request) {
                logger.error('Network error:', error.message);
                throw new Error(`Network error: ${error.message}`);
            } else {
                logger.error('Request error:', error.message);
                throw error;
            }
        }
    }

    async getCurrentUser() {
        const query = `
            query {
                me {
                    id
                    username
                    email
                }
            }
        `;

        try {
            const result = await this._executeQuery(query);
            return result && result.me ? result.me : null;
        } catch (error) {
            logger.error('Error getting current user:', error.message);
            return null;
        }
    }

    async searchBooksByTitle(title, authorName = null) {
        logger.info(`Searching Hardcover by title: "${title}"${authorName ? ` by ${authorName}` : ''}`);
        
        // Start with slug search since it's most reliable and fast
        const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        
        const queries = [
            // Try slug search first (fastest and most reliable)
            {
                name: 'slug',
                query: `
                    query searchBooksBySlug($slug: String!) {
                        books(where: { slug: { _eq: $slug } }, limit: 10) {
                            id
                            title
                            slug
                            contributions(where: {contributable_type: {_eq: "Book"}}) {
                                author {
                                    id
                                    name
                                }
                            }
                            editions {
                                id
                                isbn_10
                                isbn_13
                                asin
                                pages
                                audio_seconds
                                physical_format
                                reading_format { format }
                            }
                        }
                    }
                `,
                variables: { slug: slug }
            },
            // Fallback to exact title search
            {
                name: 'exact',
                query: `
                    query searchBooksByTitleExact($title: String!) {
                        books(where: { title: { _eq: $title } }, limit: 10) {
                            id
                            title
                            slug
                            contributions(where: {contributable_type: {_eq: "Book"}}) {
                                author {
                                    id
                                    name
                                }
                            }
                            editions {
                                id
                                isbn_10
                                isbn_13
                                asin
                                pages
                                audio_seconds
                                physical_format
                                reading_format { format }
                            }
                        }
                    }
                `,
                variables: { title: title }
            }
        ];

        let allBooks = [];

        for (const queryInfo of queries) {
            try {
                logger.info(`  Trying ${queryInfo.name} title search...`);
                const result = await this._executeQuery(queryInfo.query, queryInfo.variables);
                
                if (result && result.books && result.books.length > 0) {
                    logger.info(`  ${queryInfo.name} search found ${result.books.length} results`);
                    allBooks.push(...result.books);
                    
                    // If slug search succeeded, no need to try other methods
                    if (queryInfo.name === 'slug') {
                        logger.info(`  Slug search successful, skipping other search methods`);
                        break;
                    }
                } else {
                    logger.info(`  ${queryInfo.name} search found no results`);
                }
            } catch (error) {
                logger.error(`Error in ${queryInfo.name} title search:`, error.message);
                // Continue to next search strategy
            }
        }

        if (allBooks.length === 0) {
            logger.info('No books found with any title search strategy');
            return [];
        }

        // Remove duplicates
        const uniqueBooks = allBooks.filter((book, index, self) => 
            index === self.findIndex(b => b.id === book.id)
        );
        
        logger.info(`Found ${uniqueBooks.length} unique books from title searches`);

        // If author name is provided, filter results by author
        let books = uniqueBooks;
        if (authorName && books.length > 0) {
            logger.info(`Filtering ${books.length} results by author: ${authorName}`);
            
            const normalizedSearchAuthor = authorName.toLowerCase().trim();
            const searchAuthorParts = this._extractAuthorParts(normalizedSearchAuthor);
            
            books = books.filter(book => {
                if (!book.contributions || book.contributions.length === 0) {
                    logger.debug(`Book "${book.title}" has no contributions, skipping`);
                    return false;
                }
                
                // Check if any author matches
                const authorMatch = book.contributions.some(contrib => {
                    if (!contrib.author || !contrib.author.name) return false;
                    const bookAuthor = contrib.author.name.toLowerCase().trim();
                    const bookAuthorParts = this._extractAuthorParts(bookAuthor);
                    
                    logger.debug(`Comparing authors: "${authorName}" vs "${contrib.author.name}"`);
                    
                    // Multiple matching strategies
                    const exactMatch = bookAuthor === normalizedSearchAuthor;
                    const containsMatch = bookAuthor.includes(normalizedSearchAuthor) || 
                                        normalizedSearchAuthor.includes(bookAuthor);
                    
                    // Check if last names match (most reliable for author matching)
                    const lastNameMatch = searchAuthorParts.lastName && bookAuthorParts.lastName &&
                                         searchAuthorParts.lastName === bookAuthorParts.lastName;
                    
                    // Check if initials match (e.g., "J.K." matches "J. K." or "Joanne Kathleen")
                    const initialsMatch = this._checkInitialsMatch(searchAuthorParts, bookAuthorParts);
                    
                    const isMatch = exactMatch || containsMatch || lastNameMatch || initialsMatch;
                    
                    if (isMatch) {
                        logger.debug(`✅ Author match found: "${normalizedSearchAuthor}" matches "${bookAuthor}"`);
                    }
                    
                    return isMatch;
                });
                
                if (!authorMatch) {
                    const bookAuthors = book.contributions.map(c => c.author?.name).filter(Boolean).join(', ');
                    logger.debug(`❌ No author match for "${book.title}" by ${bookAuthors}`);
                }
                
                return authorMatch;
            });
            
            logger.info(`Found ${books.length} books matching both title and author`);
        }

        // Convert to the same format as ISBN/ASIN search (return editions with book info)
        const editions = [];
        for (const book of books) {
            if (book.editions && book.editions.length > 0) {
                for (const edition of book.editions) {
                    editions.push({
                        ...edition,
                        book: {
                            id: book.id,
                            title: book.title,
                            slug: book.slug,
                            contributions: book.contributions
                        }
                    });
                }
            }
        }

        logger.info(`Title search returned ${editions.length} editions from ${books.length} books`);
        return editions;
    }

    /**
     * Enhanced search that tries alternative identifiers when original search fails
     * @param {string} asin - Original ASIN
     * @param {string} title - Book title
     * @param {string} author - Author name
     * @returns {Array} Array of book editions found
     */
    async searchWithAlternativeIdentifiers(asin, title, author) {
        logger.info(`🔄 Enhanced search for "${title}" by ${author}`);
        logger.info(`🎯 Priority: Identifier-based search first, then title fallback`);
        
        let results = [];
        
        // === PHASE 1: EXHAUSTIVE IDENTIFIER SEARCH ===
        logger.info(`\n📋 PHASE 1: IDENTIFIER-BASED SEARCH`);
        
        // Step 1: Try original ASIN
        if (asin) {
            logger.info(`🔍 Step 1: Trying original audiobook ASIN: ${asin}`);
            results = await this.searchBooksByAsin(asin);
            if (results.length > 0) {
                logger.info(`✅ Found ${results.length} results with original ASIN`);
                return results;
            }
            logger.info(`❌ No results with original ASIN`);
        } else {
            logger.info(`⚠️  No ASIN available for identifier search`);
        }

        // Step 2: Get alternative identifiers using external APIs
        let alternatives = { alternative_asins: [], isbns: [], sources: [] };
        if (title && author) {
            logger.info(`🔍 Step 2: Looking up identifiers using external APIs (title + author)...`);
            
            try {
                // Even without an original ASIN, we can still find identifiers from title/author
                alternatives = await this.identifierLookup.findAlternativeIdentifiers(asin, title, author);
                logger.info(`📊 External API results:`);
                logger.info(`  - ${alternatives.alternative_asins.length} ASINs found`);
                logger.info(`  - ${alternatives.isbns.length} ISBNs found`);
                logger.info(`  - Sources: ${alternatives.sources.join(', ') || 'None'}`);
                
                if (alternatives.alternative_asins.length === 0 && alternatives.isbns.length === 0) {
                    logger.warn(`❌ External APIs found no identifiers for "${title}" by ${author}`);
                }
            } catch (error) {
                logger.warn('Error during alternative identifier lookup:', error.message);
            }
        } else {
            logger.warn(`⚠️  Cannot lookup identifiers - missing title or author`);
        }

        // Step 3: Try ALL alternative ASINs (print/ebook versions)
        if (alternatives.alternative_asins.length > 0) {
            logger.info(`🔍 Step 3: Trying ${alternatives.alternative_asins.length} alternative ASINs (print/ebook versions)...`);
            for (const altAsin of alternatives.alternative_asins) {
                logger.debug(`  🔍 Trying alternative ASIN: ${altAsin}`);
                results = await this.searchBooksByAsin(altAsin);
                if (results.length > 0) {
                    logger.info(`✅ Found ${results.length} results with alternative ASIN: ${altAsin}`);
                    return results;
                }
            }
            logger.info(`❌ No results with any alternative ASINs`);
        }

        // Step 4: Try ALL ISBNs
        if (alternatives.isbns.length > 0) {
            logger.info(`🔍 Step 4: Trying ${alternatives.isbns.length} ISBNs...`);
            for (const isbn of alternatives.isbns) {
                logger.debug(`  🔍 Trying ISBN: ${isbn}`);
                results = await this.searchBooksByIsbn(isbn);
                if (results.length > 0) {
                    logger.info(`✅ Found ${results.length} results with ISBN: ${isbn}`);
                    return results;
                }
            }
            logger.info(`❌ No results with any ISBNs`);
        }

        // === PHASE 2: TITLE-BASED SEARCH (FALLBACK) ===
        logger.info(`\n📋 PHASE 2: TITLE-BASED SEARCH (FALLBACK)`);
        logger.warn(`⚠️  All identifier searches failed, falling back to title matching...`);
        
        if (title && author) {
            // Step 5: Try cleaned title (removes "06 " prefixes etc.)
            logger.info(`🔍 Step 5: Trying title search with cleaned title...`);
            const cleanedTitle = IdentifierLookupService.cleanTitle(title);
            if (cleanedTitle !== title) {
                logger.info(`  📖 Cleaned title: "${title}" → "${cleanedTitle}"`);
                results = await this.searchBooksByTitle(cleanedTitle, author);
                if (results.length > 0) {
                    logger.info(`✅ Found ${results.length} results with cleaned title`);
                    return results;
                }
                logger.info(`❌ No results with cleaned title`);
            }

            // Step 6: Try original title as last resort
            logger.info(`🔍 Step 6: Trying original title search as final fallback...`);
            results = await this.searchBooksByTitle(title, author);
            if (results.length > 0) {
                logger.info(`✅ Found ${results.length} results with original title`);
                return results;
            }
            logger.info(`❌ No results with original title`);
        } else {
            logger.warn(`⚠️  Cannot do title search - missing title or author`);
        }

        logger.warn(`❌ SEARCH EXHAUSTED: No results found with any method`);
        logger.warn(`   - Tried original ASIN: ${asin ? 'Yes' : 'No'}`);
        logger.warn(`   - Tried ${alternatives.alternative_asins.length} alternative ASINs`);
        logger.warn(`   - Tried ${alternatives.isbns.length} ISBNs`);
        logger.warn(`   - Tried title searches: ${title && author ? 'Yes' : 'No'}`);
        
        return [];
    }

    /**
     * Extract author name parts for better matching
     * @param {string} authorName - Full author name
     * @returns {Object} Object with firstName, lastName, initials
     */
    _extractAuthorParts(authorName) {
        if (!authorName) return {};
        
        const parts = authorName.split(/\s+/).filter(Boolean);
        const result = {
            firstName: '',
            lastName: '',
            initials: []
        };
        
        if (parts.length === 0) return result;
        
        // Extract last name (usually the last part)
        result.lastName = parts[parts.length - 1].replace(/[.,]/g, '');
        
        // Extract first name and initials
        if (parts.length > 1) {
            result.firstName = parts[0].replace(/[.,]/g, '');
            
            // Extract initials from all parts except last
            result.initials = parts.slice(0, -1).map(part => {
                const clean = part.replace(/[.,]/g, '');
                return clean.length === 1 ? clean : clean.charAt(0);
            });
        }
        
        return result;
    }

    /**
     * Check if initials match between two author name parts
     * @param {Object} searchParts - Parsed search author
     * @param {Object} bookParts - Parsed book author
     * @returns {boolean} True if initials match
     */
    _checkInitialsMatch(searchParts, bookParts) {
        if (!searchParts.initials || !bookParts.initials) return false;
        if (searchParts.initials.length === 0 || bookParts.initials.length === 0) return false;
        
        // Check if search initials match the beginning of book initials
        // e.g., "J.K." should match "J.K.R." or "Joanne K."
        const searchInitials = searchParts.initials.map(i => i.toLowerCase());
        const bookInitials = bookParts.initials.map(i => i.toLowerCase());
        
        // All search initials should be found in book initials
        return searchInitials.every((initial, index) => 
            index < bookInitials.length && bookInitials[index] === initial
        );
    }
} 