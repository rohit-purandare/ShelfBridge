# Rate Limiting in ShelfBridge

## Overview

ShelfBridge implements intelligent rate limiting to ensure responsible API usage and prevent exceeding third-party service limits. The rate limiting system uses the [`rate-limiter-flexible`](https://github.com/animir/node-rate-limiter-flexible) library to provide robust, production-ready rate limiting capabilities.

## Configuration

### Hardcover API Rate Limiting

The Hardcover client is configured with a **configurable rate limit** (default: 55 requests per minute) to ensure we stay within their API limits while maintaining optimal performance.

```javascript
// src/hardcover-client.js
export class HardcoverClient {
  constructor(token, semaphoreConcurrency = 1, rateLimitPerMinute = 55) {
    this.rateLimiter = new RateLimiter(rateLimitPerMinute);
    // ... rest of constructor
  }
}
```

**Configuration Options**:

```yaml
global:
  hardcover_rate_limit: 55 # Default: 55 requests/minute (range: 10-60)
```

**Use Cases**:

- **Conservative**: Set to 30-40 for shared accounts or frequent rate limiting
- **Default**: 55 requests/minute works well for most users
- **Aggressive**: 60 requests/minute if you have confirmed higher API limits

### Audiobookshelf API Rate Limiting

The Audiobookshelf client uses a **configurable rate limit** (default: 600 requests per minute) since it typically communicates with local or self-hosted servers that can handle different loads.

```javascript
// src/audiobookshelf-client.js
export class AudiobookshelfClient {
  constructor(
    baseUrl,
    token,
    semaphoreConcurrency = 1,
    maxBooksToFetch = null,
    pageSize = 100,
    rateLimitPerMinute = 600,
  ) {
    this.rateLimiter = new RateLimiter(rateLimitPerMinute);
    // ... rest of constructor
  }
}

// All Audiobookshelf requests use the 'audiobookshelf' identifier
await this.rateLimiter.waitIfNeeded('audiobookshelf');
```

**Configuration Options**:

```yaml
global:
  audiobookshelf_rate_limit: 600 # Default: 600 requests/minute (range: 60-1200)
```

**Use Cases**:

- **Raspberry Pi/slow servers**: Set to 120-300 for resource-constrained hosts
- **Default**: 600 requests/minute works well for most self-hosted servers
- **Powerful servers**: 900-1200 requests/minute for high-performance local setups
- **Shared hosting**: 200-400 requests/minute to avoid overwhelming shared resources

## Rate Limiter Implementation

### Core Features

The `RateLimiter` class in `src/utils.js` provides:

1. **Intelligent Queueing**: Requests are queued and processed at the appropriate rate instead of being dropped
2. **Warning System**: Logs warnings when approaching rate limits (80% of maximum)
3. **Automatic Retry**: Automatically waits and retries when limits are exceeded
4. **Exponential Backoff**: Implements intelligent retry strategies for different error types
5. **Request Tracking**: Tracks request patterns with unique identifiers
6. **Even Distribution**: Spreads requests evenly across time windows using `execEvenly: true`

### Key Methods

#### `waitIfNeeded(identifier)`

The primary method for rate limiting. Call this before making any API request.

```javascript
await this.rateLimiter.waitIfNeeded('hardcover-api');
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

### Retry and Backoff Strategy

ShelfBridge implements intelligent exponential backoff for different types of errors:

#### Client Errors (4xx Status Codes)

All client errors are retried with exponential backoff:

- **429 Too Many Requests**: Aggressive backoff (2s → 4s → 8s)
- **Other 4xx errors**: Standard backoff (1s → 2s → 4s)
- **Retryable errors include**: 400, 401, 403, 404, 408, 409, 423, 429

#### Server Errors (5xx Status Codes)

- **All 5xx errors**: Standard backoff (1s → 2s → 4s)
- **Includes**: 500, 502, 503, 504, etc.

#### Network Errors

- **Timeouts**: Standard backoff (1s → 2s → 4s)
- **Connection failures**: Standard backoff (1s → 2s → 4s)

#### Maximum Retries

- **Default**: 2 additional retries (3 total attempts)
- **Configurable**: Can be adjusted via configuration (future enhancement)

### Warning Thresholds

The system logs warnings when request usage reaches 80% of the configured limit:

```javascript
// Examples for different configured limits
// For 55 requests/minute limit (Hardcover default)
warningThreshold = Math.ceil(55 * 0.8) = 44 requests

// For 600 requests/minute limit (Audiobookshelf default)
warningThreshold = Math.ceil(600 * 0.8) = 480 requests

// Warning logged when >= threshold requests used in current minute
```

### Request Identification

Requests are tracked using identifiers that help distinguish between different services:

- `hardcover-api`: All Hardcover GraphQL requests (queries + mutations combined)
- `audiobookshelf`: All Audiobookshelf API calls

**Important**: Each service uses its own identifier to ensure separate rate limit buckets:

- Hardcover: Configurable (default: 55, range: 10-60 requests per minute)
- Audiobookshelf: Configurable (default: 600, range: 60-1200 requests per minute)

This prevents conflicts between different API services and ensures accurate rate limiting.

## Configuration Options

### RateLimiter Constructor Options

```javascript
const rateLimiter = new RateLimiter(
  (maxRequestsPerMinute = 55), // Maximum requests per minute
  (keyPrefix = 'rate-limiter'), // Prefix for internal keys
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
  service: 'shelfbridge',
  version: '1.7.2', // Dynamically read from package.json
  identifier: 'hardcover-api',
  remainingRequests: 11,
  resetTime: '2024-01-01T12:01:00.000Z',
});

// When limit is exceeded
logger.warn('Rate limit exceeded. Waiting 60s before next request', {
  service: 'shelfbridge',
  version: '1.7.2', // Dynamically read from package.json
  identifier: 'hardcover-api',
  remainingRequests: 0,
  resetTime: '2024-01-01T12:01:00.000Z',
});
```

## Verbose Logging for Rate Limiting

ShelfBridge now provides detailed verbose logging for every rate limiting decision made by the `RateLimiter` class. This is especially useful for diagnosing rate limiting issues, tracking all identifiers in use, and understanding when requests are allowed or delayed.

### How to Enable

Set the logger level to `verbose` (e.g., via environment variable or configuration) to see these logs:

```sh
LOG_LEVEL=verbose node your-script.js
```

### What Gets Logged

- Every rate limit check (even if allowed)
- Every allowed request
- Every delayed (rate-limited) request
- Identifier, key, requests used/remaining, reset time, action, and timestamp

### Sample Log Entry

```
[verbose]: [RateLimiter] waitIfNeeded check service="shelfbridge" version="1.8.2" identifier="hardcover-api" key="hardcover-api-1752607778730:hardcover-api" requestsUsed=1 remainingRequests=54 resetTime="2025-07-15T19:30:38.731Z" action="check"
[verbose]: [RateLimiter] request allowed service="shelfbridge" version="1.8.2" identifier="hardcover-api" key="hardcover-api-1752607778730:hardcover-api" requestsUsed=2 remainingRequests=53 resetTime="2025-07-15T19:30:39.824Z" action="allowed"
```

### When to Use

Enable verbose logging if you are:

- Diagnosing unexpected rate limiting
- Wanting to see all rate limiting decisions
- Tracking which identifiers are being used

## Best Practices

### 1. Use Appropriate Identifiers

Use descriptive identifiers to track different services:

```javascript
// Good - service-specific identifiers
await this.rateLimiter.waitIfNeeded('hardcover-api');
await this.rateLimiter.waitIfNeeded('audiobookshelf-progress');

// Avoid - generic identifiers
await this.rateLimiter.waitIfNeeded('default');
```

### 2. Handle Rate Limit Gracefully

The rate limiter automatically handles queuing, but be aware that operations may take longer when limits are approached:

```javascript
// This may take longer if rate limit is approached
const startTime = Date.now();
await this.rateLimiter.waitIfNeeded('hardcover-api');
const result = await this.executeQuery(query);
const duration = Date.now() - startTime;
```

### 3. Monitor Rate Limit Status

Check status periodically in long-running operations:

```javascript
const status = await this.rateLimiter.getStatus('hardcover-api');
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

### Recent Fixes (v1.7.1+)

**Issue**: Rate limiting warnings showing incorrect request counts (e.g., "742/600 requests used")

**Root Cause**: Audiobookshelf and Hardcover clients were sharing the same rate limit bucket due to using the default identifier.

**Solution**:

- Audiobookshelf client now uses `'audiobookshelf'` identifier
- Hardcover client uses `'hardcover-api'` identifier
- Each service has its own separate rate limit bucket
- Enhanced logging with service and version information

**Result**: Accurate rate limiting with separate 600/minute (Audiobookshelf) and 55/minute (Hardcover) limits.

### Container Restart Issues

If you experience rate limiting warnings immediately after container restart:

1. **Check the logs** for the specific identifier being used
2. **Verify** that you're not seeing "default" as the identifier
3. **Wait 1-2 minutes** for rate limit windows to reset
4. **Monitor** subsequent sync operations for normal behavior

**Expected behavior after fix**:

- Rate limiting warnings should show correct counts per service
- Container restarts should not cause immediate rate limit issues
- Each service should respect its own limits independently

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
- [ShelfBridge Configuration Guide](../admin/Configuration-Reference.md)
- [API Client Documentation](../technical/Architecture-Overview.md)
- [RetryManager Implementation](../../src/utils/retry-manager.js)

---

**Note**: This rate limiting implementation is designed to be respectful of third-party API limits while maintaining optimal performance for ShelfBridge users. Always monitor your API usage and adjust limits as needed.
