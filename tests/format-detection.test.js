/**
 * Format Detection Tests
 * 
 * Tests for the simplified detectUserBookFormat function that trusts
 * what Audiobookshelf tells us directly about media types.
 */

import { describe, it, expect } from '@jest/globals';
import { detectUserBookFormat } from '../src/matching/utils/audiobookshelf-extractor.js';

describe('Format Detection', () => {
  describe('detectUserBookFormat', () => {
    it('should default to ebook for null/empty metadata', () => {
      expect(detectUserBookFormat(null)).toBe('ebook');
      expect(detectUserBookFormat(undefined)).toBe('ebook');
      expect(detectUserBookFormat({})).toBe('ebook');
    });

    describe('Audiobook Detection', () => {
      it('should detect audiobook from explicit mediaType first', () => {
        const metadata = { mediaType: 'book' }; // Audiobookshelf uses 'book' for audiobooks
        expect(detectUserBookFormat(metadata)).toBe('audiobook');

        const metadata2 = { mediaType: 'audio' };
        expect(detectUserBookFormat(metadata2)).toBe('audiobook');

        const metadata3 = { mediaType: 'AUDIOBOOK' };
        expect(detectUserBookFormat(metadata3)).toBe('audiobook');
      });

      it('should detect audiobook from duration', () => {
        const metadata = { duration: 43200 };
        expect(detectUserBookFormat(metadata)).toBe('audiobook');
      });

      it('should detect audiobook from media duration', () => {
        const metadata = { media: { duration: 43200 } };
        expect(detectUserBookFormat(metadata)).toBe('audiobook');
      });

      it('should detect audiobook from narrator', () => {
        const metadata = { narrator: 'John Doe' };
        expect(detectUserBookFormat(metadata)).toBe('audiobook');
      });

      it('should detect audiobook from media narrator', () => {
        const metadata = { media: { metadata: { narrator: 'Jane Smith' } } };
        expect(detectUserBookFormat(metadata)).toBe('audiobook');
      });

      it('should detect audiobook from audio mediaType', () => {
        const metadata = { mediaType: 'audio' };
        expect(detectUserBookFormat(metadata)).toBe('audiobook');

        const metadata2 = { mediaType: 'AUDIOBOOK' };
        expect(detectUserBookFormat(metadata2)).toBe('audiobook');
      });

      it('should detect audiobook from audio files', () => {
        const metadata = {
          media: {
            audioFiles: [
              { path: 'chapter1.mp3' },
              { path: 'chapter2.m4a' }
            ]
          }
        };
        expect(detectUserBookFormat(metadata)).toBe('audiobook');
      });

      it('should detect audiobook from file path extensions', () => {
        const metadata = { path: '/audiobooks/book.mp3' };
        expect(detectUserBookFormat(metadata)).toBe('audiobook');

        const metadata2 = { path: '/library/author/book.m4b' };
        expect(detectUserBookFormat(metadata2)).toBe('audiobook');

        const metadata3 = { path: '/books/test.flac' };
        expect(detectUserBookFormat(metadata3)).toBe('audiobook');
      });

      it('should detect audiobook from library type', () => {
        const metadata = { libraryType: 'audiobooks' };
        expect(detectUserBookFormat(metadata)).toBe('audiobook');

        const metadata2 = { libraryType: 'AUDIO_BOOKS' };
        expect(detectUserBookFormat(metadata2)).toBe('audiobook');
      });

      it('should detect audiobook from time-based progress', () => {
        const metadata = { progress: { timeListened: 1800 } };
        expect(detectUserBookFormat(metadata)).toBe('audiobook');

        const metadata2 = { timeListened: 3600 };
        expect(detectUserBookFormat(metadata2)).toBe('audiobook');
      });

      it('should prioritize primary indicators over secondary ones', () => {
        // Duration should override format hints
        const metadata = {
          duration: 43200,
          format: 'epub'
        };
        expect(detectUserBookFormat(metadata)).toBe('audiobook');
      });
    });

    describe('Ebook Detection', () => {
      it('should detect ebook from EPUB format', () => {
        const metadata = { format: 'epub' };
        expect(detectUserBookFormat(metadata)).toBe('ebook');

        const metadata2 = { format: 'EPUB' };
        expect(detectUserBookFormat(metadata2)).toBe('ebook');
      });

      it('should detect ebook from PDF format', () => {
        const metadata = { format: 'pdf' };
        expect(detectUserBookFormat(metadata)).toBe('ebook');
      });

      it('should detect ebook from MOBI format', () => {
        const metadata = { format: 'mobi' };
        expect(detectUserBookFormat(metadata)).toBe('ebook');
      });

      it('should detect ebook from AZW format', () => {
        const metadata = { format: 'azw3' };
        expect(detectUserBookFormat(metadata)).toBe('ebook');
      });

      it('should detect ebook from ebook mediaType', () => {
        const metadata = { mediaType: 'ebook' };
        expect(detectUserBookFormat(metadata)).toBe('ebook');

        const metadata2 = { mediaType: 'EBOOK' };
        expect(detectUserBookFormat(metadata2)).toBe('ebook');
      });

      it('should prioritize explicit mediaType over other indicators', () => {
        const metadata = {
          mediaType: 'ebook',
          duration: 43200,    // Would normally indicate audiobook
          narrator: 'Test'    // Would normally indicate audiobook
        };
        expect(detectUserBookFormat(metadata)).toBe('ebook'); // Should trust mediaType
      });

      it('should detect ebook from ebook files', () => {
        const metadata = {
          media: {
            ebookFiles: [
              { path: 'book.epub' },
              { path: 'book.pdf' }
            ]
          }
        };
        expect(detectUserBookFormat(metadata)).toBe('ebook');
      });

      it('should detect ebook from file path extensions', () => {
        const metadata = { path: '/ebooks/book.epub' };
        expect(detectUserBookFormat(metadata)).toBe('ebook');

        const metadata2 = { path: '/library/author/book.pdf' };
        expect(detectUserBookFormat(metadata2)).toBe('ebook');

        const metadata3 = { path: '/books/test.mobi' };
        expect(detectUserBookFormat(metadata3)).toBe('ebook');
      });

      it('should detect ebook from library type', () => {
        const metadata = { libraryType: 'ebooks' };
        expect(detectUserBookFormat(metadata)).toBe('ebook');

        const metadata2 = { libraryType: 'books' };
        expect(detectUserBookFormat(metadata2)).toBe('ebook');

        const metadata3 = { libraryType: 'EBOOK_LIBRARY' };
        expect(detectUserBookFormat(metadata3)).toBe('ebook');
      });
    });

    describe('Complex Scenarios', () => {
      it('should handle mixed indicators correctly (audiobook priority)', () => {
        const metadata = {
          duration: 43200,        // Primary audiobook indicator
          format: 'epub',         // Ebook indicator
          narrator: 'John Doe',   // Primary audiobook indicator
          pages: 300              // Ebook indicator
        };
        expect(detectUserBookFormat(metadata)).toBe('audiobook');
      });

      it('should handle edge case with only pages', () => {
        const metadata = { pages: 250 };
        expect(detectUserBookFormat(metadata)).toBe('ebook');
      });

      it('should handle case with no clear indicators', () => {
        const metadata = {
          title: 'Some Book',
          author: 'Some Author',
          isbn: '1234567890'
        };
        expect(detectUserBookFormat(metadata)).toBe('ebook');
      });

      it('should handle nested media metadata structures', () => {
        const metadata = {
          media: {
            metadata: {
              title: 'Test Book',
              author: 'Test Author',
              narrator: 'Test Narrator'
            },
            duration: 43200,
            audioFiles: [{ path: 'audio.mp3' }]
          }
        };
        expect(detectUserBookFormat(metadata)).toBe('audiobook');
      });

      it('should be case-insensitive for format detection', () => {
        const metadata1 = { format: 'EPUB' };
        expect(detectUserBookFormat(metadata1)).toBe('ebook');

        const metadata2 = { mediaType: 'AUDIOBOOK' };
        expect(detectUserBookFormat(metadata2)).toBe('audiobook');

        const metadata3 = { path: '/Books/Test.PDF' };
        expect(detectUserBookFormat(metadata3)).toBe('ebook');
      });

      it('should handle empty arrays gracefully', () => {
        const metadata = {
          media: {
            audioFiles: [],
            ebookFiles: []
          }
        };
        expect(detectUserBookFormat(metadata)).toBe('ebook');
      });

      it('should prioritize audio files over ebook files when both present', () => {
        const metadata = {
          media: {
            audioFiles: [{ path: 'audio.mp3' }],
            ebookFiles: [{ path: 'book.epub' }]
          }
        };
        expect(detectUserBookFormat(metadata)).toBe('audiobook');
      });

      it('should handle malformed file extensions', () => {
        const metadata1 = { path: '/books/file.' };
        expect(detectUserBookFormat(metadata1)).toBe('ebook');

        const metadata2 = { path: '/books/file' };
        expect(detectUserBookFormat(metadata2)).toBe('ebook');
      });

      it('should handle multiple file extensions in path', () => {
        const metadata = { path: '/books/backup.epub.old' };
        expect(detectUserBookFormat(metadata)).toBe('ebook');
      });
    });

    describe('Real-world Audiobookshelf Examples', () => {
      it('should handle typical audiobook metadata structure', () => {
        const audiobookMetadata = {
          id: 'book_123',
          title: 'The Great Audiobook',
          author: 'Famous Author',
          narrator: 'Great Narrator',
          duration: 32400,
          media: {
            duration: 32400,
            audioFiles: [
              { index: 1, path: '/audiobooks/great_book/01.mp3' },
              { index: 2, path: '/audiobooks/great_book/02.mp3' }
            ],
            metadata: {
              title: 'The Great Audiobook',
              author: 'Famous Author',
              narrator: 'Great Narrator'
            }
          },
          libraryType: 'audiobooks'
        };
        expect(detectUserBookFormat(audiobookMetadata)).toBe('audiobook');
      });

      it('should handle typical ebook metadata structure', () => {
        const ebookMetadata = {
          id: 'book_456',
          title: 'The Great Ebook',
          author: 'Famous Author',
          format: 'epub',
          pages: 350,
          media: {
            ebookFiles: [
              { path: '/ebooks/great_book/book.epub' }
            ],
            metadata: {
              title: 'The Great Ebook',
              author: 'Famous Author',
              pages: 350
            }
          },
          libraryType: 'books'
        };
        expect(detectUserBookFormat(ebookMetadata)).toBe('ebook');
      });

      it('should handle Audiobookshelf progress tracking differences', () => {
        const audiobookProgress = {
          title: 'Audio Progress Test',
          progress: {
            timeListened: 7200,
            isFinished: false
          }
        };
        expect(detectUserBookFormat(audiobookProgress)).toBe('audiobook');

        const ebookProgress = {
          title: 'Ebook Progress Test',
          progress: {
            pagesRead: 150,
            isFinished: false
          }
        };
        expect(detectUserBookFormat(ebookProgress)).toBe('ebook');
      });
    });
  });
});
