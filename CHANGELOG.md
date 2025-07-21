# Changelog

All notable changes to ShelfBridge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.16.0] - 2025-07-21

### Added
- **Comprehensive title/author matching** as third fallback option when ASIN/ISBN are unavailable
- Intelligent book matching using Hardcover's search API with sophisticated scoring algorithm
- Configurable confidence thresholds for title/author matching
- Cross-format matching support (audiobook ↔ ebook/paperback)
- Advanced scoring system considering activity, format, series, title similarity, author similarity, publication year, and narrator

### Changed
- Enhanced book matching to use 3-tier fallback: ASIN → ISBN → Title/Author
- Improved matching accuracy for books with incomplete metadata

### Fixed
- Documentation cleanup to remove unimplemented features from wiki

## [1.15.1] - 2025-07-21

### Fixed
- Documentation cleanup to remove unimplemented features from wiki

## [1.15.0] - 2025-07-21

### Added
- **Environment variable configuration support** for Docker deployments and homelab setups
- Support for configuring basic settings without YAML files
- Environment variables provide ~85% feature parity with YAML configuration
- Advanced features like library filtering still require YAML

### Changed
- Consolidated configuration documentation
- Improved Docker deployment experience

## [1.14.0] - 2025-07-18

### Added
- **Multi-library filtering support** - include/exclude specific Audiobookshelf libraries by name or ID
- Global and per-user library filtering configuration
- Enhanced debug command shows available libraries for easy configuration

### Improved
- GitHub workflow improvements

## [1.13.0] - 2025-07-18

### Added
- **Configurable deep_scan_interval setting** for better performance control
- Enhanced sync output display and user experience improvements

### Changed
- Improved sync result formatting and progress indicators
- Better performance metrics display

## [1.12.6] - 2025-07-17

### Improved
- Sync output display and user experience
- Better progress indicators during sync operations

## [1.12.5] - 2025-07-17

### Fixed
- Updated README to remove obsolete information and fix version inconsistencies

## [1.12.4] - 2025-07-17

### Added
- Comprehensive documentation cleanup and validation

## [1.12.3] - 2025-07-17

### Fixed
- Resolved undefined variables in debug function

## [1.12.2] - 2025-07-16

### Added
- **Major performance optimization and architecture improvements**
- Performance optimization and profiling tools for better monitoring

## [1.12.1] - 2025-07-16

### Added
- Configurable rate limiting with standardized documentation
- Better rate limiting controls for both APIs

## [1.12.0] - 2025-07-16

### Added
- Performance improvements and fixes for hanging issues
- Better resource management and connection handling

## [1.11.0] - 2025-07-15

### Added
- Made `max_books_to_fetch` default to infinite for better user experience
- Improved configuration display and validation

### Fixed
- Updated pre-commit hook to run ESLint on staged JS files

## [1.10.0] - 2025-07-15

### Added
- **Optimized configuration for Docker Compose users**
- Better default settings for containerized deployments

### Improved
- Rate limiting fixes and comprehensive documentation
- Semaphore concurrency settings for both Audiobookshelf and Hardcover APIs

## [1.9.0] - 2025-07-15

### Added
- **Global semaphore for Audiobookshelf API requests** to prevent repeated rate limit waits
- Verbose logging to RateLimiter for better troubleshooting
- Human-readable sync schedule display using cronstrue

### Fixed
- Rate limiting issues with shared buckets
- Improved API request management

## [1.8.0] - 2025-07-15

### Added
- **User-facing sync progress and rate limit pause/resume messages**
- Better user feedback during sync operations

### Changed
- Updated documentation to edit config.yaml on host, not in container

## [1.7.0] - 2025-07-14

### Added
- **Error dumping functionality for failed sync books**
- Better debugging capabilities for failed synchronizations

### Fixed
- Hardcover rate limiting issues
- GitHub Actions labeler configuration and workflow
- ESLint no-case-declarations errors in cache management

### Changed
- Docker restart policy to on-failure to prevent restart loops during config setup

## [1.6.0] - 2025-07-14

### Added
- **Global `--verbose` option** for detailed output across all commands
- Improved CLI documentation and help system

### Fixed
- Interactive mode output improvements
- CLI reference consistency issues

## [1.5.0] - 2025-07-14

### Added
- **Generic caching strategy for faster Docker builds**
- Improved native module messaging for better user experience

### Fixed
- Scheduled sync made default for Docker and CLI
- Interactive mode improvements
- Docker compatibility issues with lowercase registry cache reference

## [1.4.0] - 2025-07-14

### Added
- **Comprehensive automated native module handling and Docker optimization**
- True interactive mode using inquirer for menu-driven CLI
- Docker instructions for accessing interactive CLI menu

### Fixed
- Moved schema-inspector.js to test folder and fixed ESLint errors

## [1.3.0] - 2025-07-14

### Added
- **Automated Docker permission fixing for zero-config setup**
- Improved Docker deployment experience

## [1.2.0] - 2025-07-14

### Added
- **Automatic Bearer token prefix handling** for improved API token management
- Enhanced logging system for better debugging

### Fixed
- Hardcover API mutation: updated insert_user_book_one to insert_user_book
- Docker permission issues and restart loop prevention
- Dependabot configuration improvements

## [1.1.0] - 2025-07-13

### Added
- **Secure single version-and-release workflow** replacing separate workflows
- MIT license for the project
- Labeler workflow for auto-labeling pull requests
- Dependabot configuration for npm and GitHub Actions updates

### Fixed
- Release workflow with proper permissions and modern actions
- Docker documentation and permission issues
- Version bump workflow improvements

## [1.0.0] - 2025-07-11

### Added
- **Comprehensive GitHub workflows** for CI/CD automation
- Debug command functionality for troubleshooting
- Rate limiting for Hardcover API
- Comprehensive wiki documentation
- Auto-provisioning for simplified user experience
- GHCR publishing workflow for Docker images

### Fixed
- Critical sync reliability issues
- Docker build optimizations and security improvements
- Hardcover API schema compatibility
- Configuration template improvements

## [0.1.0] - 2025-07-09

### Added
- **Initial release** of ShelfBridge
- Core synchronization between Audiobookshelf and Hardcover
- Reading progress sync functionality
- Book matching using ASIN and ISBN identifiers
- Basic configuration system
- Docker support with docker-compose setup
- Progress regression protection for re-reading detection
- Comprehensive security scanning workflow
- Basic logging and cache system

---

## Version History Summary

**Major Milestones:**
- **v1.16.0**: Title/author matching for books without identifiers
- **v1.15.0**: Environment variable configuration support
- **v1.14.0**: Multi-library filtering capabilities
- **v1.12.x**: Major performance optimizations and architecture improvements
- **v1.10.0**: Docker Compose optimization and rate limiting improvements
- **v1.7.0**: Error dumping and debugging enhancements
- **v1.6.0**: Global verbose option and CLI improvements
- **v1.4.0**: Interactive CLI mode and Docker automation
- **v1.2.0**: Bearer token handling and API improvements
- **v1.0.0**: Production-ready release with comprehensive workflows
- **v0.1.0**: Initial release with core functionality

**Development Timeline:** 12 days of intensive development (July 9-21, 2025)  
**Total Releases:** 49 versions  
**Total Features:** 30+ major features implemented  
**Total Fixes:** 25+ critical issues resolved  

**Key Areas of Development:**
1. **Core Sync Engine** (v0.1.0 - v1.2.0)
2. **Docker & Deployment** (v1.3.0 - v1.7.0)
3. **Performance & Reliability** (v1.8.0 - v1.12.0)
4. **Advanced Features** (v1.13.0 - v1.16.0)

[Unreleased]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.16.0...HEAD
[1.16.0]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.15.1...v1.16.0
[1.15.1]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.15.0...v1.15.1
[1.15.0]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.14.0...v1.15.0
[1.14.0]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.13.0...v1.14.0
[1.13.0]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.12.6...v1.13.0
[1.12.6]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.12.5...v1.12.6
[1.12.5]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.12.4...v1.12.5
[1.12.4]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.12.3...v1.12.4
[1.12.3]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.12.2...v1.12.3
[1.12.2]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.12.1...v1.12.2
[1.12.1]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.12.0...v1.12.1
[1.12.0]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.11.0...v1.12.0
[1.11.0]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.10.0...v1.11.0
[1.10.0]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.9.0...v1.10.0
[1.9.0]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.7.0...v1.8.0
[1.7.0]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/rohit-purandare/ShelfBridge/releases/tag/v1.0.0
[0.1.0]: https://github.com/rohit-purandare/ShelfBridge/releases/tag/v0.1.0 