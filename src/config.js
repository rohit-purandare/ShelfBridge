import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

export class Config {
    constructor(configPath = 'config/config.yaml') {
        this.configPath = configPath;
        this.globalConfig = {};
        this.users = [];
        this._loadConfig();
        this._validateConfig();
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
            
            console.log(`Loaded configuration from ${this.configPath}`);
        } catch (error) {
            throw new Error(`Failed to load config file: ${error.message}`);
        }
    }

    _validateConfig() {
        const errors = [];
        
        // Validate global config
        const requiredGlobals = [
            'min_progress_threshold',
            'parallel',
            'workers',
            'dry_run',
            'sync_schedule',
            'timezone'
        ];
        
        for (const key of requiredGlobals) {
            if (!(key in this.globalConfig)) {
                errors.push(`Missing global config: ${key}`);
            }
        }
        
        // Validate users
        if (!this.users || this.users.length === 0) {
            errors.push('No users defined in config');
        }
        
        for (const user of this.users) {
            const requiredUserFields = ['id', 'abs_url', 'abs_token', 'hardcover_token'];
            for (const key of requiredUserFields) {
                if (!user[key]) {
                    errors.push(`Missing user config: ${key} for user ${user.id || '[unknown]'}`);
                }
            }
        }
        
        if (errors.length > 0) {
            const errorMsg = 'Configuration validation failed:\n' + errors.map(error => `- ${error}`).join('\n');
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        
        console.log('Configuration validation passed');
    }

    getGlobal() {
        return this.globalConfig;
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