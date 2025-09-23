/**
 * Progress Manager - Centralized progress handling utilities
 *
 * This module provides consistent progress percentage validation, boundary checking,
 * completion detection, and position calculations across all book formats.
 */
import logger from './logger.js';
import {
  extractAudioDurationFromAudiobookshelf,
  detectUserBookFormat,
} from './matching/index.js';

/**
 * Custom error class for progress validation issues
 */
export class ProgressValidationError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'ProgressValidationError';
    this.context = {
      timestamp: new Date().toISOString(),
      ...context,
    };
  }
}

/**
 * Centralized Progress Manager
 * Handles all progress-related operations with consistent validation
 */
export class ProgressManager {
  // Constants for consistent behavior across the application
  static PROGRESS_MIN = 0;
  static PROGRESS_MAX = 100;
  static DEFAULT_COMPLETION_THRESHOLD = 95;
  static DEFAULT_ZERO_THRESHOLD = 5;
  static SIGNIFICANT_CHANGE_THRESHOLD = 0.1;

  // Precise completion thresholds
  static COMPLETION_TIME_REMAINING_SECONDS = 120; // 2 minutes remaining for audiobooks
  static COMPLETION_PAGES_REMAINING = 3; // 3 pages remaining for books

  /**
   * Extract page count from Audiobookshelf book data
   * @param {Object} bookData - Audiobookshelf book data
   * @returns {number|null} Page count, or null if not available
   * @private
   */
  static _extractPageCount(bookData) {
    if (!bookData) return null;

    // Check direct pages field
    if (bookData.pages && bookData.pages > 0) {
      return bookData.pages;
    }

    // Check media.pages
    if (bookData.media && bookData.media.pages && bookData.media.pages > 0) {
      return bookData.media.pages;
    }

    // Check metadata.pages
    if (
      bookData.media &&
      bookData.media.metadata &&
      bookData.media.metadata.pages &&
      bookData.media.metadata.pages > 0
    ) {
      return bookData.media.metadata.pages;
    }

    return null;
  }

  /**
   * Extract current time position from Audiobookshelf book data
   * @param {Object} bookData - Audiobookshelf book data
   * @returns {number|null} Current time in seconds, or null if not available
   * @private
   */
  static _extractCurrentTime(bookData) {
    if (!bookData) return null;

    // Check direct current_time field
    if (
      bookData.current_time !== null &&
      bookData.current_time !== undefined &&
      bookData.current_time >= 0
    ) {
      return bookData.current_time;
    }

    // Check media.current_time
    if (
      bookData.media &&
      bookData.media.current_time !== null &&
      bookData.media.current_time !== undefined &&
      bookData.media.current_time >= 0
    ) {
      return bookData.media.current_time;
    }

    return null;
  }

  /**
   * Calculate accurate progress from actual position data in bookData
   * @param {Object} bookData - Audiobookshelf book data with position information
   * @param {string} format - Book format ('audiobook', 'ebook', 'physical', 'unknown')
   * @param {string} context - Context for logging
   * @returns {number|null} - Calculated progress percentage or null if no position data
   * @private
   */
  static _calculateProgressFromPosition(bookData, format, context) {
    if (!bookData) return null;

    if (format === 'audiobook') {
      const currentTime = this._extractCurrentTime(bookData);
      const totalDuration = extractAudioDurationFromAudiobookshelf(bookData);

      if (currentTime !== null && totalDuration && totalDuration > 0) {
        const calculatedProgress = this.calculateProgressFromPosition(
          currentTime,
          totalDuration,
          { type: 'seconds', context },
        );

        logger.debug(`Calculated progress from position data in ${context}`, {
          currentTime,
          totalDuration,
          calculatedProgress,
          method: 'position-based',
        });

        return calculatedProgress;
      }
    }

    // For books, we typically don't have current_page data from Audiobookshelf
    // so we'll fall back to the provided progress percentage

    return null; // No position data available
  }

  /**
   * Validate and normalize progress percentage with position-based accuracy
   * @param {number|string|null|undefined} progress - Progress value to validate
   * @param {string} context - Context for error reporting (e.g., "user sync", "book title")
   * @param {Object} options - Validation options
   * @param {boolean} options.allowNull - Whether to allow null/undefined values (default: true)
   * @param {boolean} options.strict - Whether to throw on invalid values (default: false)
   * @param {Object} options.bookData - Book metadata for position-based validation
   * @param {string} options.format - Book format for position-based validation
   * @param {boolean|number} options.isFinished - Explicit finished flag that takes priority over position calculations
   * @returns {number|null} - Validated progress percentage or null
   * @throws {ProgressValidationError} - When strict=true and validation fails
   */
  static validateProgress(progress, context = '', options = {}) {
    const {
      allowNull = true,
      strict = false,
      bookData = null,
      format = 'unknown',
      isFinished = null,
    } = options;

    // If explicitly marked as finished, trust that decision first
    if (isFinished === true || isFinished === 1) {
      const providedValidated = this._validateProgressNumber(
        progress,
        context,
        { allowNull: true, strict: false },
      );

      // If provided progress is valid, use it (respecting user's explicit completion)
      if (providedValidated !== null) {
        // Still calculate position-based progress for discrepancy reporting
        const calculatedProgress = this._calculateProgressFromPosition(
          bookData,
          format,
          context,
        );
        if (calculatedProgress !== null) {
          const discrepancy = Math.abs(providedValidated - calculatedProgress);
          if (discrepancy > 1.0) {
            // More than 1% difference
            logger.debug(`Progress discrepancy detected in ${context}`, {
              providedProgress: providedValidated,
              calculatedProgress: calculatedProgress,
              discrepancy,
              source: 'finished-flag-override',
            });
          }
        }

        return providedValidated;
      }

      // If no valid provided progress but explicitly finished, assume 100%
      return 100;
    }

    // Try to calculate accurate progress from position data
    const calculatedProgress = this._calculateProgressFromPosition(
      bookData,
      format,
      context,
    );

    if (calculatedProgress !== null) {
      // We have accurate position data - use it as source of truth
      const validatedCalculated = this._validateProgressNumber(
        calculatedProgress,
        context,
        { allowNull: false, strict },
      );

      // Check for discrepancy with provided progress if available
      if (progress !== null && progress !== undefined) {
        const providedValidated = this._validateProgressNumber(
          progress,
          context,
          { allowNull: true, strict: false },
        );
        if (providedValidated !== null) {
          const discrepancy = Math.abs(validatedCalculated - providedValidated);
          if (discrepancy > 1.0) {
            // More than 1% difference
            logger.debug(`Progress discrepancy detected in ${context}`, {
              providedProgress: providedValidated,
              calculatedProgress: validatedCalculated,
              discrepancy,
              source: 'position-data-override',
            });
          }
        }
      }

      return validatedCalculated;
    }

    // No position data available - validate provided progress
    return this._validateProgressNumber(progress, context, {
      allowNull,
      strict,
    });
  }

  /**
   * Core progress number validation (extracted for reuse)
   * @private
   */
  static _validateProgressNumber(progress, context, options = {}) {
    const { allowNull = true, strict = false } = options;

    // Handle null/undefined values
    if (progress === null || progress === undefined) {
      if (allowNull) {
        return null;
      }
      const error = new ProgressValidationError(
        `Progress cannot be null/undefined in ${context}`,
        { context, value: progress, allowNull },
      );
      if (strict) throw error;
      logger.warn(error.message, error.context);
      return null;
    }

    // Convert string to number if needed
    let numProgress;
    if (typeof progress === 'string') {
      numProgress = parseFloat(progress.trim());
    } else if (typeof progress === 'number') {
      numProgress = progress;
    } else {
      const error = new ProgressValidationError(
        `Invalid progress type in ${context}: expected number or string, got ${typeof progress}`,
        { context, value: progress, type: typeof progress },
      );
      if (strict) throw error;
      logger.warn(error.message, error.context);
      return null;
    }

    // Check for NaN
    if (isNaN(numProgress)) {
      const error = new ProgressValidationError(
        `Progress is not a valid number in ${context}: ${progress}`,
        { context, value: progress, converted: numProgress },
      );
      if (strict) throw error;
      logger.warn(error.message, error.context);
      return null;
    }

    // Check for infinite values
    if (!isFinite(numProgress)) {
      const error = new ProgressValidationError(
        `Progress must be finite in ${context}: ${progress}`,
        { context, value: progress, converted: numProgress },
      );
      if (strict) throw error;
      logger.warn(error.message, error.context);
      return null;
    }

    // Enforce boundaries and log warnings for out-of-range values
    const originalProgress = numProgress;
    numProgress = Math.max(
      this.PROGRESS_MIN,
      Math.min(this.PROGRESS_MAX, numProgress),
    );

    if (originalProgress !== numProgress) {
      logger.warn(`Progress clamped to valid range in ${context}`, {
        original: originalProgress,
        clamped: numProgress,
        context,
      });
    }

    return numProgress;
  }

  /**
   * Check if progress represents completion across all book formats
   * @param {number|string|null} progress - Progress value to check
   * @param {Object} options - Completion options
   * @param {number} options.threshold - Completion threshold (default: 95)
   * @param {boolean} options.isFinished - Explicit finished flag from source system
   * @param {string} options.context - Context for logging
   * @param {string} options.format - Book format ('audiobook', 'ebook', 'physical', 'unknown')
   * @param {Object} options.bookData - Additional book metadata for precise completion detection
   * @returns {boolean} - Whether the book is considered complete
   */
  static isComplete(progress, options = {}) {
    const {
      threshold = this.DEFAULT_COMPLETION_THRESHOLD,
      isFinished = null,
      context = '',
      format = 'unknown',
      _bookData = {}, // Book metadata for precise completion detection
    } = options;

    // Explicit finished flag takes precedence for ALL formats
    if (isFinished === true || isFinished === 1) {
      logger.debug(
        `Book detected as complete via isFinished flag in ${context}`,
        {
          format,
          explicitFlag: isFinished,
        },
      );
      return true;
    }

    if (isFinished === false || isFinished === 0) {
      logger.debug(`Book explicitly marked as not finished in ${context}`, {
        format,
        explicitFlag: isFinished,
      });
      return false;
    }

    // Validate progress percentage, passing isFinished flag to respect explicit completion
    const validatedProgress = this.validateProgress(progress, context, {
      bookData: _bookData,
      format: format,
      isFinished: isFinished,
    });
    if (validatedProgress === null) {
      logger.debug(`Book not complete - invalid progress in ${context}`, {
        format,
        originalProgress: progress,
      });
      return false;
    }

    // Apply format-aware completion logic with precise position-based detection
    const isCompleteByProgress = this._isCompleteByFormat(
      validatedProgress,
      threshold,
      format,
      context,
      _bookData,
    );

    if (isCompleteByProgress) {
      logger.debug(`Book detected as complete by progress in ${context}`, {
        progress: validatedProgress,
        threshold,
        format,
        detectionMethod: 'progress-based',
      });
    }

    return isCompleteByProgress;
  }

  /**
   * Format-aware completion detection with precise position-based criteria
   * @private
   */
  static _isCompleteByFormat(
    progress,
    threshold,
    format,
    context,
    bookData = null,
  ) {
    // Enhanced completion detection strategy:
    // 1. Try precise position-based detection using actual duration/pages
    // 2. Fall back to percentage-based detection if precise data unavailable

    let preciseDetectionUsed = false;

    switch (format) {
      case 'audiobook':
        // Try precise time-based completion first
        if (bookData) {
          const totalSeconds = extractAudioDurationFromAudiobookshelf(bookData);
          if (totalSeconds && totalSeconds > 0) {
            const currentSeconds = this.calculateCurrentPosition(
              progress,
              totalSeconds,
              { type: 'seconds', context },
            );
            const timeRemaining = totalSeconds - currentSeconds;

            if (timeRemaining <= this.COMPLETION_TIME_REMAINING_SECONDS) {
              logger.debug(
                `Audiobook detected as complete by time remaining in ${context}`,
                {
                  currentSeconds,
                  totalSeconds,
                  timeRemaining,
                  detectionMethod: 'precise-time-based',
                },
              );
              preciseDetectionUsed = true;
              return true;
            }
          }
        }

        // Fall back to percentage-based
        if (!preciseDetectionUsed) {
          logger.debug(
            `Using percentage-based completion for audiobook in ${context}`,
            {
              progress,
              threshold,
              detectionMethod: 'percentage-fallback',
            },
          );
        }
        return progress >= threshold;

      case 'ebook':
      case 'physical':
        // Try precise page-based completion first
        if (bookData) {
          const totalPages = this._extractPageCount(bookData);
          if (totalPages && totalPages > 0) {
            const currentPage = this.calculateCurrentPosition(
              progress,
              totalPages,
              { type: 'pages', context },
            );
            const pagesRemaining = totalPages - currentPage;

            if (pagesRemaining <= this.COMPLETION_PAGES_REMAINING) {
              logger.debug(
                `Book detected as complete by pages remaining in ${context}`,
                {
                  currentPage,
                  totalPages,
                  pagesRemaining,
                  format,
                  detectionMethod: 'precise-page-based',
                },
              );
              preciseDetectionUsed = true;
              return true;
            }
          }
        }

        // Fall back to percentage-based
        if (!preciseDetectionUsed) {
          logger.debug(
            `Using percentage-based completion for ${format} in ${context}`,
            {
              progress,
              threshold,
              detectionMethod: 'percentage-fallback',
            },
          );
        }
        return progress >= threshold;

      case 'unknown':
      default:
        // Unknown format: Use conservative percentage-based threshold
        logger.debug(
          `Using standard completion criteria for unknown format in ${context}`,
          {
            format,
            threshold,
            detectionMethod: 'percentage-only',
          },
        );
        return progress >= threshold;
    }
  }

  /**
   * Check if progress is considered "zero" or negligible
   * @param {number|string|null} progress - Progress value to check
   * @param {Object} options - Zero detection options
   * @param {number} options.threshold - Zero threshold (default: 5)
   * @param {string} options.context - Context for logging
   * @returns {boolean} - Whether progress is considered zero
   */
  static isZeroProgress(progress, options = {}) {
    const { threshold = this.DEFAULT_ZERO_THRESHOLD, context = '' } = options;

    const validatedProgress = this.validateProgress(progress, context);
    if (validatedProgress === null) {
      return true; // Null/undefined is considered zero progress
    }

    return validatedProgress <= threshold;
  }

  /**
   * Detect if there's a significant change between two progress values
   * @param {number|string|null} oldProgress - Previous progress value
   * @param {number|string|null} newProgress - New progress value
   * @param {Object} options - Change detection options
   * @param {number} options.threshold - Minimum change threshold (default: 0.1)
   * @param {string} options.context - Context for logging
   * @returns {Object} - Change detection result
   */
  static detectProgressChange(oldProgress, newProgress, options = {}) {
    const { threshold = this.SIGNIFICANT_CHANGE_THRESHOLD, context = '' } =
      options;

    const oldValidated = this.validateProgress(oldProgress, `${context} (old)`);
    const newValidated = this.validateProgress(newProgress, `${context} (new)`);

    // Handle missing or invalid data gracefully
    if (oldValidated === null || newValidated === null) {
      // Only log at debug level if it's truly invalid data (both null)
      // If only old is null, it's just no cached progress (normal)
      if (oldValidated === null && newValidated !== null) {
        logger.debug(
          `No cached progress for ${context} - assuming change needed`,
          {
            oldProgress,
            newProgress,
          },
        );
      } else if (oldValidated !== null && newValidated === null) {
        logger.warn(`Invalid new progress data in ${context}`, {
          oldProgress,
          newProgress,
        });
      } else {
        logger.warn(`Both old and new progress data invalid in ${context}`, {
          oldProgress,
          newProgress,
        });
      }

      return {
        hasChange: oldValidated === null && newValidated !== null, // Change if we have new valid data
        oldProgress: oldValidated || 0,
        newProgress: newValidated || 0,
        absoluteChange: 0,
        direction: 'none',
        isRegression: false,
        invalidData: true,
      };
    }

    // Fix floating point precision issues by rounding to reasonable precision
    const absoluteChange =
      Math.round(Math.abs(newValidated - oldValidated) * 1000000) / 1000000;
    const isSignificant = absoluteChange >= threshold;

    // Direction should be 'none' if change is not significant
    let direction;
    if (!isSignificant) {
      direction = 'none';
    } else {
      direction =
        newValidated > oldValidated
          ? 'increase'
          : newValidated < oldValidated
            ? 'decrease'
            : 'none';
    }

    const result = {
      hasChange: isSignificant,
      oldProgress: oldValidated,
      newProgress: newValidated,
      absoluteChange,
      direction,
      isRegression: direction === 'decrease' && isSignificant,
    };

    if (isSignificant) {
      logger.debug(
        `Significant progress change detected in ${context}`,
        result,
      );
    }

    return result;
  }

  /**
   * Calculate current position (page/second) from progress percentage
   * @param {number|string|null} progress - Progress percentage
   * @param {number} total - Total pages or seconds
   * @param {Object} options - Calculation options
   * @param {string} options.type - Position type: 'pages' or 'seconds' (default: 'pages')
   * @param {string} options.context - Context for logging
   * @returns {number} - Current position (1-based for pages, 0-based for seconds)
   */
  static calculateCurrentPosition(progress, total, options = {}) {
    const { type = 'pages', context = '' } = options;

    const validatedProgress = this.validateProgress(progress, context);
    if (validatedProgress === null || !total || total <= 0) {
      logger.debug(`Cannot calculate position in ${context}`, {
        progress: validatedProgress,
        total,
        type,
      });
      return type === 'pages' ? 1 : 0; // Return minimum valid position
    }

    if (type === 'pages') {
      // For pages: N% progress = page N (with minimum of page 1)
      // This creates perfect round-trip consistency
      const position = Math.round((validatedProgress / 100) * total);
      return Math.max(1, Math.min(position, total));
    } else {
      // For seconds: direct proportion, 0-based
      const position = Math.round((validatedProgress / 100) * total);
      return Math.max(0, Math.min(position, total));
    }
  }

  /**
   * Calculate progress percentage from current position
   * @param {number} currentPosition - Current page or second
   * @param {number} total - Total pages or seconds
   * @param {Object} options - Calculation options
   * @param {string} options.type - Position type: 'pages' or 'seconds' (default: 'pages')
   * @param {string} options.context - Context for logging
   * @returns {number} - Progress percentage (0-100)
   */
  static calculateProgressFromPosition(currentPosition, total, options = {}) {
    const { type = 'pages', context = '' } = options;

    if (!total || total <= 0) {
      logger.warn(`Invalid total in ${context}`, {
        currentPosition,
        total,
        type,
      });
      return 0;
    }

    if (currentPosition === null || currentPosition === undefined) {
      return 0;
    }

    let progress;
    if (type === 'pages') {
      // For pages: treat "page N" as "completed N pages" = N% of total
      // This creates perfect round-trip consistency
      progress = (currentPosition / total) * 100;
    } else {
      // For seconds: direct proportion
      progress = (currentPosition / total) * 100;
    }

    // Round to avoid floating point precision issues in round-trip calculations
    const roundedProgress = Math.round(progress * 1000000) / 1000000;
    return this.validateProgress(roundedProgress, context) || 0;
  }

  /**
   * Analyze progress regression for potential re-reading detection
   * @param {number|string|null} oldProgress - Previous progress value
   * @param {number|string|null} newProgress - New progress value
   * @param {Object} options - Regression analysis options
   * @param {number} options.rereadThreshold - Threshold for potential re-read (default: 30)
   * @param {number} options.highProgressThreshold - High progress threshold (default: 85)
   * @param {number} options.blockThreshold - Regression block threshold (default: 50)
   * @param {number} options.warnThreshold - Regression warn threshold (default: 10)
   * @param {string} options.context - Context for logging
   * @returns {Object} - Regression analysis result
   */
  static analyzeProgressRegression(oldProgress, newProgress, options = {}) {
    const {
      rereadThreshold = 30,
      highProgressThreshold = 85,
      blockThreshold = 50,
      warnThreshold = 15, // Align with config example and sync-manager expectations
      context = '',
    } = options;

    const oldValidated = this.validateProgress(oldProgress, `${context} (old)`);
    const newValidated = this.validateProgress(newProgress, `${context} (new)`);

    // Handle invalid data gracefully instead of defaulting to 0
    if (oldValidated === null || newValidated === null) {
      // Use debug level for normal cases where old progress is simply not available (new books)
      // Use warn level only when new progress is also invalid (actual data corruption)
      const logLevel =
        oldValidated === null && newValidated !== null ? 'debug' : 'warn';
      const logMessage =
        oldValidated === null && newValidated !== null
          ? `No previous progress available for regression analysis in ${context} (normal for new books)`
          : `Cannot analyze progress regression due to invalid data in ${context}`;

      logger[logLevel](logMessage, {
        oldProgress,
        newProgress,
        oldValid: oldValidated !== null,
        newValid: newValidated !== null,
      });

      return {
        isRegression: false,
        regressionAmount: 0,
        oldProgress: oldValidated || 0,
        newProgress: newValidated || 0,
        shouldBlock: false,
        shouldWarn: false,
        reason:
          oldValidated === null && newValidated !== null
            ? 'No previous progress data available - treating as new book'
            : 'Cannot analyze regression - invalid progress data',
        isPotentialReread: false,
        invalidData: oldValidated === null && newValidated === null, // Only true invalid data if both are null
      };
    }

    // Fix floating point precision issues by rounding to reasonable precision
    const regressionAmount =
      Math.round((oldValidated - newValidated) * 1000000) / 1000000;
    const isRegression = regressionAmount > 0;

    const result = {
      isRegression,
      regressionAmount,
      oldProgress: oldValidated,
      newProgress: newValidated,
      shouldBlock: false,
      shouldWarn: false,
      reason: '',
      isPotentialReread: false,
    };

    if (!isRegression) {
      result.reason = 'No regression detected';
      return result;
    }

    // Check for major regression first - always block large drops regardless of scenario
    if (regressionAmount >= blockThreshold) {
      result.shouldBlock = true;
      result.reason = `Major regression: ${oldValidated.toFixed(1)}% → ${newValidated.toFixed(1)}% (${regressionAmount.toFixed(1)}% drop)`;
    }

    // Check for potential re-reading scenario (can coexist with major regression)
    if (
      oldValidated >= highProgressThreshold &&
      newValidated <= rereadThreshold
    ) {
      result.isPotentialReread = true;
      // Only add warning if not already blocking
      if (!result.shouldBlock) {
        result.shouldWarn = true;
        result.reason = `Potential re-reading: ${oldValidated.toFixed(1)}% → ${newValidated.toFixed(1)}%`;
      } else {
        // Update reason to indicate both issues
        result.reason = `Major regression detected (potential re-read): ${oldValidated.toFixed(1)}% → ${newValidated.toFixed(1)}% (${regressionAmount.toFixed(1)}% drop)`;
      }
    }
    // Check for minor regression that should be warned
    else if (regressionAmount >= warnThreshold) {
      result.shouldWarn = true;
      result.reason = `Minor regression: ${oldValidated.toFixed(1)}% → ${newValidated.toFixed(1)}% (${regressionAmount.toFixed(1)}% drop)`;
    } else {
      result.reason = `Small regression within tolerance: ${regressionAmount.toFixed(1)}%`;
    }

    logger.debug(`Progress regression analysis in ${context}`, result);
    return result;
  }

  /**
   * Format progress for display with consistent formatting
   * @param {number|string|null} progress - Progress value to format
   * @param {Object} options - Formatting options
   * @param {number} options.decimals - Number of decimal places (default: 1)
   * @param {string} options.suffix - Suffix to append (default: '%')
   * @param {string} options.nullDisplay - Display for null values (default: 'N/A')
   * @param {string} options.context - Context for logging
   * @returns {string} - Formatted progress string
   */
  static formatProgress(progress, options = {}) {
    const {
      decimals = 1,
      suffix = '%',
      nullDisplay = 'N/A',
      context = '',
    } = options;

    const validatedProgress = this.validateProgress(progress, context);
    if (validatedProgress === null) {
      return nullDisplay;
    }

    return `${validatedProgress.toFixed(decimals)}${suffix}`;
  }

  /**
   * Create a progress summary object with standardized information
   * @param {number|string|null} progress - Progress value
   * @param {Object} metadata - Additional metadata for summary
   * @param {string} metadata.context - Context description
   * @param {boolean} metadata.isFinished - Explicit finished flag
   * @param {number} metadata.totalPages - Total pages (for books)
   * @param {number} metadata.totalSeconds - Total seconds (for audiobooks)
   * @returns {Object} - Standardized progress summary
   */
  static createProgressSummary(progress, metadata = {}) {
    const {
      context = '',
      isFinished = null,
      totalPages = null,
      totalSeconds = null,
    } = metadata;

    const validatedProgress = this.validateProgress(progress, context);
    const isComplete = this.isComplete(progress, { isFinished, context });
    const isZero = this.isZeroProgress(progress, { context });

    const summary = {
      raw: progress,
      validated: validatedProgress,
      formatted: this.formatProgress(validatedProgress, { context }),
      isComplete,
      isZero,
      isValid: validatedProgress !== null,
      context,
    };

    // Add position calculations if total information is available
    if (totalPages && validatedProgress !== null) {
      summary.currentPage = this.calculateCurrentPosition(
        validatedProgress,
        totalPages,
        { type: 'pages', context },
      );
      summary.totalPages = totalPages;
    }

    if (totalSeconds && validatedProgress !== null) {
      summary.currentSeconds = this.calculateCurrentPosition(
        validatedProgress,
        totalSeconds,
        { type: 'seconds', context },
      );
      summary.totalSeconds = totalSeconds;
    }

    return summary;
  }

  /**
   * Centralized method to extract and normalize the isFinished flag from book data
   * @param {Object} bookData - Audiobookshelf book data
   * @returns {boolean} - Normalized finished status
   */
  static extractFinishedFlag(bookData) {
    if (!bookData) return false;
    return bookData.is_finished === true || bookData.is_finished === 1;
  }

  /**
   * Centralized method to extract raw progress percentage from book data
   * @param {Object} bookData - Audiobookshelf book data
   * @returns {number} - Raw progress percentage (0-100)
   */
  static extractProgressPercentage(bookData) {
    if (!bookData) return 0;
    return bookData.progress_percentage || 0;
  }

  /**
   * Detect book format from Hardcover edition data (consistent with progress field determination)
   * @param {Object} edition - Hardcover edition object
   * @returns {string} - Book format ('audiobook', 'ebook', 'physical', 'unknown')
   */
  static getFormatFromEdition(edition) {
    if (!edition) return 'unknown';

    // Use same logic as sync-manager's useSeconds determination for consistency
    if (edition.audio_seconds && edition.audio_seconds > 0) {
      return 'audiobook';
    }

    // Check for explicit format from Hardcover
    const hardcoverFormat = edition.reading_format?.format;
    switch (hardcoverFormat) {
      case 'Listened':
        return 'audiobook';
      case 'Ebook':
        return 'ebook';
      case 'Read':
        return 'physical';
      case 'Both':
        // If both, prefer based on capabilities
        return edition.audio_seconds && edition.audio_seconds > 0
          ? 'audiobook'
          : 'physical';
      default:
        // Fallback to capabilities
        if (edition.pages && edition.pages > 0) {
          return 'physical';
        }
        return 'unknown';
    }
  }

  /**
   * Centralized method to get book format for progress calculations
   * @param {Object} bookData - Audiobookshelf book data
   * @param {Object} edition - Optional Hardcover edition object (preferred for consistency)
   * @returns {string} - Book format ('audiobook', 'ebook', 'physical', 'unknown')
   */
  static getBookFormat(bookData, edition = null) {
    // Prefer edition-based detection for consistency with progress field determination
    if (edition) {
      return this.getFormatFromEdition(edition);
    }

    // Fallback to AudiobookShelf data detection
    return detectUserBookFormat(bookData);
  }

  /**
   * Centralized method to get validated progress with all context
   * @param {Object} bookData - Audiobookshelf book data
   * @param {string} context - Context for logging
   * @param {Object} options - Additional validation options
   * @param {Object} edition - Optional Hardcover edition object (preferred for format detection)
   * @returns {number|null} - Validated progress percentage
   */
  static getValidatedProgress(
    bookData,
    context = '',
    options = {},
    edition = null,
  ) {
    const isFinished = this.extractFinishedFlag(bookData);
    const rawProgress = this.extractProgressPercentage(bookData);
    const bookFormat = this.getBookFormat(bookData, edition);

    return this.validateProgress(rawProgress, context, {
      ...options,
      bookData,
      format: bookFormat,
      isFinished,
    });
  }

  /**
   * Centralized method to determine if a book is complete with all context
   * @param {Object} bookData - Audiobookshelf book data
   * @param {string} context - Context for logging
   * @param {Object} options - Completion detection options
   * @param {Object} edition - Optional Hardcover edition object (preferred for format detection)
   * @returns {boolean} - Whether the book is considered complete
   */
  static isBookComplete(bookData, context = '', options = {}, edition = null) {
    const isFinished = this.extractFinishedFlag(bookData);
    const rawProgress = this.extractProgressPercentage(bookData);
    const bookFormat = this.getBookFormat(bookData, edition);

    return this.isComplete(rawProgress, {
      ...options,
      isFinished,
      context,
      format: bookFormat,
      bookData,
    });
  }
}

export default ProgressManager;
