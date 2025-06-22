const NodeCache = require('node-cache');
const fs = require('fs');
const path = require('path');

class CacheManager {
    constructor() {
        this.memoryCache = new NodeCache({ stdTTL: 3600 });
        this.cacheDir = path.join(__dirname, 'transcript-cache');
        if (!fs.existsSync(this.cacheDir)) fs.mkdirSync(this.cacheDir);
    }

    getKey(videoId) {
        return `transcript-${videoId}`;
    }

    async get(videoId) {
        // Memory cache
        const memoryCached = this.memoryCache.get(this.getKey(videoId));
        if (memoryCached) return memoryCached;
        
        // Disk cache
        const filePath = path.join(this.cacheDir, `${videoId}.json`);
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(data);
            this.memoryCache.set(this.getKey(videoId), parsed);
            return parsed;
        }
        return null;
    }

    async set(videoId, transcript) {
        const key = this.getKey(videoId);
        this.memoryCache.set(key, transcript);
        const filePath = path.join(this.cacheDir, `${videoId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(transcript));
    }
}

module.exports = new CacheManager();
