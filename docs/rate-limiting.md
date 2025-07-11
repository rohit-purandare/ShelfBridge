# Rate Limiting in ShelfBridge

## Overview

ShelfBridge implements intelligent rate limiting to ensure responsible API usage and prevent exceeding third-party service limits. The rate limiting system uses the [`rate-limiter-flexible`](https://github.com/animir/node-rate-limiter-flexible) library to provide robust, production-ready rate limiting capabilities.

## Configuration

### Hardcover API Rate Limiting

The Hardcover client is configured with a rate limit of **55 requests per minute** to ensure we stay within their API limits while maintaining optimal performance.

```javascript
// src/hardcover-client.js
const RATE_LIMIT_PER_MINUTE = 55;

export class HardcoverClient {
    constructor(token) {
        this.rateLimiter = new RateLimiter(RATE_LIMIT_PER_MINUTE);
        // ... rest of constructor
    }
}
```

### Audiobookshelf API Rate Limiting

The Audiobookshelf client uses a more generous rate limit of **600 requests per minute** (10 requests per second) since it typically communicates with local or self-hosted servers.

```javascript
// src/audiobookshelf-client.js
export class AudiobookshelfClient {
    constructor(baseUrl, token, maxWorkers = 3) {
        this.rateLimiter = new RateLimiter(600); // 10 requests per second
        // ... rest of constructor
    }
}
```

## Rate Limiter Implementation

### Core Features

The `RateLimiter` class in `src/utils.js` provides:

1. **Intelligent Queueing**: Requests are queued and processed at the appropriate rate instead of being dropped
2. **Warning System**: Logs warnings when approaching rate limits (80% of maximum)
3. **Automatic Retry**: Automatically waits and retries when limits are exceeded
4. **Request Tracking**: Tracks request patterns with unique identifiers
5. **Even Distribution**: Spreads requests evenly across time windows using `execEvenly: true`

### Key Methods

#### `waitIfNeeded(identifier)`
The primary method for rate limiting. Call this before making any API request.

```javascript
await this.rateLimiter.waitIfNeeded('hardcover-query');
// Your API request here
```

#### `getStatus(identifier)`
Returns current rate limit status including:
- `requestsUsed`: Number of requests made in current window
- `maxRequests`: Maximum allowed requests per window
- `remainingRequests`: Remaining requests in current window
- `resetTime`: When the rate limit window resets
- `isNearLimit`: Whether approaching the warning threshold

#### `reset(identifier)`
Resets the rate limit counter for a specific identifier.

## Rate Limiting Logic

### Request Processing

1. **Check Current Status**: Before making a request, check if we're approaching limits
2. **Log Warnings**: When usage exceeds 80% of the limit, log a warning
3. **Queue Requests**: If limit is exceeded, queue the request for later processing
4. **Even Distribution**: Spread requests evenly across the time window
5. **Automatic Retry**: Automatically retry after the appropriate wait time

### Warning Thresholds

The system logs warnings when request usage reaches 80% of the configured limit:

```javascript
// For 55 requests/minute limit
warningThreshold = Math.ceil(55 * 0.8) = 44 requests

// Warning logged when >= 44 requests used in current minute
```

### Request Identification

Requests are tracked using identifiers that help distinguish between different types of operations:

- `hardcover-query`: Hardcover GraphQL queries
- `hardcover-mutation`: Hardcover GraphQL mutations
- `audiobookshelf-*`: Audiobookshelf API calls

## Configuration Options

### RateLimiter Constructor Options

```javascript
const rateLimiter = new RateLimiter(
    maxRequestsPerMinute = 55,  // Maximum requests per minute
    keyPrefix = 'rate-limiter'  // Prefix for internal keys
);
```

### rate-limiter-flexible Options

The underlying rate limiter is configured with:

```javascript
{
    points: maxRequestsPerMinute,  // Number of requests allowed
    duration: 60,                  // Time window in seconds
    blockDuration: 60,             // Block duration when exceeded
    execEvenly: true               // Spread requests evenly
}
```

## Monitoring and Logging

### Log Levels

- **DEBUG**: Normal operation, request tracking
- **WARN**: Approaching rate limits, exceeded limits
- **ERROR**: Rate limiter errors, connection issues

### Example Log Messages

```javascript
// Warning when approaching limit
logger.warn('Rate limit warning: 44/55 requests used in the current minute', {
    identifier: 'hardcover-query',
    remainingRequests: 11,
    resetTime: '2024-01-01T12:01:00.000Z'
});

// When limit is exceeded
logger.warn('Rate limit exceeded. Waiting 15s before next request', {
    identifier: 'hardcover-mutation',
    remainingRequests: 0,
    resetTime: '2024-01-01T12:01:00.000Z'
});
```

## Best Practices

### 1. Use Appropriate Identifiers

Use descriptive identifiers to track different types of requests:

```javascript
// Good - specific identifiers
await this.rateLimiter.waitIfNeeded('hardcover-user-books');
await this.rateLimiter.waitIfNeeded('hardcover-update-progress');

// Avoid - generic identifiers
await this.rateLimiter.waitIfNeeded('default');
```

### 2. Handle Rate Limit Gracefully

The rate limiter automatically handles queuing, but be aware that operations may take longer when limits are approached:

```javascript
// This may take longer if rate limit is approached
const startTime = Date.now();
await this.rateLimiter.waitIfNeeded('hardcover-query');
const result = await this.executeQuery(query);
const duration = Date.now() - startTime;
```

### 3. Monitor Rate Limit Status

Check status periodically in long-running operations:

```javascript
const status = await this.rateLimiter.getStatus('hardcover-query');
if (status.isNearLimit) {
    logger.info('Approaching rate limit, slowing down operations');
}
```

## Testing

### Unit Tests

The rate limiter includes comprehensive unit tests in `test/rate-limiter-test.js`:

```bash
# Run rate limiter tests
node test/rate-limiter-test.js
```

### Test Coverage

- ✅ Basic rate limiting (55 requests/minute)
- ✅ Status tracking and reporting
- ✅ Warning threshold detection (80% of limit)
- ✅ Concurrent request handling
- ✅ Reset functionality

### Performance Testing

The rate limiter is designed for high performance:
- Average request processing: ~1ms overhead
- Concurrent request handling: Properly queued
- Memory usage: Minimal with automatic cleanup

## Troubleshooting

### Common Issues

1. **Requests Taking Too Long**
   - Check if you're hitting rate limits
   - Review log messages for warnings
   - Consider adjusting request patterns

2. **Rate Limit Exceeded Errors**
   - Increase the rate limit if appropriate
   - Implement request batching
   - Add delays between operations

3. **Memory Usage**
   - The rate limiter automatically cleans up old data
   - Monitor memory usage in long-running processes

### Debugging

Enable debug logging to see detailed rate limiter behavior:

```javascript
// Check current status
const status = await rateLimiter.getStatus('my-identifier');
console.log('Rate limit status:', status);

// Reset if needed
await rateLimiter.reset('my-identifier');
```

## Future Enhancements

### Potential Improvements

1. **Dynamic Rate Limits**: Adjust limits based on API response headers
2. **Circuit Breaker**: Implement circuit breaker pattern for API failures
3. **Distributed Rate Limiting**: Use Redis for multi-instance deployments
4. **Adaptive Limits**: Learn optimal rates from API behavior

### Configuration Extensions

Consider adding these options in future versions:

```javascript
{
    adaptiveRate: true,           // Adjust rate based on API responses
    circuitBreaker: true,         // Enable circuit breaker
    distributedStore: 'redis',    // Use Redis for distributed limiting
    retryStrategy: 'exponential'  // Retry with exponential backoff
}
```

## Related Documentation

- [Hardcover API Documentation](https://docs.hardcover.app/)
- [rate-limiter-flexible Documentation](https://github.com/animir/node-rate-limiter-flexible)
- [ShelfBridge Configuration Guide](../config/README.md)
- [API Client Documentation](../api-clients/README.md)

---

**Note**: This rate limiting implementation is designed to be respectful of third-party API limits while maintaining optimal performance for ShelfBridge users. Always monitor your API usage and adjust limits as needed. 