const createRabbitLRUCache = require("rabbit-lru-cache").default;
const { connect, ObjectId } = require("mongodb");
const fastify = require("fastify")({ logger: true });
const processId = process.env.PROCESS_ID || new ObjectId().toHexString();

const start = async () => {
  try {
    const client = await connect(process.env.MONGODB_URI || "mongodb://localhost:27017", { useNewUrlParser: true, useUnifiedTopology: true});
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
    cache.addOnMessageListener((content, publisherCacheId) => {
        fastify.log.info("Cache Message", "processId", processId, "publisherCacheId", publisherCacheId, "content", content);
    });

    fastify.get("/items/:id", async (request, reply) => {
        const { id } = request.params;
        reply.header("X-Process-Id", processId);
        const cachedItem = cache.get(id);
        if (cachedItem) {
            reply.header("X-Cache", "HIT");
            return cachedItem;
        }
        const item = await items.findOne({ _id: id });
        if (!item) {
            reply.header("X-Cache", "MISS");
            reply.status(404).send();
            return;
        }
        // cache.set(id, item);
        reply.header("X-Cache", "MISS");
        return item;
    });

    fastify.put("/items/:id", async (request, reply) => {
        const { id } = request.params;
        const item = { ...request.body, _id: id };
        await items.replaceOne({ _id: id }, item, { upsert: true });
        cache.del(id);
        reply.header("X-Process-Id", processId);
        return item;
    });

    fastify.delete("/items/:id", async (request, reply) => {
        const { id } = request.params;
        await items.deleteOne({ _id: id });
        cache.del(id);
        reply.header("X-Process-Id", processId);
        reply.status(204).send();
    });

    await fastify.listen(3000, "0.0.0.0");

    async function gracefullShutdown() {
        try {
            fastify.log.info("Graceful shuttingdown");
            await fastify.close();
            await cache.close();
            await client.close();
        } catch(error) {
            fastify.log.error(err);
            process.exit(1);
        }
    }
    process.on("SIGTERM", gracefullShutdown);
    process.on("SIGINIT", gracefullShutdown);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}
start();