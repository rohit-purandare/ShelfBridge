# 📄 Pagination System

ShelfBridge implements a configurable pagination system to efficiently handle large Audiobookshelf libraries without causing memory issues or application hanging.

## 🎯 Overview

The pagination system addresses the problem of large libraries (1000+ books) that could generate 2+ MB JSON responses, causing the application to hang on resource-constrained devices like Raspberry Pi.

## 🔧 Configuration Options

### `max_books_to_fetch`
**Type**: Number or null  
**Default**: `null` (no limit)  
**Purpose**: Controls the total number of books fetched from Audiobookshelf libraries

```yaml
global:
  max_books_to_fetch: null  # Fetch all books (no limit)
  # OR
  max_books_to_fetch: 500   # Fetch up to 500 books total
```

### `page_size`
**Type**: Number (25-200)  
**Default**: `100`  
**Purpose**: Controls the number of books fetched per API call

```yaml
global:
  page_size: 100  # Fetch 100 books per API call
```

## 🏗️ How It Works

### Pagination Algorithm

```javascript
// Example: max_books_to_fetch = 500, page_size = 100
// Library has 1200 books total

// Page 0: Fetches books 1-100
// Page 1: Fetches books 101-200  
// Page 2: Fetches books 201-300
// Page 3: Fetches books 301-400
// Page 4: Fetches books 401-500
// Page 5: Stops (reached max_books_to_fetch limit)

// Result: 500 books fetched across 5 API calls
```

### Implementation Details

1. **Page Size Calculation**: `itemsPerPage = Math.min(limit, this.pageSize)`
2. **API Calls**: `/api/libraries/{id}/items?limit={pageSize}&page={pageNumber}`
3. **Termination Conditions**:
   - Reached `max_books_to_fetch` limit
   - No more items returned from API
   - Page returns fewer items than requested

## 📊 Performance Characteristics

### Memory Usage

| Page Size | Memory per Request | API Calls for 500 Books |
|-----------|-------------------|-------------------------|
| 25        | ~50-100 KB        | 20 calls                |
| 50        | ~100-200 KB       | 10 calls                |
| 100       | ~200-400 KB       | 5 calls                 |
| 200       | ~400-800 KB       | 3 calls                 |

### Network Efficiency

**Small Page Sizes (25-50):**
- ✅ Lower memory usage
- ✅ Better for slow connections
- ✅ More reliable on resource-constrained devices
- ❌ More API calls required

**Large Page Sizes (100-200):**
- ✅ Fewer API calls
- ✅ Faster on fast connections
- ❌ Higher memory usage per request
- ❌ May timeout on slow connections

## 🎛️ Configuration Examples

### Raspberry Pi or Low-Resource Devices

```yaml
global:
  max_books_to_fetch: 100  # Conservative total
  page_size: 25           # Small responses
  workers: 1              # Reduce parallel processing
  parallel: false         # Disable parallel processing
```

### Fast Network Connections

```yaml
global:
  max_books_to_fetch: 1000  # More books total
  page_size: 200           # Larger responses, fewer calls
  workers: 3               # Standard parallel processing
```

### Slow or Unreliable Connections

```yaml
global:
  max_books_to_fetch: 500   # Reasonable total
  page_size: 50            # Smaller responses, more reliable
  workers: 1               # Conservative parallel processing
```

### Testing and Development

```yaml
global:
  max_books_to_process: 10  # Test with limited books
  max_books_to_fetch: 50    # Fetch limited books
  page_size: 25            # Small responses for testing
  dry_run: true            # Don't make actual changes
```

## 🔍 Debugging Pagination

### Log Messages

The pagination system provides detailed logging:

```
📄 Library items pagination info: { libraryId: "123", total: 1200, itemsPerPage: 100, firstPageCount: 100 }
📄 Fetched library items page: { libraryId: "123", page: 0, itemsInPage: 100, totalFetched: 100 }
📄 Fetched library items page: { libraryId: "123", page: 1, itemsInPage: 100, totalFetched: 200 }
📄 Completed library items fetch: { libraryId: "123", totalItems: 500, pages: 5 }
```

### Common Issues

**Too Many API Calls:**
- Increase `page_size` to reduce the number of requests
- Monitor rate limiting messages

**Memory Issues:**
- Decrease `page_size` to reduce memory per request
- Decrease `max_books_to_fetch` to limit total memory usage

**Slow Performance:**
- Balance `page_size` with network speed
- Consider adjusting `workers` and `parallel` settings

## 🔗 Related Documentation

- **[Configuration Overview](../admin/Configuration-Overview.md)** - Complete configuration reference
- **[Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)** - Solving pagination issues
- **[Architecture Overview](Architecture-Overview.md)** - How pagination fits into the overall system
- **[Rate Limiting](Rate-Limiting.md)** - How pagination interacts with rate limiting 