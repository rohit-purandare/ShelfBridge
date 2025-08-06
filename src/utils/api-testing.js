/**
 * API testing and validation utilities
 *
 * This module provides utilities for testing API connections
 * and validating service connectivity.
 */
import logger from '../logger.js';

/**
 * Test API connections for a user
 * @param {Object} user - User configuration object
 * @returns {Object} - Results of connection tests
 */
export async function testApiConnections(user) {
  const results = {
    abs: false,
    hardcover: false,
    errors: [],
  };

  try {
    // Test Audiobookshelf connection
    const { AudiobookshelfClient } = await import(
      '../audiobookshelf-client.js'
    );
    const absClient = new AudiobookshelfClient(user.abs_url, user.abs_token);
    results.abs = await absClient.testConnection();

    if (!results.abs) {
      results.errors.push('Audiobookshelf connection failed');
    }
  } catch (error) {
    logger.debug('Audiobookshelf connection test failed', {
      error: error.message,
    });
    results.errors.push('Audiobookshelf connection failed');
    results.errors.push(`Audiobookshelf: ${error.message}`);
  }

  try {
    // Test Hardcover connection
    const { HardcoverClient } = await import('../hardcover-client.js');
    const hardcoverClient = new HardcoverClient(user.hardcover_token);
    results.hardcover = await hardcoverClient.testConnection();

    if (!results.hardcover) {
      results.errors.push('Hardcover connection failed');
    }
  } catch (error) {
    logger.debug('Hardcover connection test failed', { error: error.message });
    results.errors.push('Hardcover connection failed');
    results.errors.push(`Hardcover: ${error.message}`);
  }

  return results;
}
