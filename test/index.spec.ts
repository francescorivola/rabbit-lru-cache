import { RabbitLRUCache, RabbitLRUCacheOptions } from "../src/rabbit-lru-cache";
import * as uuid from "uuid";
import { Options } from "amqplib";
import { ClosingError } from "../src/errors/ClosingError";
import * as LRUCache from "lru-cache";
import { AssertionError } from "assert";
import { amqplibMock, consumer, emitter, publish } from "./amqplib-mock";

const amqpConnectOptions: Options.Connect = {
    hostname: "localhost",
    username: "guest",
    password: "guest"
};

function requireRabbitLRUCache<T>(): (options: RabbitLRUCacheOptions<T>) => Promise<RabbitLRUCache<T>> {
    return require("../src/index").default;
}

describe("rabbit-lru-cache", () => {

    it("should throw an assert error if options is null", async () => {
        // Arrange
        expect.assertions(2);

        // Act
        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            await createRabbitLRUCache(null as unknown as RabbitLRUCacheOptions<string>);
        } catch(error) {
            expect(error instanceof AssertionError).toBe(true);
            expect(error.message).toBe("options is required");
        }
    });

    it("should throw an assert error if options is undefined", async () => {
        // Arrange
        expect.assertions(2);

        // Act
        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            await createRabbitLRUCache(undefined as unknown as RabbitLRUCacheOptions<string>);
        } catch(error) {
            expect(error instanceof AssertionError).toBe(true);
            expect(error.message).toBe("options is required");
        }
    });

    it("should throw an assert error if options.name is null", async () => {
        // Arrange
        expect.assertions(2);

        // Act
        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            await createRabbitLRUCache({
                name: null as unknown as string,
                LRUCacheOptions: {},
                amqpConnectOptions
            });
        } catch(error) {
            expect(error instanceof AssertionError).toBe(true);
            expect(error.message).toBe("options.name is required");
        }
    });

    it("should throw an assert error if options.name is empty string", async () => {
        // Arrange
        expect.assertions(2);

        // Act
        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            await createRabbitLRUCache({
                name: "",
                LRUCacheOptions: {},
                amqpConnectOptions
            });
        } catch(error) {
            expect(error instanceof AssertionError).toBe(true);
            expect(error.message).toBe("options.name is required");
        }
    });

    it("should throw an assert error if options.LRUCacheOptions is null or undefined", async () => {
        // Arrange
        expect.assertions(2);

        // Act
        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            await createRabbitLRUCache({
                name: "test",
                LRUCacheOptions: null as unknown as LRUCache.Options<string, string>,
                amqpConnectOptions
            });
        } catch(error) {
            expect(error instanceof AssertionError).toBe(true);
            expect(error.message).toBe("options.LRUCacheOptions is required");
        }
    });

    it("should throw an assert error if options.amqpConnectOptions is null or undefined", async () => {
        // Arrange
        expect.assertions(2);

        // Act
        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            await createRabbitLRUCache({
                name: "test",
                LRUCacheOptions: { },
                amqpConnectOptions: null as unknown as Options.Connect
            });
        } catch(error) {
            expect(error instanceof AssertionError).toBe(true);
            expect(error.message).toBe("options.amqpConnectOptions is required");
        }
    });

    it("should invalidate cache key on del key", async () => {
        // Arrange
        let cache1: RabbitLRUCache<string> | null = null;
        let cache2: RabbitLRUCache<string> | null = null;
        let cache3: RabbitLRUCache<string> | null = null;
        const name = `test-${uuid.v1()}`;
        const LRUCacheOptions = {};
        let promiseCache2Resolve;
        let promiseCache3Resolve;
        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            cache1 = await createRabbitLRUCache({
                name,
                LRUCacheOptions,
                amqpConnectOptions
            });
            cache2 = await createRabbitLRUCache({
                name,
                LRUCacheOptions,
                amqpConnectOptions
            });
            cache3 = await createRabbitLRUCache({
                name,
                LRUCacheOptions,
                amqpConnectOptions
            });
            const promiseCache2GetTheMessage = new Promise(resolve => {
                promiseCache2Resolve = resolve;
                cache2?.addInvalidationMessageReceivedListener(resolve);
            });
            const promiseCache3GetTheMessage = new Promise(resolve => {
                promiseCache3Resolve = resolve;
                cache3?.addInvalidationMessageReceivedListener(resolve);
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
            await promiseCache2GetTheMessage;
            await promiseCache3GetTheMessage;
            expect(cache1.get("KEY_A")).toBeUndefined();
            expect(cache2.get("KEY_A")).toBeUndefined();
            expect(cache3.get("KEY_A")).toBeUndefined();
        } finally {
            await cache1?.close();
            cache2?.removeInvalidationMessageReceivedListener(promiseCache2Resolve);
            cache3?.removeInvalidationMessageReceivedListener(promiseCache3Resolve);
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
        let promiseCache2Resolve;
        let promiseCache3Resolve;
        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            cache1 = await createRabbitLRUCache({
                name,
                LRUCacheOptions,
                amqpConnectOptions
            });
            cache2 = await createRabbitLRUCache({
                name,
                LRUCacheOptions,
                amqpConnectOptions
            });
            cache3 = await createRabbitLRUCache({
                name,
                LRUCacheOptions,
                amqpConnectOptions
            });
            const promiseCache2GetTheMessage = new Promise(resolve => {
                promiseCache2Resolve = resolve;
                cache2?.addInvalidationMessageReceivedListener(resolve);
            });
            const promiseCache3GetTheMessage = new Promise(resolve => {
                promiseCache3Resolve = resolve;
                cache3?.addInvalidationMessageReceivedListener(resolve);
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
            await promiseCache2GetTheMessage;
            await promiseCache3GetTheMessage;
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
            cache2?.removeInvalidationMessageReceivedListener(promiseCache2Resolve);
            cache3?.removeInvalidationMessageReceivedListener(promiseCache3Resolve);
            await cache2?.close();
            await cache3?.close();
        }
    });

    it("should throw an error if any method is called after closing or already closed", async () => {
        // Arrange
        expect.assertions(2);
        const name = `test-${uuid.v1()}`;
        const LRUCacheOptions = {};
        const createRabbitLRUCache = requireRabbitLRUCache<string>();
        const cache = await createRabbitLRUCache({
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

    it("should throw an error if invalidation consume message is null", async () => {
        // Arrange
        jest.clearAllMocks().resetModules();
        jest.mock("amqplib", () => amqplibMock);
        expect.assertions(2);
        const name = `test-${uuid.v1()}`;
        const LRUCacheOptions = {};
        let cache;

        // Act
        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            cache = await createRabbitLRUCache({
                name,
                LRUCacheOptions,
                amqpConnectOptions
            });
            consumer.onMessage(null);
        } catch(error) {
            expect(error instanceof Error).toBe(true);
            expect(error.message).toBe("consumer has been cancelled by RabbitMq");
        } finally {
            await cache?.close();
            jest.unmock("amqplib");
        }
    });

    it("should reconnect on connection error", async () => {
        // Arrange
        jest.clearAllMocks().resetModules();
        jest.mock("amqplib", () => amqplibMock);
        expect.assertions(6);
        const name = `test-${uuid.v1()}`;
        const LRUCacheOptions = {};
        let cache;

        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            cache = await createRabbitLRUCache({
                name,
                LRUCacheOptions,
                amqpConnectOptions
            });

            let resolvePromiseReconnectingEventTriggered;
            const promiseReconnectingEventTriggered = new Promise(resolve => {
                resolvePromiseReconnectingEventTriggered = resolve;
            });
            let resolvePromiseReconnectedEventTriggered;
            const promiseReconnectedEventTriggered = new Promise(resolve => {
                resolvePromiseReconnectedEventTriggered = resolve;
            });
            const connectionError = Error("RabbitMq is gone")
            const onReconnectingEvent = function(error, attempt, retryTime): void {
                expect(error).toBe(connectionError);
                expect(attempt).toBe(1);
                expect(retryTime).toBe(0);
                resolvePromiseReconnectingEventTriggered();
            }
            const onReconnectedEvent = function(error, attempt, retryTime): void {
                expect(error).toBe(connectionError);
                expect(attempt).toBe(1);
                expect(retryTime).toBe(0);
                resolvePromiseReconnectedEventTriggered();
            }
            cache.addReconnectingListener(onReconnectingEvent);
            cache.addReconnectedListener(onReconnectedEvent);

            // Act
            emitter.emitError(connectionError);

            await promiseReconnectingEventTriggered;
            await promiseReconnectedEventTriggered;

            cache.removeReconnectingListener(onReconnectingEvent);
            cache.removeReconnectedListener(onReconnectedEvent);
        } finally {
            await cache?.close();
            jest.unmock("amqplib");
        }
    });

    it("should reset cache, and turn off cache when reconnecting", async () => {
        // Arrange
        jest.clearAllMocks().resetModules();
        jest.mock("amqplib", () => amqplibMock);
        const name = `test-${uuid.v1()}`;
        const LRUCacheOptions = {};
        let cache;

        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            cache = await createRabbitLRUCache({
                name,
                LRUCacheOptions,
                amqpConnectOptions
            });

            let resolvePromiseReconnectedEventTriggered;
            const promiseReconnectedEventTriggered = new Promise(resolve => {
                resolvePromiseReconnectedEventTriggered = resolve;
            });
            const connectionError = Error("RabbitMq is gone")
            const onReconnectedEvent = function(): void {
                resolvePromiseReconnectedEventTriggered();
            }
            cache.addReconnectedListener(onReconnectedEvent);

            // Act
            cache.set("KEY_A", "VALUE_A");
            cache.set("KEY_B", "VALUE_B");
            cache.set("KEY_C", "VALUE_C");
            expect(cache.get("KEY_A")).toBe("VALUE_A");
            expect(cache.get("KEY_B")).toBe("VALUE_B");
            expect(cache.get("KEY_C")).toBe("VALUE_C");

            emitter.emitError(connectionError);
            expect(cache.get("KEY_A")).toBe(undefined);
            expect(cache.get("KEY_B")).toBe(undefined);
            expect(cache.get("KEY_C")).toBe(undefined);
            expect(cache.set("KEY_A", "VALUE_A")).toBe(false);
            expect(cache.get("KEY_A")).toBe(undefined);
            cache.del("KEY_A");
            expect(publish).toHaveBeenCalledTimes(0);

            await promiseReconnectedEventTriggered;
            cache.removeReconnectedListener(onReconnectedEvent);

            expect(cache.set("KEY_A", "VALUE_A")).toBe(true);
            expect(cache.get("KEY_A")).toBe("VALUE_A");
            cache.del("KEY_A");
            expect(publish).toHaveBeenCalledTimes(1);

        } finally {
            await cache?.close();
            jest.unmock("amqplib");
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
                const createRabbitLRUCache = requireRabbitLRUCache<string>();
                cache = await createRabbitLRUCache({
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
                const createRabbitLRUCache = requireRabbitLRUCache<string>();
                cache = await createRabbitLRUCache({
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
                const createRabbitLRUCache = requireRabbitLRUCache<string>();
                cache = await createRabbitLRUCache({
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
