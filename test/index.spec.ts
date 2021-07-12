import { RabbitLRUCache, RabbitLRUCacheOptions } from "../src/rabbit-lru-cache";
import * as uuid from "uuid";
import { Options, Message, MessageFields } from "amqplib";
import { ClosingError } from "../src/errors/ClosingError";
import * as LRUCache from "lru-cache";
import { AssertionError } from "assert";
import { amqplibMock, consumer, emitter, publish, connectMock } from "./amqplib-mock";
import { LRUCacheMock, delMock, resetMock } from "./lru-cache-mock";

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
            expect(await cache1.getOrLoad("KEY_A", () => Promise.resolve("VALUE_A"))).toBe("VALUE_A");
            expect(await cache2.getOrLoad("KEY_A", () => Promise.resolve("VALUE_A"))).toBe("VALUE_A");
            expect(await cache3.getOrLoad("KEY_A", () => Promise.resolve("VALUE_A"))).toBe("VALUE_A");

            // Act
            cache1.del("KEY_A");

            // Assert
            await promiseCache2GetTheMessage;
            await promiseCache3GetTheMessage;
            expect(await cache1.getOrLoad("KEY_A", () => Promise.resolve("VALUE_B"))).toBe("VALUE_B");
            expect(await cache2.getOrLoad("KEY_A", () => Promise.resolve("VALUE_B"))).toBe("VALUE_B");
            expect(await cache3.getOrLoad("KEY_A", () => Promise.resolve("VALUE_B"))).toBe("VALUE_B");
        } finally {
            await cache1?.close();
            cache2?.removeInvalidationMessageReceivedListener(promiseCache2Resolve);
            cache3?.removeInvalidationMessageReceivedListener(promiseCache3Resolve);
            await cache2?.close();
            await cache3?.close();
        }
    });

    it("should not cache undefined results from load item", async () => {
        // Arrange
        let cache: RabbitLRUCache<string> | null = null;
        const name = `test-${uuid.v1()}`;
        const LRUCacheOptions = {};
        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            cache = await createRabbitLRUCache({
                name,
                LRUCacheOptions,
                amqpConnectOptions
            });

            // Act
            const result1 = await cache.getOrLoad("KEY_A", () => Promise.resolve(undefined as unknown as string));

            // Assert
            expect(result1).toBe(undefined);
            expect(cache.getItemCount()).toBe(0);

            // Act
            const result2 = await cache.getOrLoad("KEY_A", () => Promise.resolve('VALUE_A'));
            expect(result2).toBe('VALUE_A');
            expect(cache.getItemCount()).toBe(1);
        } finally {
            await cache?.close();
        }
    });

    it("should not cache null results from load item", async () => {
        // Arrange
        let cache: RabbitLRUCache<string> | null = null;
        const name = `test-${uuid.v1()}`;
        const LRUCacheOptions = {};
        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            cache = await createRabbitLRUCache({
                name,
                LRUCacheOptions,
                amqpConnectOptions
            });

            // Act
            const result1 = await cache.getOrLoad("KEY_A", () => Promise.resolve(null as unknown as string));

            // Assert
            expect(result1).toBe(null);
            expect(cache.getItemCount()).toBe(0);

            // Act
            const result2 = await cache.getOrLoad("KEY_A", () => Promise.resolve('VALUE_A'));
            expect(result2).toBe('VALUE_A');
            expect(cache.getItemCount()).toBe(1);
        } finally {
            await cache?.close();
        }
    });

    it("should cache empty string results from load item", async () => {
        // Arrange
        let cache: RabbitLRUCache<string> | null = null;
        const name = `test-${uuid.v1()}`;
        const LRUCacheOptions = {};
        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            cache = await createRabbitLRUCache({
                name,
                LRUCacheOptions,
                amqpConnectOptions
            });

            // Act
            const result1 = await cache.getOrLoad("KEY_A", () => Promise.resolve(''));
            const result2 = await cache.getOrLoad("KEY_A", () => Promise.resolve('A'));

            // Assert
            expect(result1).toBe('');
            expect(result2).toBe('');
            expect(cache.getItemCount()).toBe(1);
        } finally {
            await cache?.close();
        }
    });

    it("should cache 0 number results from load item", async () => {
        // Arrange
        let cache: RabbitLRUCache<number> | null = null;
        const name = `test-${uuid.v1()}`;
        const LRUCacheOptions = {};
        try {
            const createRabbitLRUCache = requireRabbitLRUCache<number>();
            cache = await createRabbitLRUCache({
                name,
                LRUCacheOptions,
                amqpConnectOptions
            });

            // Act
            const result1 = await cache.getOrLoad("KEY_A", () => Promise.resolve(0));
            const result2 = await cache.getOrLoad("KEY_A", () => Promise.resolve(1));

            // Assert
            expect(result1).toBe(0);
            expect(result2).toBe(0);
            expect(cache.getItemCount()).toBe(1);
        } finally {
            await cache?.close();
        }
    });

    it("should await on the same promise if multiple calls to the getItem are done while loading the item", async () => {
        // Arrange
        let cache: RabbitLRUCache<string> | null = null;
        const name = `test-${uuid.v1()}`;
        const LRUCacheOptions = {};
        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            cache = await createRabbitLRUCache({
                name,
                LRUCacheOptions,
                amqpConnectOptions
            });
            const loadPromise: () => Promise<string> = jest.fn(() => new Promise(resolve => setTimeout(() => resolve("VALUE_A"), 0)));

            // Act
            const results = await Promise.all([
                cache.getOrLoad("KEY_A", loadPromise),
                cache.getOrLoad("KEY_A", loadPromise),
                cache.getOrLoad("KEY_A", loadPromise)
            ]);

            // Assert
            expect(loadPromise).toBeCalledTimes(1);
            expect(results.length).toBe(3);
            expect(results).toStrictEqual(["VALUE_A", "VALUE_A", "VALUE_A"]);
        } finally {
            await cache?.close();
        }
    });

    it("should await and reject on the same promise if multiple calls to the getItem are done while loading the item", async () => {
        // Arrange
        let cache: RabbitLRUCache<string> | null = null;
        const name = `test-${uuid.v1()}`;
        const LRUCacheOptions = {};
        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            cache = await createRabbitLRUCache({
                name,
                LRUCacheOptions,
                amqpConnectOptions
            });
            const error = Error("Oops, something goes wrong");
            const loadPromise: () => Promise<string> = jest.fn(() => new Promise((resolve, reject) => setTimeout(() => reject(error), 0)));

            // Act
            const results = await Promise.allSettled([
                cache.getOrLoad("KEY_A", loadPromise),
                cache.getOrLoad("KEY_A", loadPromise),
                cache.getOrLoad("KEY_A", loadPromise)
            ]);

            // Assert     
            expect(loadPromise).toBeCalledTimes(1);
            expect(cache.getLength()).toBe(0);   
            expect(results[0].status).toBe("rejected");   
            expect(results[1].status).toBe("rejected");
            expect(results[2].status).toBe("rejected");  
        } finally {
            await cache?.close();
        }
    });

    it("should return the item but not stored in cache if while loading item del function is called", async () => {
        // Arrange
        let cache1: RabbitLRUCache<string> | null = null;
        let cache2: RabbitLRUCache<string> | null = null;
        const name = `test-${uuid.v1()}`;
        const LRUCacheOptions = {};
        let promiseCache2Resolve;
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
            const promiseCache2GetTheMessage = new Promise(resolve => {
                promiseCache2Resolve = resolve;
                cache2?.addInvalidationMessageReceivedListener(resolve);
            });

            let resolvePromiseLoadedItem1;
            let resolvePromiseLoadedItem2;

            // Act
            await Promise.all([
                cache1.getOrLoad("KEY_A", () => new Promise<string>(resolve => {
                    resolvePromiseLoadedItem1 = resolve;
                })),
                cache2.getOrLoad("KEY_A", () => new Promise<string>(resolve => {
                    resolvePromiseLoadedItem2 = resolve;
                })),
                new Promise(resolve => {
                    cache1?.del("KEY_A");
                    resolvePromiseLoadedItem1("VALUE_A");
                    promiseCache2GetTheMessage.then(() => {
                        resolvePromiseLoadedItem2("VALUE_A");
                        resolve();
                    });
                })
            ]);

            // Assert     
            expect(cache1.keys()).toStrictEqual([]);
            expect(await cache1.getOrLoad("KEY_A", () => Promise.resolve("VALUE_B"))).toBe("VALUE_B");
            expect(cache1.keys()).toStrictEqual(["KEY_A"]);
            expect(cache2.keys()).toStrictEqual([]);
            expect(await cache2.getOrLoad("KEY_A", () => Promise.resolve("VALUE_B"))).toBe("VALUE_B");
            expect(cache2.keys()).toStrictEqual(["KEY_A"]);
        } finally {
            await cache1?.close();
            cache2?.removeInvalidationMessageReceivedListener(promiseCache2Resolve);
            await cache2?.close();
        }
    });

    it("should return the item but not stored in cache if while loading item reset function is called", async () => {
        // Arrange
        let cache1: RabbitLRUCache<string> | null = null;
        let cache2: RabbitLRUCache<string> | null = null;
        const name = `test-${uuid.v1()}`;
        const LRUCacheOptions = {};
        let promiseCache2Resolve;
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
            const promiseCache2GetTheMessage = new Promise(resolve => {
                promiseCache2Resolve = resolve;
                cache2?.addInvalidationMessageReceivedListener(resolve);
            });

            let resolvePromiseLoadedItem1;
            let resolvePromiseLoadedItem2;

            // Act
            await Promise.all([
                cache1.getOrLoad("KEY_A", () => new Promise<string>(resolve => {
                    resolvePromiseLoadedItem1 = resolve;
                })),
                cache2.getOrLoad("KEY_A", () => new Promise<string>(resolve => {
                    resolvePromiseLoadedItem2 = resolve;
                })),
                new Promise(resolve => {
                    cache1?.reset();
                    resolvePromiseLoadedItem1("VALUE_A");
                    promiseCache2GetTheMessage.then(() => {
                        resolvePromiseLoadedItem2("VALUE_A");
                        resolve();
                    });
                })
            ]);

            // Assert     
            expect(cache1.keys()).toStrictEqual([]);
            expect(await cache1.getOrLoad("KEY_A", () => Promise.resolve("VALUE_B"))).toBe("VALUE_B");
            expect(cache1.keys()).toStrictEqual(["KEY_A"]);
            expect(cache2.keys()).toStrictEqual([]);
            expect(await cache2.getOrLoad("KEY_A", () => Promise.resolve("VALUE_B"))).toBe("VALUE_B");
            expect(cache2.keys()).toStrictEqual(["KEY_A"]);
        } finally {
            await cache1?.close();
            cache2?.removeInvalidationMessageReceivedListener(promiseCache2Resolve);
            await cache2?.close();
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
                expect(await cache1.getOrLoad(key, () => Promise.resolve("VALUE_A"))).toBe("VALUE_A");
                expect(await cache2.getOrLoad(key, () => Promise.resolve("VALUE_A"))).toBe("VALUE_A");
                expect(await cache3.getOrLoad(key, () => Promise.resolve("VALUE_A"))).toBe("VALUE_A");
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
            expect(cache1.keys().length).toBe(0);
            expect(cache1.getLength()).toBe(0);
            expect(cache1.getItemCount()).toBe(0);
            expect(cache2.keys().length).toBe(0);
            expect(cache2.getLength()).toBe(0);
            expect(cache2.getItemCount()).toBe(0);
            expect(cache3.keys().length).toBe(0);
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
            expect(await cache.getOrLoad("KEY", () => Promise.resolve("VALUE_A"))).toBe("VALUE_A");
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
        let cache;

        // Act
        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            cache = await createRabbitLRUCache({
                name: "test",
                LRUCacheOptions: {},
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

    it("should do nothing if invalidation consume message is unknown", async () => {
        // Arrange
        jest.clearAllMocks().resetModules();
        jest.mock("amqplib", () => amqplibMock);
        jest.mock("lru-cache", () => LRUCacheMock);
        let cache;

        // Act
        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            cache = await createRabbitLRUCache({
                name: "test",
                LRUCacheOptions: {},
                amqpConnectOptions
            });
            consumer.onMessage({
                content: Buffer.from("unknown"),
                properties: {
                    headers: {
                        "x-cache-id": "unknown"
                    }
                } as unknown as Message["properties"],
                fields: {} as unknown as MessageFields
            });

            expect(delMock).toHaveBeenCalledTimes(0);
            expect(resetMock).toHaveBeenCalledTimes(0);
        } finally {
            await cache?.close();
            jest.unmock("amqplib");
            jest.unmock("lru-cache");
        }
    });

    it("should reconnect on connection error", async () => {
        // Arrange
        jest.clearAllMocks().resetModules();
        jest.mock("amqplib", () => amqplibMock);
        let cache;

        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            cache = await createRabbitLRUCache({
                name: "test",
                LRUCacheOptions: {},
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
            let reconnectingError, reconnectingAttempt, reconnectingRetryInterval;
            const onReconnectingEvent = function(error, attempt, retryInterval): void {
                reconnectingError = error;
                reconnectingAttempt = attempt;
                reconnectingRetryInterval = retryInterval;
                resolvePromiseReconnectingEventTriggered();
            }
            let reconnectedError, reconnectedAttempt, reconnectedRetryInterval;
            const onReconnectedEvent = function(error, attempt, retryInterval): void {
                reconnectedError = error;
                reconnectedAttempt = attempt;
                reconnectedRetryInterval = retryInterval;
                resolvePromiseReconnectedEventTriggered();
            }
            cache.addReconnectingListener(onReconnectingEvent);
            cache.addReconnectedListener(onReconnectedEvent);

            // Act
            const connectionError = Error("RabbitMq is gone")
            emitter.emitError(connectionError);

            await promiseReconnectingEventTriggered;
            await promiseReconnectedEventTriggered;

            cache.removeReconnectingListener(onReconnectingEvent);
            cache.removeReconnectedListener(onReconnectedEvent);

            expect(reconnectingError).toBe(connectionError);
            expect(reconnectingAttempt).toBe(1);
            expect(reconnectingRetryInterval).toBe(1000);

            expect(reconnectedError).toBe(connectionError);
            expect(reconnectedAttempt).toBe(1);
            expect(reconnectedRetryInterval).toBe(1000);
        } finally {
            await cache?.close();
            jest.unmock("amqplib");
        }
    });

    it("should reset cache, and turn off cache while reconnecting, finally re-enabled it when reconnected", async () => {
        // Arrange
        jest.clearAllMocks().resetModules();
        jest.mock("amqplib", () => amqplibMock);
        let cache;

        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            cache = await createRabbitLRUCache({
                name: "test",
                LRUCacheOptions: {},
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
            expect(await cache.getOrLoad("KEY_A", () => Promise.resolve("VALUE_A"))).toBe("VALUE_A");
            expect(await cache.getOrLoad("KEY_B", () => Promise.resolve("VALUE_B"))).toBe("VALUE_B");
            expect(await cache.getOrLoad("KEY_C", () => Promise.resolve("VALUE_C"))).toBe("VALUE_C");

            emitter.emitError(connectionError);

            expect(await cache.getOrLoad("KEY_A", () => Promise.resolve("VALUE_A2"))).toBe("VALUE_A2");
            expect(await cache.getOrLoad("KEY_B", () => Promise.resolve("VALUE_B2"))).toBe("VALUE_B2");
            expect(await cache.getOrLoad("KEY_C", () => Promise.resolve("VALUE_C2"))).toBe("VALUE_C2");
            expect(await cache.getOrLoad("KEY_A", () => Promise.resolve("VALUE_A3"))).toBe("VALUE_A3");
            expect(await cache.getOrLoad("KEY_B", () => Promise.resolve("VALUE_B3"))).toBe("VALUE_B3");
            expect(await cache.getOrLoad("KEY_C", () => Promise.resolve("VALUE_C3"))).toBe("VALUE_C3");
            expect(cache.getLength()).toBe(0);
            cache.del("KEY_A");
            expect(publish).toHaveBeenCalledTimes(0);

            await promiseReconnectedEventTriggered;
            cache.removeReconnectedListener(onReconnectedEvent);

            expect(await cache.getOrLoad("KEY_A", () => Promise.resolve("VALUE_A4"))).toBe("VALUE_A4");
            expect(await cache.getOrLoad("KEY_B", () => Promise.resolve("VALUE_B4"))).toBe("VALUE_B4");
            expect(await cache.getOrLoad("KEY_C", () => Promise.resolve("VALUE_C4"))).toBe("VALUE_C4");
            expect(await cache.getOrLoad("KEY_A", () => Promise.resolve("VALUE_A5"))).toBe("VALUE_A4");
            expect(await cache.getOrLoad("KEY_B", () => Promise.resolve("VALUE_B5"))).toBe("VALUE_B4");
            expect(await cache.getOrLoad("KEY_C", () => Promise.resolve("VALUE_C5"))).toBe("VALUE_C4");
            cache.del("KEY_A");
            expect(publish).toHaveBeenCalledTimes(1);

        } finally {
            await cache?.close();
            jest.unmock("amqplib");
        }
    });

    it("should reset cache twice, one before and the other one after reconnecting", async () => {
        // Arrange
        jest.clearAllMocks().resetModules();
        jest.mock("amqplib", () => amqplibMock);
        jest.mock("lru-cache", () => LRUCacheMock);
        let cache;

        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            cache = await createRabbitLRUCache({
                name: "test",
                LRUCacheOptions: {},
                amqpConnectOptions
            });

            let resolvePromiseReconnectingEventTriggered;
            const promiseReconnectingEventTriggered = new Promise(resolve => {
                resolvePromiseReconnectingEventTriggered = resolve;
            });
            const onReconnectingEvent = function(): void {
                resolvePromiseReconnectingEventTriggered();
            }
            cache.addReconnectingListener(onReconnectingEvent);

            let resolvePromiseReconnectedEventTriggered;
            const promiseReconnectedEventTriggered = new Promise(resolve => {
                resolvePromiseReconnectedEventTriggered = resolve;
            });
            const onReconnectedEvent = function(): void {
                resolvePromiseReconnectedEventTriggered();
            }
            cache.addReconnectedListener(onReconnectedEvent);

            const connectionError = Error("RabbitMq is gone");
            emitter.emitError(connectionError);
            await promiseReconnectingEventTriggered;
            expect(resetMock).toHaveBeenCalledTimes(1);
            await promiseReconnectedEventTriggered;
            expect(resetMock).toHaveBeenCalledTimes(2);
        } finally {
            await cache?.close();
            jest.unmock("amqplib");
            jest.unmock("lru-cache");
        }
    });

    it("should allow stale data while reconnecting if allowStaleData is enabled", async () => {
        // Arrange
        jest.clearAllMocks().resetModules();
        jest.mock("amqplib", () => amqplibMock);
        let cache;

        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            cache = await createRabbitLRUCache({
                name: "test",
                LRUCacheOptions: {},
                amqpConnectOptions,
                reconnectionOptions: {
                    allowStaleData: true
                }
            });

            const connectionError = Error("RabbitMq is gone")
            emitter.emitError(connectionError);

            expect(await cache.getOrLoad("KEY_A", () => Promise.resolve("VALUE_A2"))).toBe("VALUE_A2");
            expect(await cache.getOrLoad("KEY_B", () => Promise.resolve("VALUE_B2"))).toBe("VALUE_B2");
            expect(await cache.getOrLoad("KEY_C", () => Promise.resolve("VALUE_C2"))).toBe("VALUE_C2");
            expect(await cache.getOrLoad("KEY_A", () => Promise.resolve("NOT_NEEDED"))).toBe("VALUE_A2");
            expect(await cache.getOrLoad("KEY_B", () => Promise.resolve("NOT_NEEDED"))).toBe("VALUE_B2");
            expect(await cache.getOrLoad("KEY_C", () => Promise.resolve("NOT_NEEDED"))).toBe("VALUE_C2");

            cache.del("KEY_A");
            expect(publish).toHaveBeenCalledTimes(0);

        } finally {
            await cache?.close();
            jest.unmock("amqplib");
        }
    });

    it("should retry reconnection on reconnection error", async () => {
        // Arrange
        jest.clearAllMocks().resetModules();
        jest.mock("amqplib", () => amqplibMock);
        let cache;

        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            cache = await createRabbitLRUCache({
                name: "test",
                LRUCacheOptions: {},
                amqpConnectOptions,
                reconnectionOptions: {
                    retryFactor: 1
                }
            });

            let resolvePromiseReconnectedEventTriggered;
            const promiseReconnectedEventTriggered = new Promise(resolve => {
                resolvePromiseReconnectedEventTriggered = resolve;
            });
            let reconnectedError, reconnectedAttempt, reconnectedRetryInterval;
            const onReconnectedEvent = function(error, attempt, retryInterval): void {
                reconnectedError = error;
                reconnectedAttempt = attempt;
                reconnectedRetryInterval = retryInterval;
                resolvePromiseReconnectedEventTriggered();
            }
            cache.addReconnectedListener(onReconnectedEvent);

            const reconnectionError1 = Error("RabbitMq error reconnecting 1");
            const reconnectionError2 = Error("RabbitMq error reconnecting 2");
            connectMock
                .mockRejectedValueOnce(reconnectionError1)
                .mockRejectedValueOnce(reconnectionError2);

            // Act
            const connectionError = Error("RabbitMq is gone");
            emitter.emitError(connectionError);

            await promiseReconnectedEventTriggered;
            cache.removeReconnectedListener(onReconnectedEvent);

            expect(reconnectedError).toBe(reconnectionError2);
            expect(reconnectedAttempt).toBe(3);
            expect(reconnectedRetryInterval).toBe(1000);
        } finally {
            await cache?.close();
            jest.unmock("amqplib");
        }
    });

    it("should retry exponentially on reconnection error", async () => {
        // Arrange
        jest.clearAllMocks().resetModules();
        jest.mock("amqplib", () => amqplibMock);
        let cache;

        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            cache = await createRabbitLRUCache({
                name: "test",
                LRUCacheOptions: {},
                amqpConnectOptions,
                reconnectionOptions: {
                    retryFactor: 3
                }
            });

            let resolvePromiseReconnectedEventTriggered;
            const promiseReconnectedEventTriggered = new Promise(resolve => {
                resolvePromiseReconnectedEventTriggered = resolve;
            });
            let reconnectedAttempt, reconnectedRetryInterval;
            const onReconnectedEvent = function(error, attempt, retryInterval): void {
                reconnectedAttempt = attempt;
                reconnectedRetryInterval = retryInterval;
                resolvePromiseReconnectedEventTriggered();
            }
            cache.addReconnectedListener(onReconnectedEvent);

            const reconnectionError1 = Error("RabbitMq error reconnecting 1");
            connectMock.mockRejectedValueOnce(reconnectionError1);

            // Act
            const connectionError = Error("RabbitMq is gone");
            emitter.emitError(connectionError);

            await promiseReconnectedEventTriggered;
            cache.removeReconnectedListener(onReconnectedEvent);

            expect(reconnectedAttempt).toBe(3);
            expect(reconnectedRetryInterval).toBe(9000);
        } finally {
            await cache?.close();
            jest.unmock("amqplib");
        }
    });

    it("should wait for retry not more than retryMaxInterval", async () => {
        // Arrange
        jest.clearAllMocks().resetModules();
        jest.mock("amqplib", () => amqplibMock);
        let cache;

        try {
            const createRabbitLRUCache = requireRabbitLRUCache<string>();
            cache = await createRabbitLRUCache({
                name: "test",
                LRUCacheOptions: {},
                amqpConnectOptions,
                reconnectionOptions: {
                    retryMaxInterval: 500
                }
            });

            let resolvePromiseReconnectedEventTriggered;
            const promiseReconnectedEventTriggered = new Promise(resolve => {
                resolvePromiseReconnectedEventTriggered = resolve;
            });
            let reconnectedAttempt, reconnectedRetryInterval;
            const onReconnectedEvent = function(error, attempt, retryInterval): void {
                reconnectedAttempt = attempt;
                reconnectedRetryInterval = retryInterval;
                resolvePromiseReconnectedEventTriggered();
            }
            cache.addReconnectedListener(onReconnectedEvent);

            const reconnectionError1 = Error("RabbitMq error reconnecting 1");
            connectMock.mockRejectedValueOnce(reconnectionError1);

            // Act
            const connectionError = Error("RabbitMq is gone");
            emitter.emitError(connectionError);

            await promiseReconnectedEventTriggered;
            cache.removeReconnectedListener(onReconnectedEvent);

            expect(reconnectedAttempt).toBe(3);
            expect(reconnectedRetryInterval).toBe(500);
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

    describe("prune()", () => {

        it("should prune expired items in the LRU cache", async () => {
            // Arrange
            let cache: RabbitLRUCache<string> | null = null;
            const name = `test-${uuid.v1()}`;
            const LRUCacheOptions = {
                maxAge: 1
            };
            try {
                const createRabbitLRUCache = requireRabbitLRUCache<string>();
                cache = await createRabbitLRUCache({
                    name,
                    LRUCacheOptions,
                    amqpConnectOptions
                });

                // Act
                await cache.getOrLoad("KEY_A", () => Promise.resolve("VALUE_A2"));
                expect(cache.getItemCount()).toBe(1);
                await new Promise(resolve => setTimeout(resolve, 2));
                expect(cache.getItemCount()).toBe(1);
                cache.prune();

                // Assert
                expect(cache.getItemCount()).toBe(0);
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
