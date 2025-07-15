import axios from 'axios';
import logger from './logger.js';

/**
 * Service to find alternative book identifiers (ISBNs, ASINs) using external APIs
 * Useful when audiobook ASINs don't match print/ebook identifiers in Hardcover
 */
export class IdentifierLookupService {
    constructor() {
        this.openLibraryClient = axios.create({
            baseURL: 'https://openlibrary.org',
            timeout: 10000
        });
        
        this.googleBooksClient = axios.create({
            baseURL: 'https://www.googleapis.com/books/v1',
            timeout: 10000
        });
    }

    /**
     * Find alternative identifiers for a book using its ASIN, title, and author
     * @param {string} asin - The audiobook ASIN (optional)
     * @param {string} title - Book title for search and verification
     * @param {string} author - Author name for search and verification
     * @returns {Object} Object containing alternative identifiers
     */
    async findAlternativeIdentifiers(asin, title, author) {
        if (asin) {
            logger.info(`🔍 Looking for alternative identifiers for ASIN: ${asin}`);
        } else {
            logger.info(`🔍 Looking for identifiers using title and author (no ASIN available)`);
        }
        logger.info(`📖 Title: "${title}" by ${author}`);
        
        const alternatives = {
            original_asin: asin,
            alternative_asins: [],
            isbns: [],
            sources: []
        };

        try {
            // Try Open Library first (often has good cross-references)
            const openLibraryResults = await this._searchOpenLibrary(asin, title, author);
            if (openLibraryResults.isbns.length > 0 || openLibraryResults.asins.length > 0) {
                alternatives.isbns.push(...openLibraryResults.isbns);
                alternatives.alternative_asins.push(...openLibraryResults.asins);
                alternatives.sources.push('OpenLibrary');
                logger.info(`✅ OpenLibrary found: ${openLibraryResults.isbns.length} ISBNs, ${openLibraryResults.asins.length} ASINs`);
            }

            // Try Google Books as secondary source
            const googleBooksResults = await this._searchGoogleBooks(title, author);
            if (googleBooksResults.isbns.length > 0) {
                // Add new ISBNs that we don't already have
                const newIsbns = googleBooksResults.isbns.filter(isbn => !alternatives.isbns.includes(isbn));
                alternatives.isbns.push(...newIsbns);
                if (newIsbns.length > 0) {
                    alternatives.sources.push('GoogleBooks');
                    logger.info(`✅ GoogleBooks found: ${newIsbns.length} additional ISBNs`);
                }
            }

            // Remove duplicates and the original ASIN
            alternatives.alternative_asins = [...new Set(alternatives.alternative_asins)].filter(a => a !== asin);
            alternatives.isbns = [...new Set(alternatives.isbns)];

            logger.info(`🎯 Total alternatives found: ${alternatives.alternative_asins.length} ASINs, ${alternatives.isbns.length} ISBNs`);
            
            return alternatives;

        } catch (error) {
            logger.error('Error finding alternative identifiers:', error.message);
            return alternatives;
        }
    }

    /**
     * Search Open Library for alternative identifiers
     */
    async _searchOpenLibrary(asin, title, author) {
        const results = { isbns: [], asins: [] };
        
        try {
            // First try searching by title and author
            const searchQuery = `title:"${title}" author:"${author}"`;
            const searchUrl = `/search.json?q=${encodeURIComponent(searchQuery)}&limit=5`;
            
            logger.debug(`Searching OpenLibrary: ${searchUrl}`);
            const response = await this.openLibraryClient.get(searchUrl);
            
            if (response.data && response.data.docs) {
                for (const doc of response.data.docs.slice(0, 3)) { // Check top 3 results
                    // Verify this is likely the same book
                    if (this._isLikelyMatch(doc.title, title, doc.author_name, author)) {
                        // Extract ISBNs
                        if (doc.isbn) {
                            results.isbns.push(...doc.isbn);
                        }
                        
                        // Extract alternative ASINs (Amazon IDs)
                        if (doc.id_amazon) {
                            results.asins.push(...doc.id_amazon);
                        }
                        
                        // Get more details from the work if available
                        if (doc.key) {
                            try {
                                const workDetails = await this.openLibraryClient.get(`${doc.key}.json`);
                                // Extract additional identifiers from work details if needed
                            } catch (workError) {
                                logger.debug('Could not fetch work details:', workError.message);
                            }
                        }
                    }
                }
            }
            
        } catch (error) {
            logger.debug('OpenLibrary search failed:', error.message);
        }
        
        return results;
    }

    /**
     * Search Google Books for ISBNs
     */
    async _searchGoogleBooks(title, author) {
        const results = { isbns: [] };
        
        try {
            const query = `intitle:"${title}" inauthor:"${author}"`;
            const searchUrl = `/volumes?q=${encodeURIComponent(query)}&maxResults=5`;
            
            logger.debug(`Searching GoogleBooks: ${searchUrl}`);
            const response = await this.googleBooksClient.get(searchUrl);
            
            if (response.data && response.data.items) {
                for (const item of response.data.items.slice(0, 3)) { // Check top 3 results
                    const volumeInfo = item.volumeInfo;
                    
                    // Verify this is likely the same book
                    if (this._isLikelyMatch(volumeInfo.title, title, volumeInfo.authors, author)) {
                        // Extract ISBNs
                        if (volumeInfo.industryIdentifiers) {
                            for (const identifier of volumeInfo.industryIdentifiers) {
                                if (identifier.type === 'ISBN_13' || identifier.type === 'ISBN_10') {
                                    results.isbns.push(identifier.identifier);
                                }
                            }
                        }
                    }
                }
            }
            
        } catch (error) {
            logger.debug('GoogleBooks search failed:', error.message);
        }
        
        return results;
    }

    /**
     * Check if a search result is likely the same book
     */
    _isLikelyMatch(resultTitle, searchTitle, resultAuthors, searchAuthor) {
        if (!resultTitle || !searchTitle) return false;
        
        // Normalize titles for comparison
        const normalizeTitle = (title) => {
            return title.toLowerCase()
                .replace(/^[\d\s\-\.]+/, '') // Remove leading numbers like "06 "
                .replace(/[^\w\s]/g, '') // Remove punctuation
                .trim();
        };
        
        const normalizedResultTitle = normalizeTitle(resultTitle);
        const normalizedSearchTitle = normalizeTitle(searchTitle);
        
        // Check if titles match (allowing for some variation)
        const titleMatch = normalizedResultTitle.includes(normalizedSearchTitle) || 
                          normalizedSearchTitle.includes(normalizedResultTitle) ||
                          this._calculateSimilarity(normalizedResultTitle, normalizedSearchTitle) > 0.8;
        
        if (!titleMatch) return false;
        
        // Check author match
        if (resultAuthors && searchAuthor) {
            const authorList = Array.isArray(resultAuthors) ? resultAuthors : [resultAuthors];
            const normalizedSearchAuthor = searchAuthor.toLowerCase();
            
            const authorMatch = authorList.some(author => {
                const normalizedAuthor = author.toLowerCase();
                return normalizedAuthor.includes(normalizedSearchAuthor) || 
                       normalizedSearchAuthor.includes(normalizedAuthor);
            });
            
            return authorMatch;
        }
        
        return true; // If no author info, rely on title match
    }

    /**
     * Calculate similarity between two strings (simple Levenshtein-based)
     */
    _calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const distance = this._levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    _levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    /**
     * Clean and normalize title for better matching
     * Removes common prefixes like "01 ", "06 ", etc.
     */
    static cleanTitle(title) {
        if (!title) return title;
        
        return title
            .replace(/^[\d\s\-\.]+/, '') // Remove leading numbers and separators
            .replace(/^\s*(book|vol|volume)\s*[\d\s\-\.]+/i, '') // Remove "Book 1", "Vol 2", etc.
            .trim();
    }
}