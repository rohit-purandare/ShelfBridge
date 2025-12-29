# Changelog

All notable changes to ShelfBridge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.22.5](https://github.com/rohit-purandare/ShelfBridge/compare/v1.22.4...v1.22.5) (2025-12-29)


### ## 🔧 Bug Fixes

* automatically update Want to Read books to Currently Reading ([b1c25d1](https://github.com/rohit-purandare/ShelfBridge/commit/b1c25d164f2b1af2a56c4212329f99fe946d42d4))
* breaking change on format_id + other fixes ([f3c59d4](https://github.com/rohit-purandare/ShelfBridge/commit/f3c59d45d5cc35b558fdade9b5595d5f7afc0703))
* resolve ESLint chalk dependency issues and remove undefined readingFormatId ([bed6630](https://github.com/rohit-purandare/ShelfBridge/commit/bed6630cc5966c3b8c333dbcce9a8a23204e731f))
* return full edition object in ASIN cross-edition matching ([de4b422](https://github.com/rohit-purandare/ShelfBridge/commit/de4b422ed1d29040ba82767c70a0a28e70f90d4b))


### ## ♻️ Code Refactoring

* remove reading_format_id from Hardcover API mutations ([db9e8ae](https://github.com/rohit-purandare/ShelfBridge/commit/db9e8ae249345fab5210ed7098c3f6e72aa760b0))
* simplify status update to only check Want to Read ([ee0bb2b](https://github.com/rohit-purandare/ShelfBridge/commit/ee0bb2b42af7b227a2ca4c985af7d25f6cdbb753))

## [1.22.4](https://github.com/rohit-purandare/ShelfBridge/compare/v1.22.3...v1.22.4) (2025-10-14)


### ## 🔧 Bug Fixes

* apply prettier formatting to test files ([ad98c7c](https://github.com/rohit-purandare/ShelfBridge/commit/ad98c7c19b0aa139d23bc35fbc545d2806f2d5b0))
* clarify completion detection log messages to eliminate user conf… ([a89aa4a](https://github.com/rohit-purandare/ShelfBridge/commit/a89aa4a3fe4b7f8ee8ec1115704ec30bd607b93a))
* clarify completion detection log messages to eliminate user confusion ([56276d4](https://github.com/rohit-purandare/ShelfBridge/commit/56276d44ffb5e07ca0383678cb54c9ffc8d4f60f))
* eliminate duplicate startup messages and unify logging format ([0180bc8](https://github.com/rohit-purandare/ShelfBridge/commit/0180bc86427b7c77a0377fc55c971dd805353d53))
* handle existing log file permissions in Docker containers ([75a4b85](https://github.com/rohit-purandare/ShelfBridge/commit/75a4b8584828df4584bc5d490a3eced05b940005))
* implement robust completion detection with dual-method fallback ([57bb93a](https://github.com/rohit-purandare/ShelfBridge/commit/57bb93a027afd3f4e157e8de7cb28ede29ae3576))
* remove duplicate logging messages in sync flow ([8339391](https://github.com/rohit-purandare/ShelfBridge/commit/83393913d93093dd2db6471ce5eab1bcfa66fa08))
* resolve Docker logging permissions timing issue ([ce7e346](https://github.com/rohit-purandare/ShelfBridge/commit/ce7e346dfb041556af2e05c794d7d3e8fde51f47))
* resolve ESLint unused variable warnings in logger.js ([03748c3](https://github.com/rohit-purandare/ShelfBridge/commit/03748c3e35ab092dcd3a72d60e75f3fa402fb247))

## [1.22.3](https://github.com/rohit-purandare/ShelfBridge/compare/v1.22.2...v1.22.3) (2025-09-18)


### ## 🔧 Bug Fixes

* comprehensive cache optimization eliminates all duplicate title/author searches ([54e9ee8](https://github.com/rohit-purandare/ShelfBridge/commit/54e9ee82c652fc97b5bc466df5acb185c8721204))
* ensure consistent title/author cache identifiers across all operations ([1e932a7](https://github.com/rohit-purandare/ShelfBridge/commit/1e932a7b5e9ba94f263744419e2651e632268b8f))
* implement direct edition sync to eliminate all title/author searches ([8bf39cd](https://github.com/rohit-purandare/ShelfBridge/commit/8bf39cd25a1edf6870226f611d695ba7b2dbf479))
* implement multi-pattern cache lookup for backward compatibility ([a36b267](https://github.com/rohit-purandare/ShelfBridge/commit/a36b267ec3c8575ba6d709a2682442e699470ff9))
* preserve hardcoverMatch from direct edition sync to enable actual progress updates ([f1af459](https://github.com/rohit-purandare/ShelfBridge/commit/f1af4595394e0447155b4dd122402f0e93333847))
* preserve hardcoverMatch from direct edition sync to enable actual progress updates ([f866ec9](https://github.com/rohit-purandare/ShelfBridge/commit/f866ec94d75563b2b7a330c7de92b332ea8a1218))
* preserve original matching method to prevent cache inconsistencies ([3a4087e](https://github.com/rohit-purandare/ShelfBridge/commit/3a4087e1d5a2897d5828efb74b25ed4c50191ab9))
* prevent duplicate matching for title/author books during progres… ([0c6c915](https://github.com/rohit-purandare/ShelfBridge/commit/0c6c915558ac55baca4eaab40430c4158a5dd2b2))
* prevent duplicate matching for title/author books during progress updates ([6174932](https://github.com/rohit-purandare/ShelfBridge/commit/61749324fcb5b2a61f29f48197e56d08f8e599e5))
* prevent title/author searches in auto-add fallback for cached books ([182a83f](https://github.com/rohit-purandare/ShelfBridge/commit/182a83f5797caa3e451822b0ef37f77acf76af1b))
* remove synthetic objects to prevent API validation errors ([029e642](https://github.com/rohit-purandare/ShelfBridge/commit/029e64211ae6b30de140c93e86962834c260b338))
* resolve 'Cannot access hardcoverMatch before initialization' error ([744b5d0](https://github.com/rohit-purandare/ShelfBridge/commit/744b5d0d25688c89b24e74f8911a419755bf930f))
* resolve 'Cannot read properties of undefined' error in _syncExistingBook ([8675e0b](https://github.com/rohit-purandare/ShelfBridge/commit/8675e0b72efd0e869d913073ea825f9e835dfec4))
* reuse cached match data to eliminate searches for books with changed progress ([ae5cd4e](https://github.com/rohit-purandare/ShelfBridge/commit/ae5cd4e66351ede8c4a339698a37dbbbe452e4da))


### ## 🔒 Security

* update axios to 1.12.2 to fix DoS vulnerability ([47cbcf1](https://github.com/rohit-purandare/ShelfBridge/commit/47cbcf1772f7727545ea0acb011a4f6638931ed1))

## [1.22.2](https://github.com/rohit-purandare/ShelfBridge/compare/v1.22.1...v1.22.2) (2025-09-08)


### ## 🔧 Bug Fixes

* apply library filtering to items in progress ([8095aa9](https://github.com/rohit-purandare/ShelfBridge/commit/8095aa9e31ff9ffe403f386705d3f4ef0f9cc856))
* apply prettier formatting to resolve CI code quality checks ([eb86255](https://github.com/rohit-purandare/ShelfBridge/commit/eb86255856aa7adc4697491e08831ebac56a9f02))


### ## 🔒 Security

* add comprehensive package overrides for latest versions ([b9b4250](https://github.com/rohit-purandare/ShelfBridge/commit/b9b42504a2f26477170f26057c5d6b75741442f6))
* update vulnerable packages to latest versions ([7a68637](https://github.com/rohit-purandare/ShelfBridge/commit/7a68637e1af97506ef385685df7438a69a851eac))

## [1.22.1](https://github.com/rohit-purandare/ShelfBridge/compare/v1.22.0...v1.22.1) (2025-09-07)


### ## 🔧 Bug Fixes

* correct Docker semver tagging with release-please integration ([38c1b9b](https://github.com/rohit-purandare/ShelfBridge/commit/38c1b9b63bf143e4a11bd4c073a43d2ceac7a3bf))
* optimize sync performance to resolve 2.5hr sync times (issue [#125](https://github.com/rohit-purandare/ShelfBridge/issues/125)) ([0fb0d01](https://github.com/rohit-purandare/ShelfBridge/commit/0fb0d0107faa0b1f9dfb0c4f1f9f0cf8b7e72514))
* optimize sync performance to resolve 2.5hr sync times (issue [#125](https://github.com/rohit-purandare/ShelfBridge/issues/125)) ([114ac6e](https://github.com/rohit-purandare/ShelfBridge/commit/114ac6e90544094a32800e115e35822360fbc30e))
* use correct semver tag configuration with value parameter ([dbd4140](https://github.com/rohit-purandare/ShelfBridge/commit/dbd4140f72968617d140c601903b0c3cba88a50a))
* use correct semver tag configuration with value parameter ([d8b2dd9](https://github.com/rohit-purandare/ShelfBridge/commit/d8b2dd94674628c0b142c9ea8bd4964d7f66bfea))

## [1.22.0](https://github.com/rohit-purandare/ShelfBridge/compare/v1.21.0...v1.22.0) (2025-08-28)


### ## 🚀 Features

* add DisplayLogger utility for centralized console output ([84b9324](https://github.com/rohit-purandare/ShelfBridge/commit/84b9324c67983ca8eea3bc45e92cc2a8f0bea101))


### ## 🔧 Bug Fixes

* handle books with missing ISBN/ASIN identifiers during completion ([c18c516](https://github.com/rohit-purandare/ShelfBridge/commit/c18c5166ce19e0b50c0fd8bf6e8718b53dd1712d))
* resolve Docker Hub authentication error in CI workflow ([289cc26](https://github.com/rohit-purandare/ShelfBridge/commit/289cc2600c0c5975a024962896763575ca482427))
* resolve Git exit code 128 error by removing orphaned submodule directory ([7c57844](https://github.com/rohit-purandare/ShelfBridge/commit/7c578440eff906db69e9d48950391be147961c56))
* resolve workflow failures and formatting issues ([6c09c56](https://github.com/rohit-purandare/ShelfBridge/commit/6c09c565bd5336e964dbd9f8ee71058ea4366082))


### ## ♻️ Code Refactoring

* optimize workflow triggers for efficiency ([a34ec23](https://github.com/rohit-purandare/ShelfBridge/commit/a34ec23363d66b08654c705c732f709f9b25cc70))
* replace console.log with DisplayLogger in SyncResultFormatter ([6b561ee](https://github.com/rohit-purandare/ShelfBridge/commit/6b561eed31d408a300a0c98186c23ea84eb91a85))

## [1.21.0](https://github.com/rohit-purandare/ShelfBridge/compare/v1.20.5...v1.21.0) (2025-08-26)


### ## 🚀 Features

* enhance Docker workflows for comprehensive branch and release tagging ([8fd6740](https://github.com/rohit-purandare/ShelfBridge/commit/8fd6740a69f5ce23659dfff1de6ef39dc48a3440))


### ## 🔧 Bug Fixes

* improve logging clarity in title-author matcher rejection logic ([c4c4116](https://github.com/rohit-purandare/ShelfBridge/commit/c4c41160306b8a46c305f258d51b913b3b3acda6))
* improve logging clarity in title-author matcher rejection logic ([a4cae42](https://github.com/rohit-purandare/ShelfBridge/commit/a4cae42ef63a127c219e3a138c67a9b6a9b6a41e))
* resolve critical Docker workflow issues ([4d7912f](https://github.com/rohit-purandare/ShelfBridge/commit/4d7912f71200673b272b1e9b177c123f250e90fe))
* resolve Hardcover search API mismatch for audiobook titles with format suffixes ([7a5653b](https://github.com/rohit-purandare/ShelfBridge/commit/7a5653bf9c48a84b85d7ba7cd0505b70c1f4d4c2))

## [1.20.5](https://github.com/rohit-purandare/ShelfBridge/compare/v1.20.4...v1.20.5) (2025-08-26)


### ## 🔧 Bug Fixes

* set _needsBookIdLookup flag for ASIN/ISBN search results ([4df759b](https://github.com/rohit-purandare/ShelfBridge/commit/4df759b4276f6714bc9d27c6a3ffb71b7d7739d6))

## [1.20.4](https://github.com/rohit-purandare/ShelfBridge/compare/v1.20.3...v1.20.4) (2025-08-25)


### ## 🔧 Bug Fixes

* prevent null userBook crashes in sync and matching ([1941409](https://github.com/rohit-purandare/ShelfBridge/commit/1941409f23a5973be51850d3dee78944694d956b))

## [1.20.3](https://github.com/rohit-purandare/ShelfBridge/compare/v1.20.2...v1.20.3) (2025-08-22)


### ## 🔧 Bug Fixes

* improve ASIN/ISBN matcher auto-add consistency and logging ([a0498c0](https://github.com/rohit-purandare/ShelfBridge/commit/a0498c08420fc99d3452072b172709c2330b38ab))
* improve ASIN/ISBN matcher auto-add consistency and logging ([5edba3b](https://github.com/rohit-purandare/ShelfBridge/commit/5edba3b1e8fa6beaa307aac04883cbe6ea4f739c))

## [1.20.2](https://github.com/rohit-purandare/ShelfBridge/compare/v1.20.1...v1.20.2) (2025-08-20)


### ## 🔧 Bug Fixes

* enhance title/author matching logging and fix progress regression warnings ([de913d2](https://github.com/rohit-purandare/ShelfBridge/commit/de913d2a6fe908f09c4c5f97fed1fb84606eef1f))
* implement narrator matching system and advanced text normalization ([d696c09](https://github.com/rohit-purandare/ShelfBridge/commit/d696c09058bbc444891f4cb3808a9ec66fc336ed))
* improve book matching reliability with two-stage approach ([1fde97c](https://github.com/rohit-purandare/ShelfBridge/commit/1fde97ce4ff48ac0878531da9dfef2f06a7a4fa9))
* refactor title/author matching to apply DRY principle and improv… ([f22675c](https://github.com/rohit-purandare/ShelfBridge/commit/f22675c734f17411c40e33318a52960b776ef810))
* refactor title/author matching to apply DRY principle and improve reliability ([0925d98](https://github.com/rohit-purandare/ShelfBridge/commit/0925d984ab066f05ac961266f370e11b11ff320f))
* resolve author extraction bug and consolidate text matching utilities ([f3c87b3](https://github.com/rohit-purandare/ShelfBridge/commit/f3c87b359e43b78d9dde2f6a8c110c2f61615458))
* resolve null userBook reference in title-author two-stage matching ([6279a92](https://github.com/rohit-purandare/ShelfBridge/commit/6279a920c0225ad8ed236dcaae6c816f2ec46c9c))
* resolve scoring undefined name property error and improve extraction robustness ([02c89e6](https://github.com/rohit-purandare/ShelfBridge/commit/02c89e6905fa2ff9929ee9c22c6c519b8fa7e09d))

## [1.20.1](https://github.com/rohit-purandare/ShelfBridge/compare/v1.20.0...v1.20.1) (2025-08-13)


### ## 🔧 Bug Fixes

* add title/author fallback to auto-add when ISBN/ASIN lookup fails ([53ce062](https://github.com/rohit-purandare/ShelfBridge/commit/53ce0626c8bc16f14e3a9118a6106858c9eb2c4e))


### ## ♻️ Code Refactoring

* use existing TitleAuthorMatcher instead of duplicating logic ([19b1034](https://github.com/rohit-purandare/ShelfBridge/commit/19b1034b1885c658fe371cf5d982d7f73c380ccb))

## [1.20.0](https://github.com/rohit-purandare/ShelfBridge/compare/v1.19.5...v1.20.0) (2025-08-13)


### ## 🚀 Features

* add comprehensive test suite for delayed updates functionality ([1613ad8](https://github.com/rohit-purandare/ShelfBridge/commit/1613ad8ba7600b4b3624aa3e2d740e680ffbc13f))
* add configuration foundation for delayed updates feature ([24c4ccf](https://github.com/rohit-purandare/ShelfBridge/commit/24c4ccf7867f225b01e52964239ee42b5516d8e9))
* add database migration and session methods for delayed updates ([88203f3](https://github.com/rohit-purandare/ShelfBridge/commit/88203f37e11b86d3087bfc9a1040b6d0446e19cf))
* add startup session recovery for delayed updates ([239d790](https://github.com/rohit-purandare/ShelfBridge/commit/239d7903a77d683ab88eab1f04b8b017cea409fd))
* implement SessionManager class for delayed updates ([9d9f99a](https://github.com/rohit-purandare/ShelfBridge/commit/9d9f99aa5fd1bce488315fc5f5a07bf5f161c11b))
* integrate SessionManager with SyncManager for delayed updates ([b1f4aa0](https://github.com/rohit-purandare/ShelfBridge/commit/b1f4aa05c23749fdd38b1f702037efa7b0f60ae2))


### ## 🔧 Bug Fixes

* improve environment variable parsing for delayed updates ([f8bb195](https://github.com/rohit-purandare/ShelfBridge/commit/f8bb195c0ad0211e7b7bd73b5193a9b52e9fb6f0))
* scan all books for completion detection instead of limiting to first 100 ([bd23cbc](https://github.com/rohit-purandare/ShelfBridge/commit/bd23cbc9b1afb8f75b76e05ad49ecb672ef294a3))

## [1.19.5](https://github.com/rohit-purandare/ShelfBridge/compare/v1.19.4...v1.19.5) (2025-08-12)


### ## 🔧 Bug Fixes

* correct GitHub wiki links to point to repository wiki folder ([24ada91](https://github.com/rohit-purandare/ShelfBridge/commit/24ada912bfdf5a34072d2fc6055616c1f92c4c9d))
* enhance book matching with comprehensive cross-edition support ([27ece06](https://github.com/rohit-purandare/ShelfBridge/commit/27ece06afc4ab97c8949a219f10c3d42bdf6bd09))
* prevent Docker container from exiting after initial sync ([f8d5e6a](https://github.com/rohit-purandare/ShelfBridge/commit/f8d5e6ad005a000324ab8e70a741311e9ad47ac2))
* resolve title/author matching by fixing author extraction and implementing book-level matching ([c92d8d6](https://github.com/rohit-purandare/ShelfBridge/commit/c92d8d69f95b96551d6378f89d7cd53ab5d8741f))


### ## ♻️ Code Refactoring

* complete CLI integration - massive main.js reduction ([004483b](https://github.com/rohit-purandare/ShelfBridge/commit/004483b68e09c018b6e638f37fbcb2d46db1f6dd))
* extract all remaining CLI commands ([99b5c46](https://github.com/rohit-purandare/ShelfBridge/commit/99b5c46258528812bf35c5daed86683692ec4aa9))
* extract CLI commands infrastructure ([0b79101](https://github.com/rohit-purandare/ShelfBridge/commit/0b7910155d4224d0f8195a47519b27b1ccea397a))
* extract sync output formatting to dedicated module ([c9e3c74](https://github.com/rohit-purandare/ShelfBridge/commit/c9e3c74de0d311531f7254afdd70e5fc6e09963f))

## [1.19.4](https://github.com/rohit-purandare/ShelfBridge/compare/v1.19.3...v1.19.4) (2025-08-11)


### Bug Fixes

* add main branch trigger back to docker-build with release deduplication ([e5d9777](https://github.com/rohit-purandare/ShelfBridge/commit/e5d9777fd2e1afbdd610c3291fb0840f4cf67ac2))
* add secrets inherit to reusable workflow call ([ea16d9a](https://github.com/rohit-purandare/ShelfBridge/commit/ea16d9a2a46cf5fc44ff4cd658d633d7ceddd665))
* ensure book completion operations are atomic ([b09e614](https://github.com/rohit-purandare/ShelfBridge/commit/b09e61480ee1af0c17c76581391c00d489025f0e))

## [1.19.3](https://github.com/rohit-purandare/ShelfBridge/compare/v1.19.2...v1.19.3) (2025-08-10)


### Bug Fixes

* add memoization to eliminate duplicate ISBN lookup table creation ([3ed2419](https://github.com/rohit-purandare/ShelfBridge/commit/3ed24190d92dc01b23073c8ec5eefcf1a67c868c))
* eliminate duplicate ISBN/ASIN lookups with combined memoization ([e300799](https://github.com/rohit-purandare/ShelfBridge/commit/e300799aac82e186c2a0739d6829c02515496ffd)), closes [#65](https://github.com/rohit-purandare/ShelfBridge/issues/65)

## [1.19.2](https://github.com/rohit-purandare/ShelfBridge/compare/v1.19.1...v1.19.2) (2025-08-09)


### Bug Fixes

* enable title/author matching when identifiers are missing and improve logging ([5461de8](https://github.com/rohit-purandare/ShelfBridge/commit/5461de8d6b6cc7c0ee0d713da8414025e63ef253))
* implement multi-key cache lookup for identifier transitions ([80b502c](https://github.com/rohit-purandare/ShelfBridge/commit/80b502c469412e6a7659c5f690182e93bcb7b69f))
* prevent auto-add when progress below min_progress_threshold ([0cb2fc5](https://github.com/rohit-purandare/ShelfBridge/commit/0cb2fc53f8403a6320ad551a23b78efac7063f3d))
* prevent undefined property access errors in title/author matching ([b22ad5c](https://github.com/rohit-purandare/ShelfBridge/commit/b22ad5c6e8dafb668e389a46fe7aa2fcf38927ff))
* reduce log verbosity for book matching success messages ([6a11e04](https://github.com/rohit-purandare/ShelfBridge/commit/6a11e04db24537311e0a24c89ad062464b82612a))

## [1.19.1] - 2025-08-08

### Fixed
- 🔧 **MaxListenersExceededWarning Resolution**: Fixed memory leak warning when processing many books
  - Configure dynamic listener limits in SyncManager based on max_books_to_fetch configuration
  - Set global unlimited listeners in main.js for multi-user parallel scenarios
  - Prevents 'Possible EventTarget memory leak detected' warnings during parallel operations
  - Maintains proper cleanup and backward compatibility while scaling with configuration settings
- 🔄 **Enhanced Server Error Handling**: Improved reliability for Hardcover API interactions
  - Added automatic retry logic for HTTP 5xx server errors (502, 503, 504, etc.)
  - Extended existing timeout retry logic to cover temporary server issues
  - Uses exponential backoff strategy (1s, 2s, 4s) with configurable max retries
  - Better error logging distinguishes between timeout and server error types
  - Significantly improves sync reliability when Hardcover API experiences temporary outages

## [1.19.0] - 2025-08-08

### Added
- **complete modular book matching architecture with comprehensive testing**
- chore: add comprehensive test coverage for utilities and core modules
- chore: add comprehensive unit test suite with proper cleanup
- **implement ACID-style transactions for sync operations**

### Changed
- build(deps): update GitHub Actions (#36)
- standardize logging key to user_id for consistent structured logging
- extract utilities into focused modules and fix force sync issues
- complete function separation and eliminate duplicate matching logic
- extract book matching into modular architecture

### Fixed
- update npm test script to explicitly list test files
- fully guard all rotating log targets; disable file transports if dir or existing log files are not writable
- fallback to console-only when logs/ is not writable; avoid EACCES on exception/rejection handlers
- always send started_at to Hardcover; correct timezone date formatting
- resolve author extraction object handling in matching module

### Improved
- chore: add automated testing and improve network resilience


## [1.18.28] - 2025-08-06

### Added
- **implement centralized ProgressManager for standardized progress handling**
- **implement reading_format_id support in GraphQL mutations**

### Changed
- chore: update Node.js requirements to align with dependencies
- ci: replace insecure gitleaks download with official action
- ci: remove redundant ESLint runtime installation
- ci: fix critical security vulnerability in labeler workflow
- ci: correct broken CI main entry point test
- ci: adopt industry-standard automated release workflow
- ci: remove conflicting release-on-merge workflow
- ci: prevent duplicate Docker builds from version bump commits
- centralize progress change detection and regression analysis
- chore: remove obsolete deep scan architecture

### Fixed
- ensure consistent format detection between ProgressManager and sync operations
- improve start date handling and reduce log noise
- centralize progress logic and prevent duplicate completion processing
- resolve cache logic bug and dry-run display inconsistency
- improve dry-run sync summary display for clarity
- implement consistent format detection across all book matching methods
- preserve existing start dates and fix edition format detection
- add missing edition metadata to getBookFromEdition GraphQL query
- ensure completion detection runs on every sync


## [1.18.27] - 2025-08-06

### Added
- ci: add missing security-scan job for required status check
- chore: implement conservative dependency update strategy
- chore: add Renovate configuration to replace Dependabot

### Changed
- Allow specifying a custom user (#41)
- build(deps): migrate config renovate.json (#31)
- chore: fix Renovate deprecation warnings
- chore: make conservative dependency strategy comprehensive
- chore: correct Renovate configuration errors
- chore: remove fresh-install-test directory
- chore: remove Dependabot configuration, replaced with Renovate
- ci: synchronize release creation with Docker build completion

### Improved
- chore: improve Renovate configuration


## [1.18.26] - 2025-07-30

### Changed
- Fix/completed book filtering (#23)


## [1.18.25] - 2025-07-28

### Added
- chore: add setup instructions to config example file

### Changed
- ci: prevent feature branches from getting latest Docker tag
- chore: remove redundant security-scan workflow

### Fixed
- add missing _needsBookIdLookup flag for cached title/author matches (#22)


## [1.18.24] - 2025-07-28

### Fixed
- resolve config.yaml auto-creation blocking environment variables (#20)


## [1.18.23] - 2025-07-27

### Changed
- ci: eliminate duplicate Docker builds for releases


## [1.18.22] - 2025-07-27

### Added
- ci: implement token-based automatic release workflow
- Feat/auto create folders and config (#19)

### Fixed
- test automatic release workflow with token


## [1.18.20] - 2025-07-25

### Changed
- Fix missing book ID in title/author search results (#16)
- ci: fix labeler permissions for pull requests
- ci: enable Docker builds for feature branches and fix labeler config


## [1.18.19] - 2025-07-24

### Fixed
- implement static linking for better-sqlite3 to resolve shared object issues


## [1.18.18] - 2025-07-24

### Improved
- hotfix: resolve better-sqlite3 user permissions issue


## [1.18.17] - 2025-07-24

### Fixed
- resolve better-sqlite3 native module compatibility issues permanently


## [1.18.16] - 2025-07-24

### Fixed
- add missing integer conversion for getBookCurrentProgress userBookId parameter


## [1.18.15] - 2025-07-24

### Fixed
- resolve title/author matching null reference and GraphQL type errors


## [1.18.14] - 2025-07-23

### Fixed
- complete native module compatibility solution


## [1.18.13] - 2025-07-23

### Fixed
- remove npm cache mount that was preserving glibc binaries


## [1.18.12] - 2025-07-23

### Changed
- chore: revert docker-compose.yml to use remote image by default

### Fixed
- resolve better-sqlite3 native module glibc/musl compatibility issue


## [1.18.11] - 2025-07-23

### Added
- ci: add test environment variables to fix CI configuration validation

### Fixed
- prevent endless restart loop when configuration is invalid


## [1.18.10] - 2025-07-23

### Fixed
- native module compatibility and comprehensive prevention system


## [1.18.9] - 2025-07-23

### Fixed
- critical native module compatibility issue in Docker containers


## [1.18.8] - 2025-07-23

### Changed
- chore: update dependencies to resolve security vulnerability


## [1.18.7] - 2025-07-23

### Changed
- comprehensive author contributions system enhancement
- build(deps): bump luxon from 3.5.0 to 3.7.1 in the minor-and-patch group (#3)
- ci: skip dependency updates from triggering releases


## [1.18.6] - 2025-07-23

### Changed
- build(deps): bump docker/build-push-action from 5 to 6 (#2)


## [1.18.5] - 2025-07-23

### Fixed
- update labeler configuration for actions/labeler@v5 compatibility


## [1.18.4] - 2025-07-23

### Fixed
- integrate Docker build into release workflow for automatic version targeting


## [1.18.3] - 2025-07-23

### Fixed
- ensure version tags trigger Docker builds for automatic release targeting


## [1.18.2] - 2025-07-23

### Fixed
- ensure Docker images are built for all releases


## [1.18.1] - 2025-07-23

### Changed
- ci: fix Docker image case sensitivity and tagging issues

### Fixed
- first sync detection and force sync override for progress regression protection


## [1.18.0] - 2025-07-22

### Added
- **improve logging clarity and user experience**

### Changed
- ci: remove --invert-grep flag in changelog generation


## [1.17.0] - 2025-07-22

### Added
- ci: add Prettier formatting with pre-commit hooks


## [1.16.1] - 2025-07-21

### Added
- ci: add automatic changelog generation and management system


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

[Unreleased]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.19.0...HEAD
[1.19.0]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.28...v1.19.0
[1.18.28]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.27...v1.18.28
[1.18.27]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.26...v1.18.27
[1.18.26]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.25...v1.18.26
[1.18.25]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.24...v1.18.25
[1.18.24]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.23...v1.18.24
[1.18.23]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.22...v1.18.23
[1.18.22]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.20...v1.18.22
[1.18.20]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.19...v1.18.20
[1.18.19]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.18...v1.18.19
[1.18.18]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.17...v1.18.18
[1.18.17]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.16...v1.18.17
[1.18.16]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.15...v1.18.16
[1.18.15]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.14...v1.18.15
[1.18.14]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.13...v1.18.14
[1.18.13]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.12...v1.18.13
[1.18.12]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.11...v1.18.12
[1.18.11]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.10...v1.18.11
[1.18.10]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.9...v1.18.10
[1.18.9]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.8...v1.18.9
[1.18.8]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.7...v1.18.8
[1.18.7]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.6...v1.18.7
[1.18.6]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.5...v1.18.6
[1.18.5]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.4...v1.18.5
[1.18.4]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.3...v1.18.4
[1.18.3]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.2...v1.18.3
[1.18.2]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.1...v1.18.2
[1.18.1]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.18.0...v1.18.1
[1.18.0]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.17.0...v1.18.0
[1.17.0]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.16.1...v1.17.0
[1.16.1]: https://github.com/rohit-purandare/ShelfBridge/compare/v1.16.0...v1.16.1
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
