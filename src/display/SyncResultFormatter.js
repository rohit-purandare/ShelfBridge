import logger from '../logger.js';
import { dumpFailedSyncBooks } from '../utils/debug.js';

/**
 * Formats and displays sync results in a user-friendly format
 */
export class SyncResultFormatter {
  constructor() {
    this.statusIcons = {
      synced: '📘',
      completed: '📕',
      auto_added: '📗',
      skipped: '📙',
      error: '📛',
      default: '📓',
    };

    this.actionIcons = {
      synced: '✅',
      completed: '🎯',
      auto_added: '➕',
      skipped: '⏭️',
      error: '❌',
      default: '❓',
    };

    this.actionTexts = {
      synced: 'Sent to Hardcover successfully',
      completed: 'Marked complete in Hardcover',
      auto_added: 'Added to Hardcover library',
      skipped: 'Skipped - no Hardcover update needed',
      error: 'Failed to update',
      default: 'Unknown action',
    };
  }

  /**
   * Format and display complete sync results
   */
  async formatSyncResults(
    user,
    result,
    globalConfig,
    duration,
    verbose = false,
  ) {
    // Display main sync summary
    this._displaySyncHeader(duration);
    this._displayTwoColumnSummary(result, globalConfig);
    this._displaySyncFooter();

    // Display detailed book results if verbose and available
    if (verbose && result.book_details && result.book_details.length > 0) {
      this._displayDetailedBookResults(result.book_details);
      this._displayPerformanceMetrics(result);
    }

    // Display error summary if there were errors
    if (result.errors && result.errors.length > 0) {
      await this._displayErrorSummary(result, user, globalConfig);
    }
  }

  /**
   * Display the sync completion header
   */
  _displaySyncHeader(duration) {
    console.log('═'.repeat(50));
    console.log('📚 SYNC COMPLETE', `(${duration.toFixed(1)}s)`);
    console.log('═'.repeat(50));
  }

  /**
   * Display the sync footer
   */
  _displaySyncFooter() {
    console.log('═'.repeat(50));
    console.log();
  }

  /**
   * Display two-column summary layout
   */
  _displayTwoColumnSummary(result, globalConfig) {
    const leftColumn = this._buildLibraryStatusColumn(result);
    const rightColumn = this._buildHardcoverUpdatesColumn(result, globalConfig);

    // Add processing results to left column
    this._addProcessingResults(leftColumn, result, globalConfig);

    // Add sync status to right column
    this._addSyncStatus(rightColumn, result);

    // Print columns side by side
    this._printTwoColumns(leftColumn, rightColumn);
  }

  /**
   * Build the library status column (left side)
   */
  _buildLibraryStatusColumn(result) {
    const leftColumn = ['📚 Library Status'];

    // Show library filtering information if available
    if (result.library_filtering) {
      const libFilter = result.library_filtering;
      if (libFilter.excluded > 0) {
        leftColumn.push(
          `├─ ${libFilter.included} of ${libFilter.total} libraries processed`,
        );
        leftColumn.push(
          `├─ ${libFilter.excluded} libraries excluded by filter`,
        );
        if (libFilter.unmatched.length > 0) {
          leftColumn.push(
            `├─ Warning: ${libFilter.unmatched.length} unmatched filters`,
          );
        }
      } else if (libFilter.total > 0) {
        leftColumn.push(`├─ ${libFilter.total} libraries processed`);
      }
    }

    if (result.total_books_in_library !== undefined) {
      leftColumn.push(`├─ ${result.total_books_in_library} total books`);

      if (result.books_in_progress) {
        leftColumn.push(`├─ ${result.books_in_progress} currently reading`);
      }

      // Show completed books if we have that data
      if (result.all_completed_books && result.all_completed_books > 0) {
        let completedText = `├─ ${result.all_completed_books} completed`;

        // Add source indicator for completed books
        if (result.stats_source === 'cached') {
          completedText += ' (cached)';
        } else if (result.stats_source === 'deep_scan') {
          completedText += ' (updated)';
        } else if (result.stats_source === 'mixed') {
          completedText += ' (cached)';
        }

        leftColumn.push(completedText);
      }

      // Calculate actual never started
      const actualNeverStarted =
        result.total_books_in_library -
        (result.books_in_progress || 0) -
        (result.all_completed_books || 0);

      if (actualNeverStarted > 0) {
        leftColumn.push(`└─ ${actualNeverStarted} never started`);
      } else {
        leftColumn[leftColumn.length - 1] = leftColumn[
          leftColumn.length - 1
        ].replace('├─', '└─');
      }

      // Add cache status message only when information is limited
      if (result.stats_source === 'none') {
        leftColumn.push('');
        leftColumn.push('⚡ Limited library info');
        leftColumn.push('└─ Deep scan needed for full stats');
      }
    } else {
      leftColumn.push(`└─ ${result.books_processed} books processed`);
    }

    return leftColumn;
  }

  /**
   * Build the Hardcover updates column (right side)
   */
  _buildHardcoverUpdatesColumn(result, globalConfig) {
    const isDryRun = globalConfig.dry_run;
    const rightColumn = [
      isDryRun ? '🌐 Hardcover Updates (DRY RUN)' : '🌐 Hardcover Updates',
    ];

    const totalApiCalls =
      result.books_synced + result.books_completed + result.books_auto_added;
    const skippedCalls = result.books_skipped;

    if (isDryRun) {
      // In dry-run mode, show what would happen
      rightColumn.push(`├─ ${totalApiCalls} would be updated`);
      rightColumn.push(`├─ 0 API calls made (dry run)`);
      rightColumn.push(`├─ ${result.errors.length} would fail`);
      rightColumn.push(`└─ ${skippedCalls} skipped (no changes)`);
    } else {
      // Normal mode, show actual results
      rightColumn.push(`├─ ${totalApiCalls} API calls made`);
      rightColumn.push(`├─ ${totalApiCalls} successful`);
      rightColumn.push(`├─ ${result.errors.length} failed`);
      rightColumn.push(`└─ ${skippedCalls} skipped (no changes)`);
    }

    return rightColumn;
  }

  /**
   * Add processing results to the left column
   */
  _addProcessingResults(leftColumn, result, globalConfig) {
    const isDryRun = globalConfig.dry_run;

    leftColumn.push('');
    leftColumn.push(
      isDryRun ? '📊 Processing Results (SIMULATED)' : '📊 Processing Results',
    );

    if (isDryRun) {
      // In dry-run mode, show what would happen
      const totalActions =
        result.books_synced +
        result.books_completed +
        result.books_auto_added +
        result.books_skipped;

      if (totalActions > 0) {
        if (result.books_synced > 0) {
          leftColumn.push(`├─ ${result.books_synced} would update progress`);
        }
        if (result.books_completed > 0) {
          leftColumn.push(`├─ ${result.books_completed} would mark complete`);
        }
        if (result.books_auto_added > 0) {
          leftColumn.push(`├─ ${result.books_auto_added} would auto-add`);
        }
      } else {
        leftColumn.push('├─ No changes would be made');
      }
    } else {
      // Normal mode, show actual results
      if (result.books_synced > 0) {
        leftColumn.push(`├─ ${result.books_synced} progress updated`);
      }
      if (result.books_completed > 0) {
        leftColumn.push(`├─ ${result.books_completed} marked complete`);
      }
      if (result.books_auto_added > 0) {
        leftColumn.push(`├─ ${result.books_auto_added} auto-added`);
      }
      if (result.books_skipped > 0) {
        leftColumn.push(`├─ ${result.books_skipped} skipped (no change)`);
      }
    }

    // Ensure last item has └─
    const processingResultsIndex = leftColumn.findIndex(line =>
      line.includes('📊 Processing Results'),
    );

    if (leftColumn.length > processingResultsIndex + 1) {
      leftColumn[leftColumn.length - 1] = leftColumn[
        leftColumn.length - 1
      ].replace('├─', '└─');
    } else {
      leftColumn.push('└─ No changes made');
    }
  }

  /**
   * Add sync status to the right column
   */
  _addSyncStatus(rightColumn, result) {
    rightColumn.push('');
    rightColumn.push('✅ Sync Status');

    if (result.errors.length === 0) {
      rightColumn.push('├─ All updates successful');
      rightColumn.push('├─ No errors occurred');
    } else {
      rightColumn.push(
        `├─ ${result.errors.length} error${result.errors.length === 1 ? '' : 's'} occurred`,
      );
    }

    // Only show cache updated if books were actually processed
    const cacheUpdated =
      result.books_synced > 0 ||
      result.books_completed > 0 ||
      result.books_auto_added > 0;

    if (cacheUpdated) {
      rightColumn.push('├─ Cache updated');
    }

    rightColumn.push('└─ Ready for next sync');
  }

  /**
   * Print two columns side by side
   */
  _printTwoColumns(leftColumn, rightColumn) {
    const maxLeftWidth = Math.max(...leftColumn.map(line => line.length));
    const padding = 2;

    for (let i = 0; i < Math.max(leftColumn.length, rightColumn.length); i++) {
      const left = (leftColumn[i] || '').padEnd(maxLeftWidth + padding);
      const right = rightColumn[i] || '';
      console.log(left + right);
    }
  }

  /**
   * Display detailed book results
   */
  _displayDetailedBookResults(bookDetails) {
    console.log('📖 DETAILED BOOK RESULTS');
    console.log('═'.repeat(50));
    console.log();

    bookDetails.forEach((book, index) => {
      this._displayBookDetails(book);

      // Add spacing between books
      if (index < bookDetails.length - 1) {
        console.log();
      }
    });
  }

  /**
   * Display details for a single book
   */
  _displayBookDetails(book) {
    const statusIcon =
      this.statusIcons[book.status] || this.statusIcons.default;

    // Book header with title and author
    console.log(
      `${statusIcon} ${book.title}${book.author ? ` by ${book.author}` : ''}`,
    );

    // Progress information
    this._displayProgressInfo(book);

    // Cache status
    this._displayCacheStatus(book);

    // Identifiers
    this._displayIdentifiers(book);

    // Hardcover edition info
    this._displayHardcoverInfo(book);

    // Main action
    this._displayMainAction(book);

    // API response info
    this._displayApiResponse(book);

    // Skip/error reasons
    this._displayReasons(book);

    // Timing information
    this._displayTimingInfo(book);

    // Error details
    this._displayErrorDetails(book);

    // Processing time for debugging
    if (book.timing) {
      console.log(`   Processing time: ${book.timing}ms`);
    }
  }

  /**
   * Display progress information for a book
   */
  _displayProgressInfo(book) {
    if (book.progress.before !== null && book.progress.after !== null) {
      const progressChange = book.progress.after - book.progress.before;
      if (progressChange !== 0) {
        const changeStr =
          progressChange > 0
            ? `(+${progressChange.toFixed(1)}%)`
            : `(${progressChange.toFixed(1)}%)`;
        console.log(
          `   Progress: ${book.progress.before.toFixed(1)}% → ${book.progress.after.toFixed(1)}% ${changeStr}`,
        );
      } else {
        // Check if this was actually skipped vs unchanged
        const wasSkipped =
          book.status === 'skipped' && book.reason !== 'Progress unchanged';
        const message = wasSkipped
          ? `   Progress: ${book.progress.before.toFixed(1)}%`
          : `   Progress: ${book.progress.before.toFixed(1)}% (unchanged since last sync)`;
        console.log(message);
      }
    } else if (book.progress.before !== null) {
      console.log(`   Progress: ${book.progress.before.toFixed(1)}%`);
    }
  }

  /**
   * Display cache status for a book
   */
  _displayCacheStatus(book) {
    if (book.cache_status) {
      const cacheIcon = book.cache_status.found ? '✅' : '❌';
      let cacheInfo = `Cache: ${cacheIcon}`;

      if (book.cache_status.found) {
        cacheInfo += ` Found`;
        if (book.cache_status.last_sync) {
          const daysSinceSync = Math.floor(
            (Date.now() - new Date(book.cache_status.last_sync).getTime()) /
              (1000 * 60 * 60 * 24),
          );
          if (daysSinceSync === 0) {
            cacheInfo += ` (synced today)`;
          } else if (daysSinceSync === 1) {
            cacheInfo += ` (synced yesterday)`;
          } else {
            cacheInfo += ` (last synced ${daysSinceSync} days ago)`;
          }
        }
        if (book.progress.changed) {
          cacheInfo += `, updated with new progress`;
        }
      } else {
        cacheInfo += ` Not found (new book)`;
      }
      console.log(`   ${cacheInfo}`);
    }
  }

  /**
   * Display identifiers for a book
   */
  _displayIdentifiers(book) {
    if (book.identifiers && Object.keys(book.identifiers).length > 0) {
      const identifierStr = Object.entries(book.identifiers)
        .filter(([_k, v]) => v)
        .map(([k, v]) => `${k.toUpperCase()}=${v}`)
        .join(', ');
      if (identifierStr) {
        console.log(`   Identifiers: ${identifierStr}`);
      }
    }
  }

  /**
   * Display Hardcover edition information
   */
  _displayHardcoverInfo(book) {
    if (book.hardcover_info) {
      const editionInfo = book.hardcover_info;
      let editionStr = `Hardcover: Edition ${editionInfo.edition_id}`;
      if (editionInfo.format) {
        editionStr += ` (${editionInfo.format}`;
        if (editionInfo.duration) {
          editionStr += `, ${editionInfo.duration}`;
        } else if (editionInfo.pages) {
          editionStr += `, ${editionInfo.pages} pages`;
        }
        editionStr += `)`;
      }
      console.log(`   ${editionStr}`);
    }
  }

  /**
   * Display main action taken for a book
   */
  _displayMainAction(book) {
    const actionIcon =
      this.actionIcons[book.status] || this.actionIcons.default;
    const actionText =
      this.actionTexts[book.status] || this.actionTexts.default;

    console.log(`   Action: ${actionIcon} ${actionText}`);
  }

  /**
   * Display API response information
   */
  _displayApiResponse(book) {
    if (book.api_response) {
      const response = book.api_response;
      if (response.success) {
        console.log(
          `   API Response: ${response.status_code} OK (${response.duration}s)`,
        );
      } else {
        console.log(
          `   API Response: ${response.status_code} Error (${response.duration}s)`,
        );
      }
    }
  }

  /**
   * Display skip/error reasons
   */
  _displayReasons(book) {
    if (book.status === 'skipped' && book.reason) {
      console.log(`   Reason: ${book.reason}`);
    }
  }

  /**
   * Display timing information
   */
  _displayTimingInfo(book) {
    if (book.timestamps) {
      if (book.timestamps.last_listened_at) {
        console.log(
          `   Last Listened: ${new Date(book.timestamps.last_listened_at).toLocaleString()}`,
        );
      }
      if (book.timestamps.completed_at) {
        console.log(
          `   Completion Date: ${new Date(book.timestamps.completed_at).toLocaleString()}`,
        );
      }
    }
  }

  /**
   * Display error details for a book
   */
  _displayErrorDetails(book) {
    if (book.errors && book.errors.length > 0) {
      console.log(`   Errors:`);
      book.errors.forEach(error => {
        console.log(`     ❌ ${error}`);
      });
    }
  }

  /**
   * Display performance metrics
   */
  _displayPerformanceMetrics(result) {
    console.log();
    console.log('📊 PERFORMANCE METRICS');
    console.log('-'.repeat(25));

    if (result.memory_usage) {
      console.log(
        `🔄 Memory Usage: ${result.memory_usage.current} (${result.memory_usage.delta} during sync)`,
      );
    }

    if (result.cache_stats) {
      console.log(
        `📊 Cache Performance: ${result.cache_stats.hits} hits, ${result.cache_stats.misses} misses`,
      );
    }

    if (result.network_stats) {
      console.log(
        `🌐 Network: ${result.network_stats.requests} requests, avg ${result.network_stats.avg_response_time}s response time`,
      );
    }

    console.log('═'.repeat(50));
  }

  /**
   * Display error summary
   */
  async _displayErrorSummary(result, user, globalConfig) {
    console.log('\n❌ ERROR SUMMARY');
    console.log('='.repeat(30));

    result.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });

    console.log('='.repeat(30));

    // Dump failed sync books to file if enabled
    if (globalConfig.dump_failed_books !== false) {
      try {
        // Extract failed books from book_details
        const failedBooks =
          result.book_details?.filter(book => book.status === 'error') || [];
        const dumpFilePath = await dumpFailedSyncBooks(user.id, failedBooks);
        if (dumpFilePath) {
          console.log(`\n📄 Error details saved to: ${dumpFilePath}`);
        }
      } catch (dumpError) {
        console.log(`\n⚠️  Failed to save error details: ${dumpError.message}`);
        logger.error('Failed to dump error details', {
          error: dumpError.message,
          user_id: user.id,
        });
      }
    }
  }
}
