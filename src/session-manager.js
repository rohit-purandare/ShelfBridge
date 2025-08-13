/**
 * SessionManager - Handles session-based delayed updates
 *
 * This class manages reading sessions and determines when to delay or immediately
 * sync progress updates to Hardcover. It works in conjunction with BookCache
 * to track session state and timeouts.
 */
import logger from './logger.js';
import ProgressManager from './progress-manager.js';

export class SessionManager {
  constructor(cache, delayedUpdatesConfig = {}) {
    this.cache = cache;
    this.config = {
      enabled: false,
      sessionTimeout: 900, // 15 minutes in seconds
      maxDelay: 3600, // 1 hour in seconds
      immediateCompletion: true,
      ...delayedUpdatesConfig,
    };

    // Convert snake_case config keys to camelCase for internal use
    if (delayedUpdatesConfig['session_timeout']) {
      this.config.sessionTimeout = delayedUpdatesConfig['session_timeout'];
    }
    if (delayedUpdatesConfig['max_delay']) {
      this.config.maxDelay = delayedUpdatesConfig['max_delay'];
    }
    if (delayedUpdatesConfig['immediate_completion'] !== undefined) {
      this.config.immediateCompletion =
        delayedUpdatesConfig['immediate_completion'];
    }

    // Validate configuration
    this._validateConfig();

    logger.debug('SessionManager initialized', {
      enabled: this.config.enabled,
      sessionTimeout: this.config.sessionTimeout,
      maxDelay: this.config.maxDelay,
      immediateCompletion: this.config.immediateCompletion,
    });
  }

  /**
   * Validate delayed updates configuration
   * @private
   */
  _validateConfig() {
    const { sessionTimeout, maxDelay } = this.config;

    if (sessionTimeout < 60 || sessionTimeout > 7200) {
      throw new Error(
        `Invalid sessionTimeout: ${sessionTimeout}. Must be between 60 and 7200 seconds.`,
      );
    }

    if (maxDelay < 300 || maxDelay > 86400) {
      throw new Error(
        `Invalid maxDelay: ${maxDelay}. Must be between 300 and 86400 seconds.`,
      );
    }

    if (sessionTimeout >= maxDelay) {
      throw new Error(
        `sessionTimeout (${sessionTimeout}) must be less than maxDelay (${maxDelay})`,
      );
    }
  }

  /**
   * Check if delayed updates feature is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.config.enabled === true;
  }

  /**
   * Determine if progress update should be delayed or synced immediately
   * @param {string} userId - User ID
   * @param {string} identifier - Book identifier
   * @param {string} title - Book title
   * @param {number} progressPercent - Current progress percentage
   * @param {Object} bookData - Audiobookshelf book data
   * @param {string} identifierType - Identifier type (asin/isbn)
   * @returns {Promise<Object>} Decision object with action and details
   */
  async shouldDelayUpdate(
    userId,
    identifier,
    title,
    progressPercent,
    bookData,
    identifierType = 'isbn',
  ) {
    // If delayed updates are disabled, always sync immediately
    if (!this.isEnabled()) {
      return {
        action: 'sync_immediately',
        reason: 'delayed_updates_disabled',
        shouldDelay: false,
      };
    }

    // Check if book is complete - always sync completions immediately if configured
    const isComplete = ProgressManager.isBookComplete(
      bookData,
      `${title} completion check`,
    );
    if (isComplete && this.config.immediateCompletion) {
      return {
        action: 'sync_immediately',
        reason: 'book_completion',
        shouldDelay: false,
        isCompletion: true,
      };
    }

    // Check if we've hit the maximum delay limit
    const maxDelayExceeded = await this._isMaxDelayExceeded(
      userId,
      identifier,
      title,
      identifierType,
    );
    if (maxDelayExceeded) {
      return {
        action: 'sync_immediately',
        reason: 'max_delay_exceeded',
        shouldDelay: false,
        forcedSync: true,
      };
    }

    // Check for significant progress changes that warrant immediate sync
    const hasSignificantChange = await this._hasSignificantProgressChange(
      userId,
      identifier,
      title,
      progressPercent,
      identifierType,
    );

    if (hasSignificantChange.isSignificant) {
      return {
        action: 'sync_immediately',
        reason: 'significant_progress_change',
        shouldDelay: false,
        changeDetails: hasSignificantChange,
      };
    }

    // Default: delay the update (store in session)
    return {
      action: 'delay_update',
      reason: 'active_session_detected',
      shouldDelay: true,
      sessionTimeout: this.config.sessionTimeout,
    };
  }

  /**
   * Check if maximum delay has been exceeded for a book
   * @param {string} userId - User ID
   * @param {string} identifier - Book identifier
   * @param {string} title - Book title
   * @param {string} identifierType - Identifier type
   * @returns {Promise<boolean>}
   * @private
   */
  async _isMaxDelayExceeded(userId, identifier, title, identifierType) {
    try {
      // Check when we last synced to Hardcover
      const stmt = this.cache.db.prepare(`
        SELECT last_hardcover_sync 
        FROM books 
        WHERE user_id = ? AND identifier = ? AND identifier_type = ? AND title = ?
      `);

      const result = stmt.get(
        userId,
        identifier,
        identifierType,
        title.toLowerCase().trim(),
      );

      if (!result || !result.last_hardcover_sync) {
        // No previous sync recorded, not exceeded
        return false;
      }

      const lastSyncTime = new Date(result.last_hardcover_sync);
      const maxDelayMs = this.config.maxDelay * 1000;
      const timeSinceLastSync = Date.now() - lastSyncTime.getTime();

      const exceeded = timeSinceLastSync >= maxDelayMs;
      if (exceeded) {
        logger.debug(`Max delay exceeded for ${title}`, {
          lastSync: result.last_hardcover_sync,
          timeSinceLastSync: Math.round(timeSinceLastSync / 1000),
          maxDelaySeconds: this.config.maxDelay,
        });
      }

      return exceeded;
    } catch (err) {
      logger.error(`Error checking max delay for ${title}: ${err.message}`);
      return false; // Conservative: don't force sync on error
    }
  }

  /**
   * Check for significant progress changes that should trigger immediate sync
   * @param {string} userId - User ID
   * @param {string} identifier - Book identifier
   * @param {string} title - Book title
   * @param {number} currentProgress - Current progress percentage
   * @param {string} identifierType - Identifier type
   * @returns {Promise<Object>} Change analysis
   * @private
   */
  async _hasSignificantProgressChange(
    userId,
    identifier,
    title,
    currentProgress,
    identifierType,
  ) {
    try {
      // Get the last progress we synced to Hardcover (not the cached progress)
      const stmt = this.cache.db.prepare(`
        SELECT progress_percent, session_pending_progress, last_hardcover_sync
        FROM books 
        WHERE user_id = ? AND identifier = ? AND identifier_type = ? AND title = ?
      `);

      const result = stmt.get(
        userId,
        identifier,
        identifierType,
        title.toLowerCase().trim(),
      );

      if (!result) {
        return {
          isSignificant: true,
          reason: 'no_previous_progress',
          oldProgress: null,
          newProgress: currentProgress,
        };
      }

      // Use the pending progress if available, otherwise use the cached progress
      const lastKnownProgress =
        result.session_pending_progress || result.progress_percent || 0;

      // Detect significant changes using ProgressManager
      const changeAnalysis = ProgressManager.detectProgressChange(
        lastKnownProgress,
        currentProgress,
        { threshold: 5.0, context: `${title} significant change detection` }, // 5% threshold for significant changes
      );

      // Consider changes significant if they're > 5% or represent major milestones
      const isSignificant =
        changeAnalysis.absoluteChange >= 5.0 ||
        this._isMilestoneProgress(lastKnownProgress, currentProgress);

      return {
        isSignificant,
        reason: isSignificant
          ? 'large_progress_jump'
          : 'normal_progress_increment',
        oldProgress: lastKnownProgress,
        newProgress: currentProgress,
        absoluteChange: changeAnalysis.absoluteChange,
        changeAnalysis,
      };
    } catch (err) {
      logger.error(
        `Error checking significant progress change for ${title}: ${err.message}`,
      );
      return {
        isSignificant: false,
        reason: 'error_checking_progress',
        error: err.message,
      };
    }
  }

  /**
   * Check if progress represents a milestone worth immediate sync
   * @param {number} oldProgress - Previous progress
   * @param {number} newProgress - New progress
   * @returns {boolean}
   * @private
   */
  _isMilestoneProgress(oldProgress, newProgress) {
    // Define milestone thresholds (every 25%)
    const milestones = [25, 50, 75, 90, 95, 100];

    for (const milestone of milestones) {
      if (oldProgress < milestone && newProgress >= milestone) {
        return true; // Crossed a milestone
      }
    }

    return false;
  }

  /**
   * Start or update a reading session for a book
   * @param {string} userId - User ID
   * @param {string} identifier - Book identifier
   * @param {string} title - Book title
   * @param {number} progressPercent - Current progress percentage
   * @param {string} identifierType - Identifier type
   * @returns {Promise<boolean>} Success status
   */
  async updateSession(
    userId,
    identifier,
    title,
    progressPercent,
    identifierType = 'isbn',
  ) {
    if (!this.isEnabled()) {
      return false; // No-op if disabled
    }

    try {
      const success = await this.cache.updateSessionProgress(
        userId,
        identifier,
        title,
        progressPercent,
        identifierType,
      );

      if (success) {
        logger.debug(`Updated session for ${title}: ${progressPercent}%`);
      }

      return success;
    } catch (err) {
      logger.error(`Error updating session for ${title}: ${err.message}`);
      return false;
    }
  }

  /**
   * Complete a reading session and sync final progress
   * @param {string} userId - User ID
   * @param {string} identifier - Book identifier
   * @param {string} title - Book title
   * @param {number} finalProgress - Final progress percentage
   * @param {string} identifierType - Identifier type
   * @returns {Promise<boolean>} Success status
   */
  async completeSession(
    userId,
    identifier,
    title,
    finalProgress,
    identifierType = 'isbn',
  ) {
    if (!this.isEnabled()) {
      return false; // No-op if disabled
    }

    try {
      const success = await this.cache.markSessionComplete(
        userId,
        identifier,
        title,
        finalProgress,
        identifierType,
      );

      if (success) {
        logger.debug(`Completed session for ${title}: ${finalProgress}%`);
      }

      return success;
    } catch (err) {
      logger.error(`Error completing session for ${title}: ${err.message}`);
      return false;
    }
  }

  /**
   * Get all expired sessions for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of expired session books
   */
  async getExpiredSessions(userId) {
    if (!this.isEnabled()) {
      return []; // No sessions if disabled
    }

    try {
      const expiredSessions = await this.cache.getExpiredSessions(
        userId,
        this.config.sessionTimeout,
      );

      if (expiredSessions.length > 0) {
        logger.debug(
          `Found ${expiredSessions.length} expired sessions for user ${userId}`,
        );
      }

      return expiredSessions;
    } catch (err) {
      logger.error(
        `Error getting expired sessions for user ${userId}: ${err.message}`,
      );
      return [];
    }
  }

  /**
   * Process expired sessions by syncing their final progress
   * @param {string} userId - User ID
   * @param {Function} syncCallback - Function to call for each expired session
   * @returns {Promise<Object>} Processing results
   */
  async processExpiredSessions(userId, syncCallback) {
    if (!this.isEnabled()) {
      return { processed: 0, errors: 0 }; // No-op if disabled
    }

    const expiredSessions = await this.getExpiredSessions(userId);
    let processed = 0;
    let errors = 0;

    for (const session of expiredSessions) {
      try {
        logger.debug(`Processing expired session for ${session.title}`);

        // Call the sync callback with session details
        await syncCallback({
          userId: session.user_id,
          identifier: session.identifier,
          identifierType: session.identifier_type,
          title: session.title,
          finalProgress: session.session_pending_progress,
          sessionData: session,
        });

        // Mark session as complete
        await this.completeSession(
          session.user_id,
          session.identifier,
          session.title,
          session.session_pending_progress,
          session.identifier_type,
        );

        processed++;
      } catch (err) {
        logger.error(
          `Error processing expired session for ${session.title}: ${err.message}`,
        );
        errors++;
      }
    }

    if (processed > 0 || errors > 0) {
      logger.info(`Processed expired sessions for user ${userId}`, {
        processed,
        errors,
        total: expiredSessions.length,
      });
    }

    return { processed, errors, total: expiredSessions.length };
  }

  /**
   * Get configuration summary for logging/debugging
   * @returns {Object} Configuration summary
   */
  getConfigSummary() {
    return {
      enabled: this.config.enabled,
      sessionTimeoutMinutes: Math.round(this.config.sessionTimeout / 60),
      maxDelayMinutes: Math.round(this.config.maxDelay / 60),
      immediateCompletion: this.config.immediateCompletion,
    };
  }
}

export default SessionManager;
