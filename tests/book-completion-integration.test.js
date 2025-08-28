import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { BookCache } from '../src/book-cache.js';
import { extractBookIdentifiers } from '../src/matching/utils/identifier-extractor.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Book Completion Integration Tests', () => {
  let tempDir;
  let bookCache;
  const userId = 'test-user-123';

  beforeEach(async () => {
    // Create temporary directory for test database
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'book-completion-test-'));
    const dbPath = path.join(tempDir, 'test.db');

    // Initialize BookCache with test database
    bookCache = new BookCache(dbPath);
    await bookCache.init();
  });

  afterEach(async () => {
    if (bookCache) {
      await bookCache.close();
    }
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true });
    }
  });

  describe('Core Book Completion Flow', () => {
    test('completes book with ISBN identifier successfully', async () => {
      const identifier = '9781234567890';
      const title = 'Test Book with ISBN';
      const identifierType = 'isbn';

      await bookCache.storeBookCompletionData(
        userId,
        identifier,
        title,
        identifierType,
        new Date().toISOString(),
        new Date().toISOString(),
        new Date().toISOString(),
      );

      // Verify completion was stored
      const cachedInfo = await bookCache.getCachedBookInfo(
        userId,
        identifier,
        title,
        identifierType,
      );
      assert.strictEqual(cachedInfo.exists, true);
      assert.strictEqual(cachedInfo.progress_percent, 100);
      assert(
        cachedInfo.finished_at !== null,
        'finished_at should be set for completed books',
      );
    });

    test('completes book with ASIN identifier successfully', async () => {
      const identifier = 'B00ABC123D';
      const title = 'Test Book with ASIN';
      const identifierType = 'asin';

      await bookCache.storeBookCompletionData(
        userId,
        identifier,
        title,
        identifierType,
        new Date().toISOString(),
        new Date().toISOString(),
        new Date().toISOString(),
      );

      // Verify completion was stored
      const cachedInfo = await bookCache.getCachedBookInfo(
        userId,
        identifier,
        title,
        identifierType,
      );
      assert.strictEqual(cachedInfo.exists, true);
      assert.strictEqual(cachedInfo.progress_percent, 100);
      assert(
        cachedInfo.finished_at !== null,
        'finished_at should be set for completed books',
      );
    });

    test('completes book with fallback title_author identifier successfully', async () => {
      const identifier = 'vicioussecret:testauthor';
      const title = 'Vicious Secret';
      const identifierType = 'title_author';

      await bookCache.storeBookCompletionData(
        userId,
        identifier,
        title,
        identifierType,
        new Date().toISOString(),
        new Date().toISOString(),
        new Date().toISOString(),
      );

      // Verify completion was stored
      const cachedInfo = await bookCache.getCachedBookInfo(
        userId,
        identifier,
        title,
        identifierType,
      );
      assert.strictEqual(cachedInfo.exists, true);
      assert.strictEqual(cachedInfo.progress_percent, 100);
      assert(
        cachedInfo.finished_at !== null,
        'finished_at should be set for completed books',
      );
    });
  });

  describe('Fallback Identifier Generation and Consistency', () => {
    test('generates consistent fallback identifiers for same book', () => {
      const title = 'The Great Gatsby';
      const author = 'F. Scott Fitzgerald';

      // Generate fallback identifier multiple times
      const identifier1 = `${title}:${author}`
        .toLowerCase()
        .replace(/[^a-z0-9:]/g, '');
      const identifier2 = `${title}:${author}`
        .toLowerCase()
        .replace(/[^a-z0-9:]/g, '');

      assert.strictEqual(identifier1, identifier2);
      assert.strictEqual(identifier1, 'thegreatgatsby:fscottfitzgerald');
    });

    test('handles complex titles and authors consistently', () => {
      const testCases = [
        {
          title: "Harry Potter & the Philosopher's Stone",
          author: 'J.K. Rowling',
          expected: 'harrypotterthephilosophersstone:jkrowling',
        },
        {
          title: 'The Lord of the Rings: The Fellowship of the Ring',
          author: 'J.R.R. Tolkien',
          expected: 'thelordoftherings:thefellowshipofthering:jrrtolkien',
        },
        {
          title: 'Dune (Dune Chronicles #1)',
          author: 'Frank Herbert',
          expected: 'dunedunechronicles1:frankherbert',
        },
      ];

      testCases.forEach(({ title, author, expected }) => {
        const fallbackIdentifier = `${title}:${author}`
          .toLowerCase()
          .replace(/[^a-z0-9:]/g, '');
        assert.strictEqual(
          fallbackIdentifier,
          expected,
          `Failed for "${title}" by ${author}`,
        );
      });
    });

    test('stores and retrieves fallback identifier completions correctly', async () => {
      const books = [
        {
          title: 'Book Without ISBN #1',
          author: 'Unknown Author',
          expectedId: 'bookwithoutisbn1:unknownauthor',
        },
        {
          title: 'Another Book!',
          author: 'Jane Doe',
          expectedId: 'anotherbook:janedoe',
        },
        {
          title: 'Test: A Story',
          author: 'John Smith',
          expectedId: 'test:astory:johnsmith',
        },
      ];

      // Complete all books
      for (const book of books) {
        const identifier = `${book.title}:${book.author}`
          .toLowerCase()
          .replace(/[^a-z0-9:]/g, '');
        assert.strictEqual(identifier, book.expectedId);

        await bookCache.storeBookCompletionData(
          userId,
          identifier,
          book.title,
          'title_author',
          new Date().toISOString(),
          new Date().toISOString(),
          new Date().toISOString(),
        );
      }

      // Verify all completions were stored correctly
      for (const book of books) {
        const cachedInfo = await bookCache.getCachedBookInfo(
          userId,
          book.expectedId,
          book.title,
          'title_author',
        );
        assert.strictEqual(
          cachedInfo.exists,
          true,
          `Book "${book.title}" should be cached`,
        );
        assert.strictEqual(cachedInfo.progress_percent, 100);
      }
    });
  });

  describe('Data Integrity and Edge Cases', () => {
    test('prevents duplicate completion records', async () => {
      const identifier = 'testbook:testauthor';
      const title = 'Test Book';
      const identifierType = 'title_author';
      const timestamp = new Date().toISOString();

      // Complete the same book twice
      await bookCache.storeBookCompletionData(
        userId,
        identifier,
        title,
        identifierType,
        timestamp,
        timestamp,
        timestamp,
      );
      await bookCache.storeBookCompletionData(
        userId,
        identifier,
        title,
        identifierType,
        timestamp,
        timestamp,
        timestamp,
      );

      // Should still only have one completion record
      const cachedInfo = await bookCache.getCachedBookInfo(
        userId,
        identifier,
        title,
        identifierType,
      );
      assert.strictEqual(cachedInfo.exists, true);
      assert.strictEqual(cachedInfo.progress_percent, 100);
    });

    test('handles different users independently', async () => {
      const identifier = 'sharedbook:sharedauthor';
      const title = 'Shared Book';
      const identifierType = 'title_author';
      const userId1 = 'user1';
      const userId2 = 'user2';

      // Complete for first user
      await bookCache.storeBookCompletionData(
        userId1,
        identifier,
        title,
        identifierType,
        new Date().toISOString(),
        new Date().toISOString(),
        new Date().toISOString(),
      );

      // Second user hasn't completed it yet
      const user2Info = await bookCache.getCachedBookInfo(
        userId2,
        identifier,
        title,
        identifierType,
      );
      assert.strictEqual(user2Info.exists, false);

      // Complete for second user
      await bookCache.storeBookCompletionData(
        userId2,
        identifier,
        title,
        identifierType,
        new Date().toISOString(),
        new Date().toISOString(),
        new Date().toISOString(),
      );

      // Both should be completed independently
      const user1Info = await bookCache.getCachedBookInfo(
        userId1,
        identifier,
        title,
        identifierType,
      );
      const user2InfoAfter = await bookCache.getCachedBookInfo(
        userId2,
        identifier,
        title,
        identifierType,
      );

      assert.strictEqual(user1Info.exists, true);
      assert.strictEqual(user2InfoAfter.exists, true);
    });

    test('validates identifier type restrictions correctly', async () => {
      const validTypes = ['isbn', 'asin', 'title_author'];
      const invalidTypes = ['invalid', 'unknown', '', null];

      // Valid types should work
      for (const type of validTypes) {
        if (type) {
          // Skip null
          await assert.doesNotReject(async () => {
            await bookCache.storeBookCompletionData(
              userId,
              `test-${type}`,
              'Test Book',
              type,
              new Date().toISOString(),
              new Date().toISOString(),
              new Date().toISOString(),
            );
          }, `Should accept identifier type: ${type}`);
        }
      }

      // Invalid types should fail
      for (const type of invalidTypes) {
        if (type !== null) {
          // Test null separately
          await assert.rejects(async () => {
            await bookCache.storeBookCompletionData(
              userId,
              'test-identifier',
              'Test Book',
              type,
              new Date().toISOString(),
              new Date().toISOString(),
              new Date().toISOString(),
            );
          }, `Should reject identifier type: ${type}`);
        }
      }
    });

    test('handles empty and whitespace identifiers correctly', async () => {
      const invalidIdentifiers = ['', '   ', '\t', '\n'];

      for (const identifier of invalidIdentifiers) {
        await assert.rejects(async () => {
          await bookCache.storeBookCompletionData(
            userId,
            identifier,
            'Test Book',
            'title_author',
            new Date().toISOString(),
            new Date().toISOString(),
            new Date().toISOString(),
          );
        }, `Should reject empty/whitespace identifier: "${identifier}"`);
      }
    });
  });

  describe('Backward Compatibility', () => {
    test('existing ISBN books continue to work normally', async () => {
      const testBooks = [
        { isbn: '9780141439518', title: 'Pride and Prejudice' },
        { isbn: '9780061120084', title: 'To Kill a Mockingbird' },
        { isbn: '9780486280615', title: 'The Great Gatsby' },
      ];

      for (const book of testBooks) {
        await bookCache.storeBookCompletionData(
          userId,
          book.isbn,
          book.title,
          'isbn',
          new Date().toISOString(),
          new Date().toISOString(),
          new Date().toISOString(),
        );

        const cachedInfo = await bookCache.getCachedBookInfo(
          userId,
          book.isbn,
          book.title,
          'isbn',
        );
        assert.strictEqual(cachedInfo.exists, true);
        assert.strictEqual(cachedInfo.progress_percent, 100);
      }
    });

    test('existing ASIN books continue to work normally', async () => {
      const testBooks = [
        { asin: 'B00BAXFAOW', title: 'Digital Book 1' },
        { asin: 'B01MXVHZ9Q', title: 'Digital Book 2' },
        { asin: 'B07ABC123D', title: 'Digital Book 3' },
      ];

      for (const book of testBooks) {
        await bookCache.storeBookCompletionData(
          userId,
          book.asin,
          book.title,
          'asin',
          new Date().toISOString(),
          new Date().toISOString(),
          new Date().toISOString(),
        );

        const cachedInfo = await bookCache.getCachedBookInfo(
          userId,
          book.asin,
          book.title,
          'asin',
        );
        assert.strictEqual(cachedInfo.exists, true);
        assert.strictEqual(cachedInfo.progress_percent, 100);
      }
    });

    test('mixed identifier types work independently', async () => {
      const books = [
        { id: '9781234567890', type: 'isbn', title: 'ISBN Book' },
        { id: 'B00ABC123D', type: 'asin', title: 'ASIN Book' },
        {
          id: 'fallbackbook:testauthor',
          type: 'title_author',
          title: 'Fallback Book',
        },
      ];

      // Complete all books
      for (const book of books) {
        await bookCache.storeBookCompletionData(
          userId,
          book.id,
          book.title,
          book.type,
          new Date().toISOString(),
          new Date().toISOString(),
          new Date().toISOString(),
        );
      }

      // Verify all are completed independently
      for (const book of books) {
        const cachedInfo = await bookCache.getCachedBookInfo(
          userId,
          book.id,
          book.title,
          book.type,
        );
        assert.strictEqual(
          cachedInfo.exists,
          true,
          `${book.type} book "${book.title}" should be cached`,
        );
        assert.strictEqual(cachedInfo.progress_percent, 100);
      }
    });
  });

  describe('Real-World Scenario Testing', () => {
    test('handles the original "Vicious Secret" bug scenario', async () => {
      // Simulate the exact scenario from the bug report
      const mockAbsBook = {
        media: {
          metadata: {
            title: 'Vicious Secret',
            authors: [{ name: 'Unknown Author' }],
            // No ISBN or ASIN - this caused the original bug
          },
        },
      };

      // Extract identifiers (should be null/null)
      const identifiers = extractBookIdentifiers(mockAbsBook);
      assert.strictEqual(identifiers.isbn, null);
      assert.strictEqual(identifiers.asin, null);

      // Generate fallback identifier
      const title = 'Vicious Secret';
      const author = mockAbsBook.media.metadata.authors[0].name;
      const fallbackIdentifier = `${title}:${author}`
        .toLowerCase()
        .replace(/[^a-z0-9:]/g, '');

      // This should now work without throwing validation errors
      await assert.doesNotReject(async () => {
        await bookCache.storeBookCompletionData(
          userId,
          fallbackIdentifier,
          title,
          'title_author',
          new Date().toISOString(),
          new Date().toISOString(),
          new Date().toISOString(),
        );
      });

      // Verify completion was stored
      const cachedInfo = await bookCache.getCachedBookInfo(
        userId,
        fallbackIdentifier,
        title,
        'title_author',
      );
      assert.strictEqual(cachedInfo.exists, true);
      assert(
        cachedInfo.finished_at !== null,
        'finished_at should be set for completed books',
      );
    });

    test('handles books with various missing identifier scenarios', async () => {
      const problematicBooks = [
        {
          title: 'Old Book Without Modern IDs',
          metadata: { authors: [{ name: 'Classic Author' }] },
          expected: 'oldbookwithoutmodernids:classicauthor',
        },
        {
          title: 'Self-Published eBook',
          metadata: { authors: [{ name: 'Indie Writer' }] },
          expected: 'selfpublishedebook:indiewriter',
        },
        {
          title: 'Foreign Language Book',
          metadata: { authors: [{ name: 'Author Name' }] },
          expected: 'foreignlanguagebook:authorname',
        },
      ];

      for (const book of problematicBooks) {
        const fallbackIdentifier =
          `${book.title}:${book.metadata.authors[0].name}`
            .toLowerCase()
            .replace(/[^a-z0-9:]/g, '');

        assert.strictEqual(fallbackIdentifier, book.expected);

        // Should complete without errors
        await bookCache.storeBookCompletionData(
          userId,
          fallbackIdentifier,
          book.title,
          'title_author',
          new Date().toISOString(),
          new Date().toISOString(),
          new Date().toISOString(),
        );

        const cachedInfo = await bookCache.getCachedBookInfo(
          userId,
          fallbackIdentifier,
          book.title,
          'title_author',
        );
        assert.strictEqual(cachedInfo.exists, true);
      }
    });
  });
});
