import fs from 'fs';
import yaml from 'js-yaml';
import logger from './logger.js';

export class Config {
    constructor(configPath = 'config/config.yaml') {
        this.configPath = configPath;
        this.globalConfig = {};
        this.users = [];
        this._loadConfig();
        this._applyDefaults();
        // Validation is now handled by ConfigValidator class
    }

    _loadConfig() {
        if (!fs.existsSync(this.configPath)) {
            throw new Error(`Config file not found: ${this.configPath}`);
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