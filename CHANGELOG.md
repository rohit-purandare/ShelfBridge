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

## [2.0.0](https://github.com/rohit-purandare/ShelfBridge/compare/shelfbridge-v1.19.4...shelfbridge-v2.0.0) (2025-08-11)


### ⚠ BREAKING CHANGES

* None - all public APIs remain unchanged

### ## 🚀 Features

* add --verbose global option and improve CLI documentation ([6d18e87](https://github.com/rohit-purandare/ShelfBridge/commit/6d18e87db5805ae174a2f30230cd88c23efc5a92))
* add automated version bump workflow for continuous releases ([bf56d89](https://github.com/rohit-purandare/ShelfBridge/commit/bf56d894b8b87ba094a18b56e7a9976748a5362c))
* Add automatic Bearer token prefix handling and improve logging ([0c6ad4a](https://github.com/rohit-purandare/ShelfBridge/commit/0c6ad4a13f7633ff1df486e4469dee1e71e6d4ae))
* add comprehensive security scanning workflow ([aa6bf4c](https://github.com/rohit-purandare/ShelfBridge/commit/aa6bf4c64678efe139b098674b80a94bcfdd6c2c))
* Add comprehensive title/author matching as third fallback option ([0358d11](https://github.com/rohit-purandare/ShelfBridge/commit/0358d11bce040e946915f0f486d4dd5a5f6308ce))
* Add configurable deep_scan_interval setting ([1c6dc7c](https://github.com/rohit-purandare/ShelfBridge/commit/1c6dc7c0f96361abd5d287e3d5ed1c41266eacd2))
* Add environment variable support and consolidate configuration documentation ([f50a4cf](https://github.com/rohit-purandare/ShelfBridge/commit/f50a4cfc05bf7e0c4dcbe03ce361995e41e14fc8))
* Add error dumping functionality for failed sync books ([65a5f06](https://github.com/rohit-purandare/ShelfBridge/commit/65a5f061ec28a68d564d8e42e5d4e4b89b0ea1d7))
* add GitHub workflows and fix code quality issues ([6c9e83e](https://github.com/rohit-purandare/ShelfBridge/commit/6c9e83ebf152a665060dc9715d82c8f1c9e6c905))
* add multi-library filtering support + workflow improvements ([fbc589c](https://github.com/rohit-purandare/ShelfBridge/commit/fbc589cdc208427966f9a3a602c59092a903da4a))
* Add performance optimization and profiling tools ([b5a4087](https://github.com/rohit-purandare/ShelfBridge/commit/b5a4087c3d584f67baa13b1dacadd0b406ce9c91))
* add user-facing sync progress and rate limit pause/resume messages ([407f6ad](https://github.com/rohit-purandare/ShelfBridge/commit/407f6adccbd9eacc6b52e3d6f23f2a9faeae2aee))
* automate Docker permission fixing for zero-config setup ([1a2a029](https://github.com/rohit-purandare/ShelfBridge/commit/1a2a02967dbfae44677a996c948141b01e726391))
* **cli:** add true interactive mode using inquirer for menu-driven CLI ([2117e29](https://github.com/rohit-purandare/ShelfBridge/commit/2117e2922c72a9c55f4087afa221f9b3dfb64ba8))
* complete modular book matching architecture with comprehensive testing ([fbf3681](https://github.com/rohit-purandare/ShelfBridge/commit/fbf3681b2b771144fb479ea6d77ecddeeef46a3e))
* comprehensive automated native module handling and Docker optimization ([94176af](https://github.com/rohit-purandare/ShelfBridge/commit/94176afc5522e22ac7fe47255f52fdc8e7af0daf))
* create new reading sessions for resumed completed books ([beb77ff](https://github.com/rohit-purandare/ShelfBridge/commit/beb77ff0e08c1af804725c09a347a93279d984b6))
* Enhanced book matching with edition-specific search and improved scoring ([bf4dd9e](https://github.com/rohit-purandare/ShelfBridge/commit/bf4dd9e16a0eb45fa4eb9020cdbd72bdc76878eb))
* extract book matching into modular architecture with comprehensive testing ([9a3b3d1](https://github.com/rohit-purandare/ShelfBridge/commit/9a3b3d1f733ffd16c39c8e86fd927f793b95867d))
* implement ACID-style transactions for sync operations ([b2fe921](https://github.com/rohit-purandare/ShelfBridge/commit/b2fe921df529e02455cc1cc1e23e453117555185))
* implement centralized ProgressManager for standardized progress handling ([c576eb7](https://github.com/rohit-purandare/ShelfBridge/commit/c576eb7cd446500e33bd45a7245599ef86b43ec0))
* Implement comprehensive debug command functionality ([19d11b3](https://github.com/rohit-purandare/ShelfBridge/commit/19d11b3776a24caeab5060ae4a07a67fc2c2c895))
* implement generic caching strategy for faster builds ([9dacdbb](https://github.com/rohit-purandare/ShelfBridge/commit/9dacdbbd95e5820ebcaa402d85d1538a615827b8))
* implement reading_format_id support in GraphQL mutations ([e5af857](https://github.com/rohit-purandare/ShelfBridge/commit/e5af857a09a077a2bed6f210bddea8c1e92c00c9))
* improve logging clarity and user experience ([b6b09ce](https://github.com/rohit-purandare/ShelfBridge/commit/b6b09ceac8ef51fdadddd393593ed4141be5ef2b))
* improve native module messaging to be more generic ([aac79fb](https://github.com/rohit-purandare/ShelfBridge/commit/aac79fbdd4891d2a1fc5c1454ea58cdca5f38405))
* improve performance and fix hanging issues ([0406afe](https://github.com/rohit-purandare/ShelfBridge/commit/0406afe1eac1f58f85572e1ae878345e8c9105bf))
* **logging:** add verbose logging to RateLimiter and document usage for troubleshooting ([7b5373d](https://github.com/rohit-purandare/ShelfBridge/commit/7b5373d2d53f8d35092178947cd265b2e5732761))
* Major performance optimization and architecture improvements ([33a54bd](https://github.com/rohit-purandare/ShelfBridge/commit/33a54bde705d2d71212fd0e03eba397ff044f56b))
* make max_books_to_fetch default infinite and improve config display ([04a6035](https://github.com/rohit-purandare/ShelfBridge/commit/04a6035b0ea7c0d2509ea0fa6b6693bece2bc019))
* my new features test ([#5](https://github.com/rohit-purandare/ShelfBridge/issues/5)) ([bc7e1be](https://github.com/rohit-purandare/ShelfBridge/commit/bc7e1be0f2e22442073d5bbda8e5aecfc34343e2))
* optimize configuration for Docker Compose users ([a479c21](https://github.com/rohit-purandare/ShelfBridge/commit/a479c21862331e814808640c0b72404965cc5010))
* optimize Docker image size with multi-stage build ([d41cc34](https://github.com/rohit-purandare/ShelfBridge/commit/d41cc34648657c7b0168c20aab1d28b8e117394b))
* replace separate workflows with secure single version-and-release workflow ([5ee44ff](https://github.com/rohit-purandare/ShelfBridge/commit/5ee44ff0ebabde09a8b361a4b650c0b38a093121))


### ## 🔧 Bug Fixes

* add main branch trigger back to docker-build with release deduplication ([e5d9777](https://github.com/rohit-purandare/ShelfBridge/commit/e5d9777fd2e1afbdd610c3291fb0840f4cf67ac2))
* add memoization to eliminate duplicate ISBN lookup table creation ([3ed2419](https://github.com/rohit-purandare/ShelfBridge/commit/3ed24190d92dc01b23073c8ec5eefcf1a67c868c))
* add missing _needsBookIdLookup flag for cached title/author matches ([#22](https://github.com/rohit-purandare/ShelfBridge/issues/22)) ([a05a976](https://github.com/rohit-purandare/ShelfBridge/commit/a05a976fff37978000561f5b1c69564f76ea69db))
* add missing edition metadata to getBookFromEdition GraphQL query ([27a8147](https://github.com/rohit-purandare/ShelfBridge/commit/27a8147557dd04d819404d201763cbc72720f5c2))
* add missing integer conversion for getBookCurrentProgress userBookId parameter ([2d285f9](https://github.com/rohit-purandare/ShelfBridge/commit/2d285f94d272a7d1dc6cfb2b3810c0d1961bf51b))
* add retry logic for HTTP 5xx server errors in Hardcover client ([9451edc](https://github.com/rohit-purandare/ShelfBridge/commit/9451edcb52ae7f0fe19c08141f3a9d8b2c5e1ba2))
* add secrets inherit to reusable workflow call ([ea16d9a](https://github.com/rohit-purandare/ShelfBridge/commit/ea16d9a2a46cf5fc44ff4cd658d633d7ceddd665))
* add write permissions for version bump workflow ([f4acdc0](https://github.com/rohit-purandare/ShelfBridge/commit/f4acdc0754b9d818a7c1e58ee6a8c6ff6e77aad7))
* apply Docker build optimizations for GLIBC compatibility ([995c41b](https://github.com/rohit-purandare/ShelfBridge/commit/995c41b4d53d9f2de415544eb717567a365eb091))
* centralize progress logic and prevent duplicate completion processing ([edaacb0](https://github.com/rohit-purandare/ShelfBridge/commit/edaacb0585873569ea74739f2c3bb3b0bd03964c))
* change restart policy to on-failure to prevent restart loops during config setup while enabling auto-recovery on sync failures ([82bfdbe](https://github.com/rohit-purandare/ShelfBridge/commit/82bfdbe5c4c9f82f4d56bdc9cc549a15fbcae0b0))
* complete native module compatibility solution ([bd19e3b](https://github.com/rohit-purandare/ShelfBridge/commit/bd19e3bd42f62269dc2adb36d37237bdce41588a))
* correct file path regex patterns in .gitleaks.toml ([997f48d](https://github.com/rohit-purandare/ShelfBridge/commit/997f48dad24da5c160010c47dde5afc8fa2490f9))
* correct Gitleaks action input names for v2 ([d3a52fe](https://github.com/rohit-purandare/ShelfBridge/commit/d3a52fe27c423091857a868c156ed8a4ab79ae7c))
* correct regex syntax in .gitleaks.toml ([f3cc266](https://github.com/rohit-purandare/ShelfBridge/commit/f3cc266ddb95f52a1f2eb8f4122c31b10d63a752))
* correct SARIF file path in security workflow ([3d5cf77](https://github.com/rohit-purandare/ShelfBridge/commit/3d5cf77bad125625823ad1e54835a837daa06ec3))
* critical native module compatibility issue in Docker containers ([bd96c73](https://github.com/rohit-purandare/ShelfBridge/commit/bd96c73a1314344f24af6e5e500954803f0fa7e5))
* Docker optimization with Alpine Linux GLIBC compatibility ([#18](https://github.com/rohit-purandare/ShelfBridge/issues/18)) ([69377d1](https://github.com/rohit-purandare/ShelfBridge/commit/69377d1575dfbacba8d0d0784b2263f7711ecc00))
* eliminate duplicate ISBN/ASIN lookups with combined memoization ([63a45b9](https://github.com/rohit-purandare/ShelfBridge/commit/63a45b900ce9242f9b8f15a330c1c5cb23c5cdfa))
* eliminate duplicate ISBN/ASIN lookups with combined memoization ([e300799](https://github.com/rohit-purandare/ShelfBridge/commit/e300799aac82e186c2a0739d6829c02515496ffd)), closes [#65](https://github.com/rohit-purandare/ShelfBridge/issues/65)
* enable automatic release workflow with gitleaks support ([7c1a88a](https://github.com/rohit-purandare/ShelfBridge/commit/7c1a88a2b198891ecf8204028b4d7ca678451729))
* enable title/author matching when identifiers are missing and improve logging ([e04ba1d](https://github.com/rohit-purandare/ShelfBridge/commit/e04ba1d2168da01f9696e3d463c982367ec97311))
* enable title/author matching when identifiers are missing and improve logging ([5461de8](https://github.com/rohit-purandare/ShelfBridge/commit/5461de8d6b6cc7c0ee0d713da8414025e63ef253))
* ensure book completion operations are atomic ([b09e614](https://github.com/rohit-purandare/ShelfBridge/commit/b09e61480ee1af0c17c76581391c00d489025f0e))
* ensure completion detection runs on every sync ([a2f1b17](https://github.com/rohit-purandare/ShelfBridge/commit/a2f1b178d58c720cc054a7f75dc6beaa1a513791))
* ensure consistent format detection between ProgressManager and sync operations ([21ad020](https://github.com/rohit-purandare/ShelfBridge/commit/21ad020b58ddbf333b0ec77c7e994e08c54d74b5))
* ensure Docker images are built for all releases ([88909ed](https://github.com/rohit-purandare/ShelfBridge/commit/88909eddd286c834d35391eba89f1ae54945084f))
* ensure version tags trigger Docker builds for automatic release targeting ([d6d592a](https://github.com/rohit-purandare/ShelfBridge/commit/d6d592a00fe0e4868dedff2ab2811835f0e3a763))
* first sync detection and force sync override for progress regression protection ([c1a3b1e](https://github.com/rohit-purandare/ShelfBridge/commit/c1a3b1e480289d7927cd863660bb5be4e365edb6))
* GitHub Actions labeler configuration and workflow ([8340ee8](https://github.com/rohit-purandare/ShelfBridge/commit/8340ee895e0683ed781ed9d4c54233b9aecf2cfc))
* implement consistent format detection across all book matching methods ([6c1df62](https://github.com/rohit-purandare/ShelfBridge/commit/6c1df62ff90477303c69880af02c0ecd0c266af7))
* implement multi-key cache lookup for identifier transitions ([80b502c](https://github.com/rohit-purandare/ShelfBridge/commit/80b502c469412e6a7659c5f690182e93bcb7b69f))
* implement static linking for better-sqlite3 to resolve shared object issues ([24068c2](https://github.com/rohit-purandare/ShelfBridge/commit/24068c2e2d3b6f23e7fe3da19cb0a86f33d7d618))
* improve dry-run sync summary display for clarity ([00d831d](https://github.com/rohit-purandare/ShelfBridge/commit/00d831dbc323288c3d64f76c4f18c648a704961f))
* improve interactive mode output and fix CLI reference consistency ([2753154](https://github.com/rohit-purandare/ShelfBridge/commit/275315437c643d7b7f0c12bc2c31e058d3cf96eb))
* improve SARIF upload with proper permissions and error handling ([3aacc80](https://github.com/rohit-purandare/ShelfBridge/commit/3aacc809c0251af6b52c6f600b80d3f9097f81da))
* improve start date handling and reduce log noise ([c889905](https://github.com/rohit-purandare/ShelfBridge/commit/c889905ef5d0493266cd2bd33ee37949c400efe3))
* integrate Docker build into release workflow for automatic version targeting ([c3c15a8](https://github.com/rohit-purandare/ShelfBridge/commit/c3c15a871a2b8fa1a852fb9208a5d1ba93923cd6))
* **logging:** fallback to console-only when logs/ is not writable; avoid EACCES on exception/rejection handlers ([eccb22d](https://github.com/rohit-purandare/ShelfBridge/commit/eccb22d699507163205d2c3d8f0cdfbb09dc7f57))
* **logging:** fully guard all rotating log targets; disable file transports if dir or existing log files are not writable ([36c71d7](https://github.com/rohit-purandare/ShelfBridge/commit/36c71d7c581ba8783835167e9d0bc9766d094a95))
* make scheduled sync the default for Docker and CLI, add interactive mode, update docs for new behavior ([ee8cb77](https://github.com/rohit-purandare/ShelfBridge/commit/ee8cb770e31f43400e6c3eda79b7bd1166430563))
* make version bump skip condition more specific ([9003fca](https://github.com/rohit-purandare/ShelfBridge/commit/9003fcaf96d6bd98830a49326ab1246331fc88ae))
* native module compatibility and comprehensive prevention system ([dc5a334](https://github.com/rohit-purandare/ShelfBridge/commit/dc5a334989eafec7ea87e2e603d090bb1563fb72))
* preserve existing start dates and fix edition format detection ([c6a8d9d](https://github.com/rohit-purandare/ShelfBridge/commit/c6a8d9dd7581faf773da8e0cda7c99de98871e31))
* prevent auto-add when progress below min_progress_threshold ([0cb2fc5](https://github.com/rohit-purandare/ShelfBridge/commit/0cb2fc53f8403a6320ad551a23b78efac7063f3d))
* prevent endless restart loop when configuration is invalid ([1f70f74](https://github.com/rohit-purandare/ShelfBridge/commit/1f70f7460d5028bd920f89fa3b60807b98d1ad9b))
* prevent restart loops during configuration setup ([8007090](https://github.com/rohit-purandare/ShelfBridge/commit/80070906557f8109dd969bac04d4b42e153744c6))
* prevent undefined property access errors in title/author matching ([b22ad5c](https://github.com/rohit-purandare/ShelfBridge/commit/b22ad5c6e8dafb668e389a46fe7aa2fcf38927ff))
* reduce log verbosity for book matching success messages ([6a11e04](https://github.com/rohit-purandare/ShelfBridge/commit/6a11e04db24537311e0a24c89ad062464b82612a))
* remove config validation from CI workflow ([ee50589](https://github.com/rohit-purandare/ShelfBridge/commit/ee5058900229a93f853c181f52f263920b9abdae))
* remove npm cache mount that was preserving glibc binaries ([927a54a](https://github.com/rohit-purandare/ShelfBridge/commit/927a54a56c731f12ababd98a30811e8f08726ac6))
* Remove unsupported update-type from allow section in Dependabot config ([36872fd](https://github.com/rohit-purandare/ShelfBridge/commit/36872fd5cc91b63a4f22b2484a9a1a58479189d0))
* Remove user override from docker-compose.yml to fix permission issues ([b8f7673](https://github.com/rohit-purandare/ShelfBridge/commit/b8f7673cb17b40d151c4d3478ca372be060c5077))
* resolve author extraction object handling in matching module ([deaf6cb](https://github.com/rohit-purandare/ShelfBridge/commit/deaf6cb15a1d6e7b77ff5d6250d51ae59de001f5))
* resolve better-sqlite3 native module compatibility issues permanently ([bf676c6](https://github.com/rohit-purandare/ShelfBridge/commit/bf676c6f0fa23c921f9f352da901f9fd9e50f063))
* resolve better-sqlite3 native module glibc/musl compatibility issue ([9c02f79](https://github.com/rohit-purandare/ShelfBridge/commit/9c02f798691f52417cd52f518e042dd8381c775a))
* resolve cache logic bug and dry-run display inconsistency ([0604593](https://github.com/rohit-purandare/ShelfBridge/commit/06045934532d2cb99d0a5cf0d23d263d920034a7))
* resolve config.yaml auto-creation blocking environment variables ([#20](https://github.com/rohit-purandare/ShelfBridge/issues/20)) ([2a6e843](https://github.com/rohit-purandare/ShelfBridge/commit/2a6e843d9ff02a3d3e340f946af021e78f5551c3))
* resolve critical GLIBC compatibility issue with better-sqlite3 ([82d0460](https://github.com/rohit-purandare/ShelfBridge/commit/82d0460d51e156886a50824b748ab67ff9b972aa))
* resolve critical security vulnerability in form-data package ([8486c63](https://github.com/rohit-purandare/ShelfBridge/commit/8486c630f5e0055a792a5203fcdf89446dff05aa))
* resolve ESLint no-case-declarations errors in cache management switch ([cbdc248](https://github.com/rohit-purandare/ShelfBridge/commit/cbdc24850f52feba05acde28965faf74ff063075))
* resolve GLIBC compatibility with Alpine Linux base ([27719eb](https://github.com/rohit-purandare/ShelfBridge/commit/27719ebc794bfda8a669725894558dafad2fba44))
* resolve MaxListenersExceededWarning for AbortSignal in parallel operations ([2b29057](https://github.com/rohit-purandare/ShelfBridge/commit/2b290578140d1efed15acc214e86e076b8154d9f))
* resolve rate limiting issues with shared buckets ([f990163](https://github.com/rohit-purandare/ShelfBridge/commit/f990163cd00579c0a67316837fa8c54e887d5e80))
* resolve title/author matching null reference and GraphQL type errors ([7fbcefb](https://github.com/rohit-purandare/ShelfBridge/commit/7fbcefb45d1d9ff33b4c598e39d08a05d4330651))
* resolve undefined variables in debug function ([9a6cfe1](https://github.com/rohit-purandare/ShelfBridge/commit/9a6cfe178a937652589f4a8e20e6b962a157a9ef))
* revert labeler config to simple array format for actions/labeler@v5 ([469866d](https://github.com/rohit-purandare/ShelfBridge/commit/469866d09c73b1e6b9f0bb840cdd3acac1f96b8b))
* skip pre-commit hooks for automated version bump commits ([90d50b4](https://github.com/rohit-purandare/ShelfBridge/commit/90d50b49177a41f03a39c12bd21c1e697c39c9fe))
* **sync:** always send started_at to Hardcover; correct timezone date formatting ([bb04720](https://github.com/rohit-purandare/ShelfBridge/commit/bb04720031c4a2d741a6d591ac756d7ebc7a4e37))
* test automatic release workflow with token ([098a046](https://github.com/rohit-purandare/ShelfBridge/commit/098a0468b0937ac232c590ad52abd46b210c3b8b))
* update labeler configuration for actions/labeler@v5 compatibility ([4e43a2c](https://github.com/rohit-purandare/ShelfBridge/commit/4e43a2c3877b842b356fc6de9b03129a649ff2d2))
* update labeler configuration to use correct format for actions/labeler@v5 ([345fe81](https://github.com/rohit-purandare/ShelfBridge/commit/345fe81f8c64d6ab52e458e5b4b222f9b87d1aa2))
* update npm test script to explicitly list test files ([761202d](https://github.com/rohit-purandare/ShelfBridge/commit/761202d6e45644764e5795672b9f870700c068e6))
* update README to remove obsolete information and fix version inconsistencies ([3ea7673](https://github.com/rohit-purandare/ShelfBridge/commit/3ea7673d6422761050a0494e4a8b263dfbc6bb12))
* upgrade release workflow with proper permissions and modern action ([cb1e216](https://github.com/rohit-purandare/ShelfBridge/commit/cb1e216412c09fe2db5642bd71fae545e4e42c9a))
* use bash instead of sh in pre-commit hook for array syntax ([73e8517](https://github.com/rohit-purandare/ShelfBridge/commit/73e85175a45d366bfc2a03e5bd84e4ec52944562))
* use lowercase registry cache reference for Docker compatibility ([ac9b812](https://github.com/rohit-purandare/ShelfBridge/commit/ac9b81252595f472ba4967f826c80a53c073d321))


### ## ♻️ Code Refactoring

* centralize progress change detection and regression analysis ([7a49e88](https://github.com/rohit-purandare/ShelfBridge/commit/7a49e88570828150bd71c1084d539c6c8455a94b))
* complete function separation and eliminate duplicate matching logic ([e490792](https://github.com/rohit-purandare/ShelfBridge/commit/e4907927fe15b826d8c4b27828c186810b19c2be))
* comprehensive author contributions system enhancement ([a4054ca](https://github.com/rohit-purandare/ShelfBridge/commit/a4054cac7d40d100a6af9e6335c330dc7c9e0202))
* extract book matching into modular architecture ([58c7d8b](https://github.com/rohit-purandare/ShelfBridge/commit/58c7d8b3ed543d657e8449a5954b696d9a3eca01))
* extract utilities into focused modules and fix force sync issues ([1474b82](https://github.com/rohit-purandare/ShelfBridge/commit/1474b8277efe3ad6c3f1db69fc997008be849b41))
* standardize logging key to user_id for consistent structured logging ([fd1f919](https://github.com/rohit-purandare/ShelfBridge/commit/fd1f9192e2e264b10423b22b0f828257c4941836))

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

## [1.18.21] - 2025-07-26

### Fixed
- 🔧 **Critical GLIBC Compatibility Fix**: Resolved `GLIBC_2.38` dependency issue
  - Switched from `node:20-slim` to `node:20-alpine` base image
  - Eliminates GLIBC version conflicts preventing container startup
  - Ensures better-sqlite3 native module compatibility across all systems
- 🚀 **Docker Image Optimization**: Reduced image size from ~650MB to ~530MB
  - Multi-stage Alpine builds with optimized cache strategy  
  - Enhanced CI/CD pipeline with comprehensive testing
  - Improved reliability for ARM64 and AMD64 platforms
- 🛠️ **Workflow Improvements**: Enhanced release automation and testing
  - Added gitleaks security scanning to CI pipelines
  - Fixed pre-commit hook compatibility issues
  - Implemented robust Docker build timeout handling

### Technical Details
- **Base Image**: Now uses `node:20-alpine` for better compatibility
- **Build Process**: better-sqlite3 compiled from source for musl libc
- **Testing**: Comprehensive native module validation in CI
- **Platforms**: Full support for linux/amd64 and linux/arm64

This release resolves the critical container startup failures reported by users.

# Changelog

All notable changes to ShelfBridge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
