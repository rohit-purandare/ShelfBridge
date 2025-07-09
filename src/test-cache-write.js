import { BookCache } from './book-cache.js';

const cache = new BookCache();
cache.storeEditionMapping(
  'test-user',
  '1234567890',
  'Test Book',
  1,
  'isbn',
  'Test Author'
);
console.log('Dummy record inserted!');
cache.close(); 