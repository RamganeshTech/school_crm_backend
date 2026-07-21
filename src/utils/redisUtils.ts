import redisClient from "../config/redisConfig.js";

// Generic pattern-based cache wipe using SCAN (non-blocking)
export const deleteByPattern = async (pattern: string): Promise<void> => {
    const stream = redisClient.scanStream({ match: pattern, count: 100 });
    const keysToDelete: string[] = [];
    for await (const keys of stream) {
        keysToDelete.push(...keys);
    }
    if (keysToDelete.length > 0) {
        await redisClient.del(...keysToDelete);
    }
};
