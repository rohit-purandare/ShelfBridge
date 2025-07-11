import cron from 'node-cron';
import { DateTime } from 'luxon';
import logger from './logger.js';

export class ConfigValidator {
    constructor() {
        this.schema = {
            global: {
                min_progress_threshold: { 
                    type: 'number', 
                    min: 0, 
                    max: 100, 
                    default: 5.0,
                    description: 'Minimum progress percentage to sync (0-100)'
                },
                parallel: { 
                    type: 'boolean', 
                    default: true,
                    description: 'Enable parallel processing'
                },
                workers: { 
                    type: 'number', 
                    min: 1, 
                    max: 10, 
                    default: 3,
                    description: 'Number of parallel workers (1-10)'
                },
                dry_run: { 
                    type: 'boolean', 
                    default: false,
                    description: 'Run in dry-run mode without making changes'
                },
                sync_schedule: { 
                    type: 'string', 
                    validate: 'cronSchedule',
                    optional: true,
                    description: 'Cron schedule for automatic sync (e.g., "0 3 * * *")'
                },
                timezone: { 
                    type: 'string', 
                    validate: 'timezone',
                    default: 'UTC',
                    description: 'Timezone for scheduling and timestamps'
                },
                force_sync: {
                    type: 'boolean',
                    default: false,
                    optional: true,
                    description: 'Force sync even if progress unchanged'
                },
                auto_add_books: {
                    type: 'boolean',
                    default: false,
                    optional: true,
                    description: 'Automatically add books to Hardcover if not found'
                },
                prevent_progress_regression: {
                    type: 'boolean',
                    default: true,
                    optional: true,
                    description: 'Prevent accidentally overwriting completion status or high progress'
                },
                reread_detection: {
                    type: 'object',
                    optional: true,
                    description: 'Controls when new reading sessions are created vs updating existing ones',
                    properties: {
                        reread_threshold: {
                            type: 'number',
                            min: 0,
                            max: 100,
                            default: 30,
                            description: 'Progress below this % is considered "starting over" (0-100)'
                        },
                        high_progress_threshold: {
                            type: 'number',
                            min: 0,
                            max: 100,
                            default: 85,
                            description: 'Progress above this % is considered "high progress" (0-100)'
                        },
                        regression_block_threshold: {
                            type: 'number',
                            min: 0,
                            max: 100,
                            default: 50,
                            description: 'Block progress drops larger than this % from high progress (0-100)'
                        },
                        regression_warn_threshold: {
                            type: 'number',
                            min: 0,
                            max: 100,
                            default: 15,
                            description: 'Warn about progress drops larger than this % from high progress (0-100)'
                        }
                    }
                }
            },
            users: {
                type: 'array',
                minItems: 1,
                description: 'List of user configurations',
                items: {
                    id: { 
                        type: 'string', 
                        required: true,
                        minLength: 1,
                        description: 'Unique user identifier'
                    },
                    abs_url: { 
                        type: 'string', 
                        required: true, 
                        validate: 'url',
                        description: 'Audiobookshelf server URL'
                    },
                    abs_token: { 
                        type: 'string', 
                        required: true, 
                        minLength: 10,
                        description: 'Audiobookshelf API token'
                    },
                    hardcover_token: { 
                        type: 'string', 
                        required: true, 
                        minLength: 10,
                        description: 'Hardcover API token'
                    }
                }
            }
        };
    }

    /**
     * Validate complete configuration
     */
    async validateConfiguration(config) {
        const errors = [];
        const warnings = [];

        try {
            // Validate global configuration
            const globalConfig = config.getGlobal();
            const globalErrors = this.validateGlobalConfig(globalConfig);
            errors.push(...globalErrors);

            // Validate users configuration
            const users = config.getUsers();
            const userErrors = this.validateUsers(users);
            errors.push(...userErrors);

            // Check for duplicate user IDs
            const duplicateErrors = this.checkDuplicateUserIds(users);
            errors.push(...duplicateErrors);

            return {
                valid: errors.length === 0,
                errors,
                warnings
            };
        } catch (error) {
            errors.push(`Configuration validation failed: ${error.message}`);
            return {
                valid: false,
                errors,
                warnings
            };
        }
    }

    /**
     * Validate global configuration section
     */
    validateGlobalConfig(globalConfig) {
        const errors = [];
        const schema = this.schema.global;

        for (const [key, rules] of Object.entries(schema)) {
            const value = globalConfig[key];

            // Check required fields
            if (rules.required && (value === undefined || value === null)) {
                errors.push(`Global config: '${key}' is required`);
                continue;
            }

            // Skip validation for optional undefined values
            if (rules.optional && (value === undefined || value === null)) {
                continue;
            }

            // Use default if value is undefined
            const actualValue = value !== undefined ? value : rules.default;

            // Type validation
            if (rules.type && actualValue !== undefined) {
                const typeError = this.validateType(key, actualValue, rules.type);
                if (typeError) {
                    errors.push(`Global config: ${typeError}`);
                    continue;
                }
            }

            // Range validation for numbers
            if (rules.type === 'number' && actualValue !== undefined) {
                if (rules.min !== undefined && actualValue < rules.min) {
                    errors.push(`Global config: '${key}' must be at least ${rules.min} (got: ${actualValue})`);
                }
                if (rules.max !== undefined && actualValue > rules.max) {
                    errors.push(`Global config: '${key}' must be at most ${rules.max} (got: ${actualValue})`);
                }
            }

            // String length validation
            if (rules.type === 'string' && actualValue !== undefined) {
                if (rules.minLength !== undefined && actualValue.length < rules.minLength) {
                    errors.push(`Global config: '${key}' must be at least ${rules.minLength} characters (got: ${actualValue.length})`);
                }
            }

            // Object validation (for nested objects like reread_detection)
            if (rules.type === 'object' && actualValue !== undefined) {
                const objectErrors = this.validateObjectProperties(key, actualValue, rules.properties);
                errors.push(...objectErrors.map(error => `Global config: ${error}`));
            }

            // Custom validation
            if (rules.validate && actualValue !== undefined) {
                const customError = this.validateCustom(key, actualValue, rules.validate);
                if (customError) {
                    errors.push(`Global config: ${customError}`);
                }
            }
        }

        return errors;
    }

    /**
     * Validate users configuration section
     */
    validateUsers(users) {
        const errors = [];
        const schema = this.schema.users;

        // Check if users is an array
        if (!Array.isArray(users)) {
            errors.push("Users configuration must be an array");
            return errors;
        }

        // Check minimum items
        if (schema.minItems && users.length < schema.minItems) {
            errors.push(`Users configuration must have at least ${schema.minItems} user(s) (got: ${users.length})`);
        }

        // Validate each user
        users.forEach((user, index) => {
            const userErrors = this.validateUser(user, index);
            errors.push(...userErrors);
        });

        return errors;
    }

    /**
     * Validate individual user configuration
     */
    validateUser(user, index) {
        const errors = [];
        const schema = this.schema.users.items;

        if (typeof user !== 'object' || user === null) {
            errors.push(`User ${index}: Must be an object`);
            return errors;
        }

        for (const [key, rules] of Object.entries(schema)) {
            const value = user[key];

            // Check required fields
            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push(`User ${index}: '${key}' is required`);
                continue;
            }

            // Skip validation for optional undefined values
            if (rules.optional && (value === undefined || value === null)) {
                continue;
            }

            // Type validation
            if (rules.type && value !== undefined) {
                const typeError = this.validateType(`User ${index}.${key}`, value, rules.type);
                if (typeError) {
                    errors.push(typeError);
                    continue;
                }
            }

            // String length validation
            if (rules.type === 'string' && value !== undefined) {
                if (rules.minLength !== undefined && value.length < rules.minLength) {
                    errors.push(`User ${index}: '${key}' must be at least ${rules.minLength} characters (got: ${value.length})`);
                }
            }

            // Custom validation
            if (rules.validate && value !== undefined) {
                const customError = this.validateCustom(`User ${index}.${key}`, value, rules.validate);
                if (customError) {
                    errors.push(customError);
                }
            }
        }

        return errors;
    }

    /**
     * Check for duplicate user IDs
     */
    checkDuplicateUserIds(users) {
        const errors = [];
        const userIds = new Set();

        users.forEach((user, index) => {
            if (user.id) {
                if (userIds.has(user.id)) {
                    errors.push(`Duplicate user ID '${user.id}' found at index ${index}`);
                } else {
                    userIds.add(user.id);
                }
            }
        });

        return errors;
    }

    /**
     * Validate data type
     */
    validateType(fieldName, value, expectedType) {
        const actualType = typeof value;
        
        if (expectedType === 'array' && !Array.isArray(value)) {
            return `'${fieldName}' must be an array (got: ${actualType})`;
        }
        
        if (expectedType !== 'array' && actualType !== expectedType) {
            return `'${fieldName}' must be ${expectedType} (got: ${actualType})`;
        }
        
        return null;
    }

    /**
     * Validate object properties for nested objects
     */
    validateObjectProperties(parentKey, obj, propertiesSchema) {
        const errors = [];

        if (!propertiesSchema) {
            return errors;
        }

        // Check if the value is actually an object
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
            errors.push(`'${parentKey}' must be an object (got: ${typeof obj})`);
            return errors;
        }

        // Validate each property in the schema
        for (const [propKey, propRules] of Object.entries(propertiesSchema)) {
            const propValue = obj[propKey];
            const fullKey = `${parentKey}.${propKey}`;

            // Check required fields
            if (propRules.required && (propValue === undefined || propValue === null)) {
                errors.push(`'${fullKey}' is required`);
                continue;
            }

            // Skip validation for optional undefined values
            if (propRules.optional && (propValue === undefined || propValue === null)) {
                continue;
            }

            // Use default if value is undefined
            const actualValue = propValue !== undefined ? propValue : propRules.default;

            // Type validation
            if (propRules.type && actualValue !== undefined) {
                const typeError = this.validateType(fullKey, actualValue, propRules.type);
                if (typeError) {
                    errors.push(typeError);
                    continue;
                }
            }

            // Range validation for numbers
            if (propRules.type === 'number' && actualValue !== undefined) {
                if (propRules.min !== undefined && actualValue < propRules.min) {
                    errors.push(`'${fullKey}' must be at least ${propRules.min} (got: ${actualValue})`);
                }
                if (propRules.max !== undefined && actualValue > propRules.max) {
                    errors.push(`'${fullKey}' must be at most ${propRules.max} (got: ${actualValue})`);
                }
            }

            // String length validation
            if (propRules.type === 'string' && actualValue !== undefined) {
                if (propRules.minLength !== undefined && actualValue.length < propRules.minLength) {
                    errors.push(`'${fullKey}' must be at least ${propRules.minLength} characters (got: ${actualValue.length})`);
                }
            }

            // Custom validation
            if (propRules.validate && actualValue !== undefined) {
                const customError = this.validateCustom(fullKey, actualValue, propRules.validate);
                if (customError) {
                    errors.push(customError);
                }
            }
        }

        return errors;
    }

    /**
     * Custom validation functions
     */
    validateCustom(fieldName, value, validationType) {
        switch (validationType) {
            case 'url':
                return this.validateUrl(fieldName, value);
            case 'timezone':
                return this.validateTimezone(fieldName, value);
            case 'cronSchedule':
                return this.validateCronSchedule(fieldName, value);
            default:
                return `Unknown validation type: ${validationType}`;
        }
    }

    /**
     * Validate URL format
     */
    validateUrl(fieldName, url) {
        try {
            const urlObj = new URL(url);
            
            // Check for valid protocols
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                return `'${fieldName}' must use http or https protocol (got: ${urlObj.protocol})`;
            }
            
            // Check for valid hostname
            if (!urlObj.hostname) {
                return `'${fieldName}' must have a valid hostname`;
            }
            
            return null;
        } catch (error) {
            return `'${fieldName}' must be a valid URL (${error.message})`;
        }
    }

    /**
     * Validate timezone
     */
    validateTimezone(fieldName, timezone) {
        try {
            // Test timezone by creating a DateTime object
            DateTime.now().setZone(timezone);
            return null;
        } catch (error) {
            return `'${fieldName}' must be a valid timezone (got: '${timezone}')`;
        }
    }

    /**
     * Validate cron schedule
     */
    validateCronSchedule(fieldName, schedule) {
        try {
            if (!cron.validate(schedule)) {
                return `'${fieldName}' must be a valid cron expression (got: '${schedule}')`;
            }
            return null;
        } catch (error) {
            return `'${fieldName}' must be a valid cron expression (${error.message})`;
        }
    }

    /**
     * Test API connections (optional)
     */
    async testConnections(users) {
        const errors = [];
        
        for (const [index, user] of users.entries()) {
            if (!user.id || !user.abs_url || !user.abs_token || !user.hardcover_token) {
                continue; // Skip users with missing required fields (already validated)
            }

            try {
                // Test Audiobookshelf connection
                const { AudiobookshelfClient } = await import('./audiobookshelf-client.js');
                const absClient = new AudiobookshelfClient(user.abs_url, user.abs_token);
                const absConnected = await absClient.testConnection();
                
                if (!absConnected) {
                    errors.push(`User ${index} (${user.id}): Audiobookshelf connection failed`);
                }
            } catch (error) {
                errors.push(`User ${index} (${user.id}): Audiobookshelf connection error - ${error.message}`);
            }

            try {
                // Test Hardcover connection
                const { HardcoverClient } = await import('./hardcover-client.js');
                const hcClient = new HardcoverClient(user.hardcover_token);
                const hcConnected = await hcClient.testConnection();
                
                if (!hcConnected) {
                    errors.push(`User ${index} (${user.id}): Hardcover connection failed`);
                }
            } catch (error) {
                errors.push(`User ${index} (${user.id}): Hardcover connection error - ${error.message}`);
            }
        }

        return errors;
    }

    /**
     * Generate configuration help text
     */
    generateHelpText() {
        let help = "Configuration Schema:\n\n";
        
        help += "Global Configuration:\n";
        for (const [key, rules] of Object.entries(this.schema.global)) {
            help += `  ${key}: ${rules.description}\n`;
            help += `    Type: ${rules.type}`;
            if (rules.min !== undefined) help += `, Min: ${rules.min}`;
            if (rules.max !== undefined) help += `, Max: ${rules.max}`;
            if (rules.default !== undefined) help += `, Default: ${rules.default}`;
            if (rules.required) help += `, Required`;
            if (rules.optional) help += `, Optional`;
            help += "\n";

            // Handle nested object properties
            if (rules.type === 'object' && rules.properties) {
                help += `    Properties:\n`;
                for (const [propKey, propRules] of Object.entries(rules.properties)) {
                    help += `      ${propKey}: ${propRules.description}\n`;
                    help += `        Type: ${propRules.type}`;
                    if (propRules.min !== undefined) help += `, Min: ${propRules.min}`;
                    if (propRules.max !== undefined) help += `, Max: ${propRules.max}`;
                    if (propRules.default !== undefined) help += `, Default: ${propRules.default}`;
                    if (propRules.required) help += `, Required`;
                    if (propRules.optional) help += `, Optional`;
                    help += "\n";
                }
            }
            help += "\n";
        }

        help += "User Configuration:\n";
        for (const [key, rules] of Object.entries(this.schema.users.items)) {
            help += `  ${key}: ${rules.description}\n`;
            help += `    Type: ${rules.type}`;
            if (rules.minLength !== undefined) help += `, Min Length: ${rules.minLength}`;
            if (rules.required) help += `, Required`;
            help += "\n\n";
        }

        return help;
    }

    /**
     * Format validation errors for display
     */
    formatErrors(validationResult) {
        if (validationResult.valid) {
            return "✅ Configuration is valid";
        }

        let output = "❌ Configuration Validation Failed:\n\n";
        
        validationResult.errors.forEach(error => {
            output += `  ✗ ${error}\n`;
        });

        if (validationResult.warnings.length > 0) {
            output += "\nWarnings:\n";
            validationResult.warnings.forEach(warning => {
                output += `  ⚠ ${warning}\n`;
            });
        }

        output += "\nFix these issues and restart the application.\n";
        return output;
    }
} 