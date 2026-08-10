const { prisma } = require("../config/db");
const { redisClient } = require("../config/redis");

const pushStrokeToBuffer = async (boardId, stroke) => {
  try {
    await redisClient.rPush(`board:${boardId}:pending_strokes`, JSON.stringify(stroke));
  } catch (err) {
    console.error(`Redis push error for board ${boardId}:`, err);
  }
};

const flushRedisToDatabase = async () => {
  try {
    const keys = await redisClient.keys("board:*:pending_strokes");
    if (keys.length === 0) return;

    for (const key of keys) {
      const boardId = key.split(":")[1];

      // Atomic pop from Redis (up to 1000 items)
      const rawStrokes = await redisClient.lPopCount(key, 1000);

      if (rawStrokes && rawStrokes.length > 0) {
        const parsedStrokes = rawStrokes.map((s) => JSON.parse(s));
        const strokesJson = JSON.stringify(parsedStrokes);

        // Atomic PostgreSQL JSONB append using raw Prisma query
        await prisma.$executeRaw`
          INSERT INTO "boards" ("board_id", "title", "data", "updated_at")
          VALUES (${boardId}, 'Untitled Board', ${strokesJson}::jsonb, NOW())
          ON CONFLICT ("board_id") 
          DO UPDATE SET 
            "data" = "boards"."data" || ${strokesJson}::jsonb,
            "updated_at" = NOW();
        `;

        console.log(`[Flush] Processed ${parsedStrokes.length} strokes for board ${boardId}`);
      }
    }
  } catch (err) {
    console.error("Error during Redis-to-Postgres flush:", err);
  }
};

module.exports = {
  pushStrokeToBuffer,
  flushRedisToDatabase,
};