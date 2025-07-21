import fs from 'fs';
import yaml from 'js-yaml';
import logger from './logger.js';

export class Config {
    constructor(configPath = 'config/config.yaml') {
        this.configPath = configPath;
        this.globalConfig = {};
        this.users = [];
        this._loadConfig();
        this._loadFromEnvironment();
        this._applyDefaults();
        // Validation is now handled by ConfigValidator class
    }

    _loadConfig() {
        if (!fs.existsSync(this.configPath)) {
            // If config file doesn't exist, initialize empty config
            // Environment variables will be loaded next
            logger.warn(`Config file not found: ${this.configPath}, will use environment variables and defaults`);
            this.globalConfig = {};
            this.users = [];
            return;
        }

        try {
            const configFile = fs.readFileSync(this.configPath, 'utf8');
            const config = yaml.load(configFile);
            
            this.globalConfig = config.global || {};
            this.users = config.users || [];
            
            logger.debug(`Loaded configuration from ${this.configPath}`);
        } catch (error) {
            throw new Error(`Failed to load config file: ${error.message}`);
        }
    }

    _loadFromEnvironment() {
        logger.debug('Loading environment variables...');
        
        // Load global config from environment variables
        this._loadGlobalFromEnvironment();
        
        // Load users from environment variables
        this._loadUsersFromEnvironment();
        
        logger.debug('Environment variable loading completed');
    }

    _loadGlobalFromEnvironment() {
        const envMapping = {
            'MIN_PROGRESS_THRESHOLD': 'min_progress_threshold',
            'PARALLEL': 'parallel',
            'WORKERS': 'workers',
            'TIMEZONE': 'timezone',
            'DRY_RUN': 'dry_run',
            'SYNC_SCHEDULE': 'sync_schedule',
            'FORCE_SYNC': 'force_sync',
            'AUTO_ADD_BOOKS': 'auto_add_books',
            'PREVENT_PROGRESS_REGRESSION': 'prevent_progress_regression',
            'MAX_BOOKS_TO_PROCESS': 'max_books_to_process',
            'HARDCOVER_SEMAPHORE': 'hardcover_semaphore',
            'HARDCOVER_RATE_LIMIT': 'hardcover_rate_limit',
            'AUDIOBOOKSHELF_SEMAPHORE': 'audiobookshelf_semaphore',
            'AUDIOBOOKSHELF_RATE_LIMIT': 'audiobookshelf_rate_limit',
            'MAX_BOOKS_TO_FETCH': 'max_books_to_fetch',
            'PAGE_SIZE': 'page_size',
            'DEEP_SCAN_INTERVAL': 'deep_scan_interval',
            'DUMP_FAILED_BOOKS': 'dump_failed_books'
        };

        for (const [envKey, configKey] of Object.entries(envMapping)) {
            const envVar = `SHELFBRIDGE_${envKey}`;
            const envValue = process.env[envVar];
            
            // Only set from environment if not already set in YAML config
            if (envValue !== undefined && this.globalConfig[configKey] === undefined) {
                const parsedValue = this._parseEnvironmentValue(envValue, configKey);
                if (parsedValue !== null) {
                    this.globalConfig[configKey] = parsedValue;
                    logger.debug(`Set ${configKey} from environment variable ${envVar}: ${parsedValue}`);
                }
            }
        }
    }

    _loadUsersFromEnvironment() {
        // Find all user environment variables by scanning for SHELFBRIDGE_USER_* patterns
        const userEnvVars = {};
        
        for (const [key, value] of Object.entries(process.env)) {
            const match = key.match(/^SHELFBRIDGE_USER_(\d+)_(.+)$/);
            if (match) {
                const userIndex = parseInt(match[1]);
                const userProperty = match[2].toLowerCase();
                
                if (!userEnvVars[userIndex]) {
                    userEnvVars[userIndex] = {};
                }
                userEnvVars[userIndex][userProperty] = value;
            }
        }

        // Create users from environment variables if not already defined in YAML
        const maxUserIndex = Math.max(-1, ...Object.keys(userEnvVars).map(i => parseInt(i)));
        
        for (let i = 0; i <= maxUserIndex; i++) {
            const envUser = userEnvVars[i];
            if (!envUser) continue;

            // Check if user already exists in YAML config
            if (this.users[i]) {
                // User exists in YAML, only fill in missing properties from environment
                for (const [envKey, envValue] of Object.entries(envUser)) {
                    const configKey = this._mapUserEnvironmentKey(envKey);
                    if (configKey && this.users[i][configKey] === undefined) {
                        const parsedValue = this._parseEnvironmentValue(envValue, configKey);
                        if (parsedValue !== null) {
                            this.users[i][configKey] = parsedValue;
                            logger.debug(`Set user ${i} ${configKey} from environment: ${configKey === 'abs_token' || configKey === 'hardcover_token' ? '[REDACTED]' : parsedValue}`);
                        }
                    }
                }
            } else {
                // User doesn't exist in YAML, create from environment
                const newUser = {};
                for (const [envKey, envValue] of Object.entries(envUser)) {
                    const configKey = this._mapUserEnvironmentKey(envKey);
                    if (configKey) {
                        const parsedValue = this._parseEnvironmentValue(envValue, configKey);
                        if (parsedValue !== null) {
                            newUser[configKey] = parsedValue;
                        }
                    }
                }

                // Only add user if required fields are present
                if (newUser.id && newUser.abs_url && newUser.abs_token && newUser.hardcover_token) {
                    // Ensure users array is large enough
                    while (this.users.length <= i) {
                        this.users.push(null);
                    }
                    this.users[i] = newUser;
                    logger.debug(`Created user ${i} from environment variables: ${newUser.id}`);
                }
            }
        }

        // Remove null entries from users array
        this.users = this.users.filter(user => user !== null);
    }

    _mapUserEnvironmentKey(envKey) {
        const mapping = {
            'id': 'id',
            'abs_url': 'abs_url',
            'abs_token': 'abs_token',
            'hardcover_token': 'hardcover_token'
        };
        return mapping[envKey] || null;
    }

    _parseEnvironmentValue(value, configKey) {
        if (value === undefined || value === '') {
            return null;
        }

        // Parse based on expected type for the config key
        const booleanKeys = ['parallel', 'dry_run', 'force_sync', 'auto_add_books', 'prevent_progress_regression', 'dump_failed_books'];
        const numberKeys = ['min_progress_threshold', 'workers', 'max_books_to_process', 'hardcover_semaphore', 
                           'hardcover_rate_limit', 'audiobookshelf_semaphore', 'audiobookshelf_rate_limit', 
                           'max_books_to_fetch', 'page_size', 'deep_scan_interval'];

        if (booleanKeys.includes(configKey)) {
            return value.toLowerCase() === 'true' || value === '1';
        } else if (numberKeys.includes(configKey)) {
            const parsed = parseFloat(value);
            return isNaN(parsed) ? null : parsed;
        } else {
            return value;
        }
    }

    _applyDefaults() {
        // Apply sensible defaults for optional global settings
        // These match the defaults defined in config-validator.js
        const defaults = {
            min_progress_threshold: 5.0,
            parallel: true,
            workers: 3,
            timezone: "UTC",
            dry_run: false,
            sync_schedule: "0 3 * * *",
            force_sync: false,
            auto_add_books: false,
            prevent_progress_regression: true,
            audiobookshelf_semaphore: 5,
            hardcover_semaphore: 1,
            deep_scan_interval: 10,
            dump_failed_books: true
        };

        // Track which values were explicitly set vs using defaults
        this.explicitlySet = new Set();

        // Apply defaults only for undefined values
        for (const [key, defaultValue] of Object.entries(defaults)) {
            if (this.globalConfig[key] === undefined) {
                this.globalConfig[key] = defaultValue;
                logger.debug(`Applied default for ${key}: ${defaultValue}`);
            } else {
                // Mark as explicitly set
                this.explicitlySet.add(key);
                logger.debug(`Using explicit value for ${key}: ${this.globalConfig[key]}`);
            }
        }
        
        // Handle special cases for settings not in defaults
        if (this.globalConfig.max_books_to_process !== undefined) {
            this.explicitlySet.add('max_books_to_process');
            logger.debug(`Using explicit value for max_books_to_process: ${this.globalConfig.max_books_to_process}`);
        }
        if (this.globalConfig.max_books_to_fetch !== undefined) {
            this.explicitlySet.add('max_books_to_fetch');
            logger.debug(`Using explicit value for max_books_to_fetch: ${this.globalConfig.max_books_to_fetch}`);
        }
        if (this.globalConfig.page_size !== undefined) {
            this.explicitlySet.add('page_size');
            logger.debug(`Using explicit value for page_size: ${this.globalConfig.page_size}`);
        }
    }



    getGlobal() {
        return this.globalConfig;
    }

    isExplicitlySet(key) {
        return this.explicitlySet.has(key);
    }

    getUsers() {
        return this.users;
    }

    getUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) {
            throw new Error(`User not found: ${userId}`);
        }
        return user;
    }

    getCronConfig() {
        return {
            schedule: this.globalConfig.sync_schedule || '0 3 * * *',
            timezone: this.globalConfig.timezone || 'Etc/UTC'
        };
    }

    toString() {
        const usersStr = this.users.map(user => user.id).join(', ');
        return `Config: users=[${usersStr}], global=${JSON.stringify(this.globalConfig)}`;
    }
} 