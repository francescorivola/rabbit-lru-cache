import createRabbitLRUCache from "../src/index";
import { RabbitLRUCache, RabbitLRUCacheOptions } from "../src/rabbit-lru-cache";
import * as uuid from "uuid";
import { Options } from "amqplib";
import { ClosingError } from "../src/errors/ClosingError";
import * as LRUCache from "lru-cache";
import { AssertionError } from "assert";

function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const amqpConnectOptions: Options.Connect = {
    hostname: "localhost",
    username: "guest",
    password: "guest"
};

describe("rabbit-lru-cache", () => {

    it("should throw an assert error if options is null", async () => {
        // Arrange
        expect.assertions(2);

        // Act
        try {
            await createRabbitLRUCache<string>(null as unknown as RabbitLRUCacheOptions<string>);
        } catch(error) {
            expect(error instanceof AssertionError).toBe(true);
            expect(error.message).toBe("null != null");
        }
    });

    it("should throw an assert error if options is undefined", async () => {
        // Arrange
        expect.assertions(2);

        // Act
        try {
            await createRabbitLRUCache<string>(undefined as unknown as RabbitLRUCacheOptions<string>);
        } catch(error) {
            expect(error instanceof AssertionError).toBe(true);
            expect(error.message).toBe("undefined != null");
        }
    });

    it("should throw an assert error if options.name is null", async () => {
        // Arrange
        expect.assertions(2);

        // Act
        try {
            await createRabbitLRUCache<string>({
                name: null as unknown as string,
                LRUCacheOptions: {},
                amqpConnectOptions
            });
        } catch(error) {
            expect(error instanceof AssertionError).toBe(true);
            expect(error.message).toBe("null != null");
        }
    });

    it("should throw an assert error if options.name is empty string", async () => {
        // Arrange
        expect.assertions(2);

        // Act
        try {
            await createRabbitLRUCache<string>({
                name: "",
                LRUCacheOptions: {},
                amqpConnectOptions
            });
        } catch(error) {
            expect(error instanceof AssertionError).toBe(true);
            expect(error.message).toBe("'' != ''");
        }
    });

    it("should throw an assert error if options.LRUCacheOptions is null or undefined", async () => {
        // Arrange
        expect.assertions(2);

        // Act
        try {
            await createRabbitLRUCache<string>({
                name: "test",
                LRUCacheOptions: null as unknown as LRUCache.Options<string, string>,
                amqpConnectOptions
            });
        } catch(error) {
            expect(error instanceof AssertionError).toBe(true);
            expect(error.message).toBe("null != null");
        }
    });

    it("should throw an assert error if options.amqpConnectOptions is null or undefined", async () => {
        // Arrange
        expect.assertions(2);

        // Act
        try {
            await createRabbitLRUCache<string>({
                name: "test",
                LRUCacheOptions: { },
                amqpConnectOptions: null as unknown as Options.Connect
            });
        } catch(error) {
            expect(error instanceof AssertionError).toBe(true);
            expect(error.message).toBe("null != null");
        }
    });

    it("should invalidate cache key on del key", async () => {
        // Arrange
        let cache1: RabbitLRUCache<string> | null = null;
        let cache2: RabbitLRUCache<string> | null = null;
        let cache3: RabbitLRUCache<string> | null = null;
        const name = `test-${uuid.v1()}`;
        const LRUCacheOptions = {};
        try {
            cache1 = await createRabbitLRUCache<string>({
                name,
                LRUCacheOptions,
                amqpConnectOptions
            });
            cache2 = await createRabbitLRUCache<string>({
                name,
                LRUCacheOptions,
                amqpConnectOptions
            });
            cache3 = await createRabbitLRUCache<string>({
                name,
                LRUCacheOptions,
                amqpConnectOptions
            });
            cache1.set("KEY_A", "VALUE_A");
            expect(cache1.get("KEY_A")).toBe("VALUE_A");
            cache2.set("KEY_A", "VALUE_A");
            expect(cache2.get("KEY_A")).toBe("VALUE_A");
            cache3.set("KEY_A", "VALUE_A");
            expect(cache3.get("KEY_A")).toBe("VALUE_A");

            // Act
            cache1.del("KEY_A");

            // Assert
            await wait(5);
            expect(cache1.get("KEY_A")).toBeUndefined();
            expect(cache2.get("KEY_A")).toBeUndefined();
            expect(cache3.get("KEY_A")).toBeUndefined();
        } finally {
            await cache1?.close();
            await cache2?.close();
            await cache3?.close();
        }
    });

    it("should invalidate all cache keys on reset", async () => {
        // Arrange
        let cache1: RabbitLRUCache<string> | null = null;
        let cache2: RabbitLRUCache<string> | null = null;
        let cache3: RabbitLRUCache<string> | null = null;
        const name = `test-${uuid.v1()}`;
        const LRUCacheOptions = {};
        try {
            cache1 = await createRabbitLRUCache<string>({
                name,
                LRUCacheOptions,
                amqpConnectOptions
            });
            cache2 = await createRabbitLRUCache<string>({
                name,
                LRUCacheOptions,
                amqpConnectOptions
            });
            cache3 = await createRabbitLRUCache<string>({
                name,
                LRUCacheOptions,
                amqpConnectOptions
            });
            for(let i = 0; i < 1000; i++) {
                const key = `KEY_${i}`;
                cache1.set(key, "VALUE_A");
                expect(cache1.get(key)).toBe("VALUE_A");
                expect(cache1.peek(key)).toBe("VALUE_A");
                cache2.set(key, "VALUE_A");
                expect(cache2.get(key)).toBe("VALUE_A");
                expect(cache2.peek(key)).toBe("VALUE_A");
                cache3.set(key, "VALUE_A");
                expect(cache3.get(key)).toBe("VALUE_A");
                expect(cache3.peek(key)).toBe("VALUE_A");
            }
            expect(cache1.getLength()).toBe(1000);
            expect(cache1.getItemCount()).toBe(1000);
            expect(cache2.getLength()).toBe(1000);
            expect(cache2.getItemCount()).toBe(1000);
            expect(cache3.getLength()).toBe(1000);
            expect(cache3.getItemCount()).toBe(1000);

            // Act
            cache1.reset();

            // Assert
            await wait(5);
            expect(cache1.get("KEY_0")).toBeUndefined();
            expect(cache1.peek("KEY_0")).toBeUndefined();
            expect(cache1.getLength()).toBe(0);
            expect(cache1.getItemCount()).toBe(0);
            expect(cache2.get("KEY_0")).toBeUndefined();
            expect(cache2.peek("KEY_0")).toBeUndefined();
            expect(cache2.getLength()).toBe(0);
            expect(cache2.getItemCount()).toBe(0);
            expect(cache3.get("KEY_0")).toBeUndefined();
            expect(cache3.peek("KEY_0")).toBeUndefined();
            expect(cache3.getLength()).toBe(0);
            expect(cache3.getItemCount()).toBe(0);
        } finally {
            await cache1?.close();
            await cache2?.close();
            await cache3?.close();
        }
    });

    it("should throw an error if any method is called after closing or already closed", async () => {
        // Arrange
        expect.assertions(2);
        const name = `test-${uuid.v1()}`;
        const LRUCacheOptions = {};
        const cache = await createRabbitLRUCache<string>({
            name,
            LRUCacheOptions,
            amqpConnectOptions
        });
        await cache.close();

        // Act
        try {
            cache.get("KEY");
        } catch(error) {
            expect(error instanceof ClosingError).toBe(true);
            expect(error.message).toBe("Cache is closing or has been closed");
        }
    });

    describe("getMax()", () => {

        it("should return the LRU cache max value", async () => {
            // Arrange
            let cache: RabbitLRUCache<string> | null = null;
            const name = `test-${uuid.v1()}`;
            const LRUCacheOptions = {
                max: 1000
            };
            try {
                cache = await createRabbitLRUCache<string>({
                    name,
                    LRUCacheOptions,
                    amqpConnectOptions
                });

                // Act
                const result = cache.getMax();

                // Assert
                expect(result).toBe(1000);
            } finally {
                await cache?.close();
            }
        });
    });

    describe("getMaxAge()", () => {

        it("should return the LRU cache max age value", async () => {
            // Arrange
            let cache: RabbitLRUCache<string> | null = null;
            const name = `test-${uuid.v1()}`;
            const LRUCacheOptions = {
                maxAge: 100
            };
            try {
                cache = await createRabbitLRUCache<string>({
                    name,
                    LRUCacheOptions,
                    amqpConnectOptions
                });

                // Act
                const result = cache.getMaxAge();

                // Assert
                expect(result).toBe(100);
            } finally {
                await cache?.close();
            }
        });
    });

    describe("doesAllowStale()", () => {

        it("should return the LRU cache stale value", async () => {
            // Arrange
            let cache: RabbitLRUCache<string> | null = null;
            const name = `test-${uuid.v1()}`;
            const LRUCacheOptions: LRUCache.Options<string, string> = {
                stale: true
            };
            try {
                cache = await createRabbitLRUCache<string>({
                    name,
                    LRUCacheOptions,
                    amqpConnectOptions
                });

                // Act
                const result = cache.doesAllowStale();

                // Assert
                expect(result).toBe(true);
            } finally {
                await cache?.close();
            }
        });
    });
});
