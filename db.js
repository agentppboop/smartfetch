const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000
});

async function batchInsert(videoDataArray) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const data of videoDataArray) {
            await client.query(`
                INSERT INTO video_results (
                    video_id, video_title, timestamp, 
                    links, codes, percent_off, 
                    flat_discount, confidence
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (video_id) DO NOTHING
            `, [
                data.videoId,
                data.videoTitle,
                new Date().toISOString(),
                data.links,
                data.codes,
                data.percent_off,
                data.flat_discount,
                data.confidence
            ]);
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Batch insert error:', e.message);
    } finally {
        client.release();
    }
}

module.exports = { batchInsert };
