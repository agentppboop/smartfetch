// config.js - Configuration management system
const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor(configPath = './config.json') {
    this.configPath = configPath;
    this.defaultConfig = {
      // Extraction settings
      extraction: {
        intervalHours: 6,
        maxRetries: 3,
        retryDelayMs: 1000,
        apiRateLimitMs: 100,
        minCodeLength: 3,
        maxCodeLength: 20,
        minLinkLength: 10
      },
      
      // Output settings
      output: {
        saveJson: true,
        saveCsv: true,
        syncToSheets: true,
        enableLogging: true,
        logLevel: 'info' // debug, info, warn, error
      },
      
      // Sources configuration
      sources: {
        videos: [],
        playlists: [],
        channels: []
      },
      
      // Advanced extraction patterns
      patterns: {
        customCodePatterns: [],
        excludeWords: [
          'PROMO', 'CODE', 'CODES', 'COUPON', 'DISCOUNT', 
          'DISCLAIMER', 'YOUTUBE', 'VIDEO', 'SUBSCRIBE', 
          'NOTIFICATION', 'DESCRIPTION', 'CHANNEL'
        ],
        linkDomains: {
          whitelist: [], // Only extract links from these domains (if not empty)
          blacklist: ['spam.com', 'malicious.site'] // Never extract from these
        }
      },
      
      // Notifications
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
      },
      
      // Schedule settings
      schedule: {
        enabled: false,
        runOnStartup: true,
        intervalHours: 6,
        timezone: 'UTC'
      }
    };
    
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf-8');
        const loadedConfig = JSON.parse(configData);
        
        // Merge with defaults to ensure all properties exist
        return this.mergeDeep(this.defaultConfig, loadedConfig);
      }
    } catch (error) {
      console.warn(`⚠️ Error loading config: ${error.message}. Using defaults.`);
    }
    
    // Create default config file
    this.saveConfig(this.defaultConfig);
    return { ...this.defaultConfig };
  }

  saveConfig(config = this.config) {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      console.log(`✅ Configuration saved to ${this.configPath}`);
    } catch (error) {
      console.error(`❌ Failed to save config: ${error.message}`);
    }
  }

  mergeDeep(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.mergeDeep(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.config);
  }

  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, key) => {
      if (!obj[key]) obj[key] = {};
      return obj[key];
    }, this.config);
    
    target[lastKey] = value;
    this.saveConfig();
  }

  // Helper methods for common operations
  addVideoSource(url) {
    if (!this.config.sources.videos.includes(url)) {
      this.config.sources.videos.push(url);
      this.saveConfig();
      return true;
    }
    return false;
  }

  addChannelSource(url) {
    if (!this.config.sources.channels.includes(url)) {
      this.config.sources.channels.push(url);
      this.saveConfig();
      return true;
    }
    return false;
  }

  addPlaylistSource(id) {
    if (!this.config.sources.playlists.includes(id)) {
      this.config.sources.playlists.push(id);
      this.saveConfig();
      return true;
    }
    return false;
  }

  removeSource(type, value) {
    const sources = this.config.sources[type];
    const index = sources.indexOf(value);
    if (index > -1) {
      sources.splice(index, 1);
      this.saveConfig();
      return true;
    }
    return false;
  }

  // Validation methods
  validateConfig() {
    const errors = [];
    
    if (!process.env.YOUTUBE_API_KEY) {
      errors.push('YOUTUBE_API_KEY is required in environment variables');
    }
    
    if (this.config.output.syncToSheets && !process.env.GOOGLE_SHEETS_PRIVATE_KEY) {
      errors.push('Google Sheets sync enabled but GOOGLE_SHEETS_PRIVATE_KEY not found');
    }
    
    if (this.config.notifications.enabled && !this.config.notifications.webhook) {
      errors.push('Notifications enabled but webhook URL not configured');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // CLI helper for interactive configuration
  async interactiveSetup() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

    try {
      console.log('🔧 Interactive Configuration Setup');
      console.log('=====================================\n');

      // Basic settings
      const intervalHours = await question('Extraction interval (hours) [6]: ') || '6';
      this.set('extraction.intervalHours', parseInt(intervalHours));

      const enableSchedule = await question('Enable scheduled runs? (y/n) [n]: ');
      this.set('schedule.enabled', enableSchedule.toLowerCase() === 'y');

      // Add sources
      console.log('\n📺 Add Video Sources (press Enter when done):');
      let videoUrl;
      while ((videoUrl = await question('Video URL: ')) !== '') {
        this.addVideoSource(videoUrl);
      }

      console.log('\n📋 Add Channel Sources (press Enter when done):');
      let channelUrl;
      while ((channelUrl = await question('Channel URL: ')) !== '') {
        this.addChannelSource(channelUrl);
      }

      // Notifications
      const enableNotifications = await question('\n🔔 Enable notifications? (y/n) [n]: ');
      if (enableNotifications.toLowerCase() === 'y') {
        this.set('notifications.enabled', true);
        const webhook = await question('Webhook URL: ');
        this.set('notifications.webhook', webhook);
      }

      console.log('\n✅ Configuration complete!');
      this.printSummary();

    } catch (error) {
      console.error('❌ Setup error:', error.message);
    } finally {
      rl.close();
    }
  }

  printSummary() {
    console.log('\n📊 Current Configuration:');
    console.log('========================');
    console.log(`Videos: ${this.config.sources.videos.length}`);
    console.log(`Channels: ${this.config.sources.channels.length}`);
    console.log(`Playlists: ${this.config.sources.playlists.length}`);
    console.log(`Interval: ${this.config.extraction.intervalHours} hours`);
    console.log(`Scheduled: ${this.config.schedule.enabled ? 'Yes' : 'No'}`);
    console.log(`Notifications: ${this.config.notifications.enabled ? 'Yes' : 'No'}`);
  }

  // Export current config for backup
  exportConfig(filename) {
    const exportPath = filename || `config-backup-${Date.now()}.json`;
    try {
      fs.writeFileSync(exportPath, JSON.stringify(this.config, null, 2));
      console.log(`✅ Configuration exported to ${exportPath}`);
      return exportPath;
    } catch (error) {
      console.error(`❌ Export failed: ${error.message}`);
      return null;
    }
  }

  // Import config from backup
  importConfig(filename) {
    try {
      const importData = fs.readFileSync(filename, 'utf-8');
      const importedConfig = JSON.parse(importData);
      
      this.config = this.mergeDeep(this.defaultConfig, importedConfig);
      this.saveConfig();
      console.log(`✅ Configuration imported from ${filename}`);
      return true;
    } catch (error) {
      console.error(`❌ Import failed: ${error.message}`);
      return false;
    }
  }
}

// CLI usage
if (require.main === module) {
  const config = new ConfigManager();
  const command = process.argv[2];

  switch (command) {
    case 'setup':
      config.interactiveSetup();
      break;
    case 'validate':
      const validation = config.validateConfig();
      if (validation.isValid) {
        console.log('✅ Configuration is valid');
      } else {
        console.log('❌ Configuration errors:');
        validation.errors.forEach(error => console.log(`  - ${error}`));
      }
      break;
    case 'export':
      config.exportConfig(process.argv[3]);
      break;
    case 'import':
      if (process.argv[3]) {
        config.importConfig(process.argv[3]);
      } else {
        console.log('Usage: node config.js import <filename>');
      }
      break;
    case 'summary':
      config.printSummary();
      break;
    default:
      console.log('Usage: node config.js <command>');
      console.log('Commands:');
      console.log('  setup     - Interactive configuration');
      console.log('  validate  - Validate current config');
      console.log('  export    - Export config backup');
      console.log('  import    - Import config from backup');
      console.log('  summary   - Show config summary');
  }
}

module.exports = ConfigManager;