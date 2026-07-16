export const PLACEHOLDER_PATTERNS = {
  urls: [
    'your-audiobookshelf-server.com',
    'your-abs-server.com',
    'your-server.com',
    'localhost.example.com',
    'example.com',
    'your-domain.com',
    'audiobookshelf.example.com',
  ],
  tokens: [
    'your_audiobookshelf_api_token',
    'your_audiobookshelf_token',
    'your_abs_token',
    'your_hardcover_api_token',
    'your_hardcover_token',
    'your_token_here',
    'abc123',
    'xyz789',
    'token123',
    'api_token_here',
    'your_api_key',
    'your_api_token',
    'bearer your_audiobookshelf_api_token',
    'bearer your_hardcover_api_token',
    'bearer your_token_here',
  ],
  userIds: ['your_username', 'your_user_id', 'user_id_here', 'username_here'],
};

const USER_PLACEHOLDER_FIELDS = {
  abs_url: 'urls',
  abs_token: 'tokens',
  hardcover_token: 'tokens',
  id: 'userIds',
};

export function isPlaceholderValue(value, category) {
  if (!value || typeof value !== 'string') {
    return false;
  }

  const patterns = PLACEHOLDER_PATTERNS[category] || [];
  const lowerValue = value.toLowerCase();

  return patterns.some(pattern => lowerValue.includes(pattern.toLowerCase()));
}

export function findUserPlaceholderValues(users) {
  if (!Array.isArray(users)) {
    return [];
  }

  const placeholders = [];

  users.forEach((user, index) => {
    if (!user || typeof user !== 'object') {
      return;
    }

    for (const [field, category] of Object.entries(USER_PLACEHOLDER_FIELDS)) {
      if (isPlaceholderValue(user[field], category)) {
        placeholders.push({ index, field, value: user[field] });
      }
    }
  });

  return placeholders;
}
