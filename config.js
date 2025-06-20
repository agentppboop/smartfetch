// config.js - Configuration management system

const fs = require('fs');
const path = require('path');

class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, 'smartfetch-config.json');
        this.defaultConfig = {
            youtube: {
                apiKey: process.env.YOUTUBE_API_KEY || '',
                quotaLimit: 10000,
                requestDelay: 100
            },
            extraction: {
                confidenceThreshold: 0.6,
                enableNLPFallback: true,
                maxTextLength: 50000
            },
            linkDomains: {
                whitelist: [],
                blacklist: ['spam.com', 'malicious.site']
            },
            notifications: {
                enabled: false,
                webhook: '',
                emailSettings: {
                    enabled: false,
                    smtp: {
                        host: '',
                        port: 587,
                        secure: false,
                        auth: {
                            user: '',
                            pass: ''
                        }
                    },
                    from: '',
                    to: []
                }
            }
        };
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const configData = fs.readFileSync(this.configPath, 'utf-8');
                const loadedConfig = JSON.parse(configData);
                return this.mergeDeep(this.defaultConfig, loadedConfig);
            }
            return { ...this.defaultConfig };
        } catch (error) {
            console.warn(`⚠️ Error loading config: ${error.message}. Using defaults.`);
            this.saveConfig(this.defaultConfig);
            return { ...this.defaultConfig };
        }
    }

    saveConfig(config) {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
            console.log('✅ Configuration saved successfully');
        } catch (error) {
            console.error(`❌ Error saving config: ${error.message}`);
        }
    }

    mergeDeep(target, source) {
        const output = Object.assign({}, target);
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target))
                        Object.assign(output, { [key]: source[key] });
                    else
                        output[key] = this.mergeDeep(target[key], source[key]);
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        return output;
    }

    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }
}

module.exports = new ConfigManager();
