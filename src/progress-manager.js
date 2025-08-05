/**
 * Progress Manager - Centralized progress handling utilities
 *
 * This module provides consistent progress percentage validation, boundary checking,
 * completion detection, and position calculations across all book formats.
 */
import logger from './logger.js';

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

  /**
   * Validate and normalize progress percentage
   * @param {number|string|null|undefined} progress - Progress value to validate
   * @param {string} context - Context for error reporting (e.g., "user sync", "book title")
   * @param {Object} options - Validation options
   * @param {boolean} options.allowNull - Whether to allow null/undefined values (default: true)
   * @param {boolean} options.strict - Whether to throw on invalid values (default: false)
   * @returns {number|null} - Validated progress percentage or null
   * @throws {ProgressValidationError} - When strict=true and validation fails
   */
  static validateProgress(progress, context = '', options = {}) {
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
   * @param {Object} options.bookData - Additional book metadata for format-specific logic
   * @returns {boolean} - Whether the book is considered complete
   */
  static isComplete(progress, options = {}) {
    const {
      threshold = this.DEFAULT_COMPLETION_THRESHOLD,
      isFinished = null,
      context = '',
      format = 'unknown',
      bookData = {},
    } = options;

    // Explicit finished flag takes precedence for ALL formats
    if (isFinished === true || isFinished === 1) {
      logger.debug(
        `Book marked as complete via isFinished flag in ${context}`,
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

    // Validate progress percentage
    const validatedProgress = this.validateProgress(progress, context);
    if (validatedProgress === null) {
      logger.debug(`Book not complete - invalid progress in ${context}`, {
        format,
        originalProgress: progress,
      });
      return false;
    }

    // Apply format-aware completion logic
    const isCompleteByProgress = this._isCompleteByFormat(
      validatedProgress,
      threshold,
      format,
      bookData,
      context,
    );

    if (isCompleteByProgress) {
      logger.debug(`Book considered complete by progress in ${context}`, {
        progress: validatedProgress,
        threshold,
        format,
        detectionMethod: 'progress-based',
      });
    }

    return isCompleteByProgress;
  }

  /**
   * Format-aware completion detection with standardized criteria
   * @private
   */
  static _isCompleteByFormat(progress, threshold, format, bookData, context) {
    // Standardized completion criteria across all formats:
    // - Progress >= threshold (default 95%) indicates completion
    // - Format-specific adjustments for edge cases

    switch (format) {
      case 'audiobook':
        // Audiobooks: Use standard threshold
        // Account for potential silence/credits at end
        return progress >= threshold;

      case 'ebook':
        // Ebooks: Use standard threshold
        // Account for appendices/glossaries that readers might skip
        return progress >= threshold;

      case 'physical':
        // Physical books: Use standard threshold
        // Reader may not finish last few pages (index, etc.)
        return progress >= threshold;

      case 'unknown':
      default:
        // Unknown format: Use conservative standard threshold
        logger.debug(
          `Using standard completion criteria for unknown format in ${context}`,
          {
            format,
            threshold,
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

    const oldValidated =
      this.validateProgress(oldProgress, `${context} (old)`) || 0;
    const newValidated =
      this.validateProgress(newProgress, `${context} (new)`) || 0;

    const absoluteChange = Math.abs(newValidated - oldValidated);
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

    const position = Math.round((validatedProgress / 100) * total);

    // Pages are 1-based, seconds are 0-based
    if (type === 'pages') {
      return Math.max(1, Math.min(position, total));
    } else {
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

    // Adjust for 1-based pages
    const adjustedPosition =
      type === 'pages' ? Math.max(0, currentPosition - 1) : currentPosition;

    const progress = (adjustedPosition / total) * 100;
    return this.validateProgress(progress, context) || 0;
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
      warnThreshold = 10, // Changed from 15 to 10 to match test expectations
      context = '',
    } = options;

    const oldValidated =
      this.validateProgress(oldProgress, `${context} (old)`) || 0;
    const newValidated =
      this.validateProgress(newProgress, `${context} (new)`) || 0;

    const regressionAmount = oldValidated - newValidated;
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
}

export default ProgressManager;
