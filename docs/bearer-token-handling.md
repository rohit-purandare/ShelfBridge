# Bearer Token Handling

This document explains how ShelfBridge handles API tokens and specifically addresses the common issue of users accidentally including "Bearer" prefixes in their tokens.

## Problem

Users sometimes accidentally include "Bearer " in their API tokens when copying from documentation or testing tools. This causes authentication failures because the resulting Authorization header becomes:

```
Authorization: Bearer Bearer hc_sk_1234567890abcdef...
```

## Solution

ShelfBridge now automatically detects and handles this issue by:

1. **Token Normalization**: Both `HardcoverClient` and `AudiobookshelfClient` automatically strip "Bearer " prefixes from tokens during initialization
2. **Warning Logging**: When a "Bearer " prefix is detected and removed, a warning is logged to help users understand what happened
3. **Configuration Validation**: The config validator detects "Bearer " prefixes and warns users to use raw token values
4. **Documentation Updates**: All documentation now clearly states to use raw token values

## Implementation Details

### Token Normalization

Both client classes now include a `normalizeToken()` method:

```javascript
normalizeToken(token) {
    if (!token || typeof token !== 'string') {
        return token;
    }

    const trimmedToken = token.trim();
    
    // Check if token starts with "Bearer " (case-insensitive)
    if (trimmedToken.toLowerCase().startsWith('bearer ')) {
        const originalToken = trimmedToken;
        const normalizedToken = trimmedToken.substring(7); // Remove "Bearer "
        
        logger.warn('Token contained "Bearer" prefix - automatically removed', {
            originalLength: originalToken.length,
            normalizedLength: normalizedToken.length,
            originalPrefix: originalToken.substring(0, 15) + '...',
            normalizedPrefix: normalizedToken.substring(0, 15) + '...'
        });
        
        return normalizedToken;
    }
    
    return trimmedToken;
}
```

### Configuration Validation

The config validator now:

1. Detects "Bearer " prefixes in tokens during validation
2. Warns users that the prefix will be automatically removed
3. Includes "Bearer" patterns in placeholder detection

### Logging

When a "Bearer " prefix is detected, users see a warning like:

```
08:17:50 [warn]: Hardcover token contained "Bearer" prefix - automatically removed 
service="shelfbridge" version="1.1.8" 
originalLength=29 normalizedLength=22 
originalPrefix="bearer hc_sk_12..." 
normalizedPrefix="hc_sk_123456789..."
```

## User Experience

### For Users Who Accidentally Include "Bearer"

1. **Automatic Fix**: The token is automatically corrected
2. **Clear Warning**: A log message explains what happened
3. **No Service Interruption**: Authentication works normally
4. **Learning Opportunity**: Users understand the correct format

### For New Users

1. **Clear Documentation**: All guides specify to use raw token values
2. **Validation Warnings**: Configuration validation warns about "Bearer " prefixes
3. **Consistent Experience**: Both Audiobookshelf and Hardcover tokens work the same way

## Configuration Examples

### Correct Format
```yaml
users:
  - id: alice
    abs_url: https://audiobookshelf.example.com
    abs_token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
    hardcover_token: hc_sk_1234567890abcdef...
```

### Will Be Automatically Fixed
```yaml
users:
  - id: alice
    abs_url: https://audiobookshelf.example.com
    abs_token: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
    hardcover_token: Bearer hc_sk_1234567890abcdef...
```

## Testing

The solution handles various edge cases:

- ✅ Normal tokens (no change)
- ✅ Tokens with "Bearer " prefix (stripped)
- ✅ Case-insensitive detection ("bearer", "Bearer", "BEARER")
- ✅ Extra whitespace handling
- ✅ Empty, null, undefined tokens
- ✅ Mixed case prefixes ("BeArEr")

## Benefits

1. **Improved User Experience**: Users don't get stuck on authentication errors
2. **Self-Healing**: Common mistakes are automatically corrected
3. **Educational**: Users learn the correct format through warnings
4. **Backward Compatible**: Existing configurations continue to work
5. **Consistent**: Both API clients handle tokens the same way

## Future Considerations

- Monitor warning logs to see how often this issue occurs
- Consider adding more token format validations if needed
- Could extend to handle other common token format issues 