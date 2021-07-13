const createRabbitLRUCache = require("rabbit-lru-cache").default;
const { MongoClient, ObjectId } = require("mongodb");
const fastify = require("fastify")({ logger: true });
const serverId = process.env.SERVER_ID || new ObjectId().toHexString();

async function start() {
  try {
    const client = new MongoClient(process.env.MONGODB_URI || "mongodb://localhost:27017", {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    await client.connect();
    const db = client.db("example");
    const items = db.collection("items");
    const cache = await createRabbitLRUCache({
        name: "example",
        LRUCacheOptions: {},
        amqpConnectOptions: {
            hostname: process.env.RABBITMQ_HOSTNAME || "localhost",
            username: process.env.RABBITMQ_USERNAME || "guest",
            password: process.env.RABBITMQ_PASSWORD || "guest"
        }
    });
    cache.addInvalidationMessageReceivedListener((content, publisherCacheId) => {
        fastify.log.info("Cache Message", "serverId", serverId, "publisherCacheId", publisherCacheId, "content", content);
    });
    cache.addReconnectingListener((error, attempt, retryInterval) => {
        fastify.log.info("Reconnecting", error.message, "attempt", attempt, "retryInterval", retryInterval);
    });
    cache.addReconnectedListener((error, attempt, retryInterval) => {
        fastify.log.info("Reconnected", error.message, "attempt", attempt, "retryInterval", retryInterval);
    });

    fastify.get("/items/:id", async (request, reply) => {
        const { id } = request.params;
        reply.header("X-Server-Id", serverId);
        let cacheStatus = "HIT";
        const item = await cache.getOrLoad(id, () => {
            cacheStatus = "MISS";
            return items.findOne({ _id: id });
        });
        if (!item) {
            reply.header("X-Cache", "MISS");
            reply.status(404).send();
            return;
        }
        reply.header("X-Cache", cacheStatus);
        return item;
    });

    fastify.put("/items/:id", async (request, reply) => {
        const { id } = request.params;
        const item = { ...request.body, _id: id };
        await items.replaceOne({ _id: id }, item, { upsert: true });
        cache.del(id);
        reply.header("X-Server-Id", serverId);
        return item;
    });

    fastify.delete("/items/:id", async (request, reply) => {
        const { id } = request.params;
        await items.deleteOne({ _id: id });
        cache.del(id);
        reply.header("X-Server-Id", serverId);
        reply.status(204).send();
    });

    await fastify.listen(3000, "0.0.0.0");

    async function gracefulShutdown() {
        try {
            fastify.log.info("Graceful shutting down");
            await fastify.close();
            await cache.close();
            await client.close();
        } catch(error) {
            fastify.log.error(err);
            process.exit(1);
        }
    }
    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINIT", gracefulShutdown);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}
start();