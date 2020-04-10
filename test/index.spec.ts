import createDistributedLRUCache from "../src/index";
import { DistributedLRUCache } from "../src/distributed-lru-cache";
import * as uuid from 'uuid';

function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class FakeDB {
    private data: { [key: string]: string };
    private latency: number;

    constructor(latency = 0) {
        this.data = {};
        this.latency = latency;
    }
    async get(key: string): Promise<string> {
        await wait(this.latency);
        return Object.assign({}, this.data[key]);
    }
    async set(key: string, value: string): Promise<string> {
        await wait(this.latency);
        this.data[key] = Object.assign({}, value);
        return value;
    }
}

describe("distributed-lru-cache", () => {

    it('should not fail on build a new instance of distributed-lru-cache', async () => {
        let cache: DistributedLRUCache<string> | null = null;
        try {
            const db = new FakeDB();
            cache = await createDistributedLRUCache<string>({
                name: `test-${uuid.v1()}`,
                LRUCacheOptions: {
                    max: 1000
                },
                amqpConnectOptions: {
                    hostname: 'localhost',
                    username: 'guest',
                    password: 'guest'
                }
            });
            db.get('d');
            expect(cache).toBeDefined();
        } finally {
            if (cache) {
                await cache.close();
            }
        }
    });
});
