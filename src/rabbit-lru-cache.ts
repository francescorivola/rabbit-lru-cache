import * as LRUCache from "lru-cache";
import { connect, Options, ConsumeMessage, Channel, Connection } from "amqplib";
import * as uuid from "uuid";
import { ClosingError } from "./errors/ClosingError";
import { notEqual } from "assert";
import { EventEmitter } from "events";
import once from "./utils/once";

export type RabbitLRUCache<T> = {
    close: () => Promise<void>;
    getItemCount: () => number;
    doesAllowStale: () => boolean;
    getLength: () => number;
    getMax: () => number;
    getMaxAge: () => number;
    addInvalidationMessageReceivedListener(fn: (messageContent: string, publisherCacheId: string) => void): void;
    removeInvalidationMessageReceivedListener(fn: (messageContent: string, publisherCacheId: string) => void): void;
    addReconnectingListener(fn: (error: Error, attempt: number, retryInterval: number) => void): void;
    removeReconnectingListener(fn: (error: Error, attempt: number, retryInterval: number) => void): void;
    addReconnectedListener(fn: (error: Error, attempt: number, retryInterval: number) => void): void;
    removeReconnectedListener(fn: (error: Error, attempt: number, retryInterval: number) => void): void;
} & Omit<LRUCache<string, T>, "itemCount" | "length" | "allowStale" | "max" | "maxAge">;

export type RabbitLRUCacheOptions<T> = {
    name: string;
    LRUCacheOptions: LRUCache.Options<string, T>;
    amqpConnectOptions: Options.Connect;
    reconnectionOptions?: {
        retryIntervalUpTo?: number;
        retryIntervalIncrease?: number;
    };
};

export async function createRabbitLRUCache<T>(options: RabbitLRUCacheOptions<T>): Promise<RabbitLRUCache<T>> {
    notEqual(options, null, "options is required");
    notEqual(options.name, null, "options.name is required");
    notEqual(options.name, "", "options.name is required");
    notEqual(options.LRUCacheOptions, null, "options.LRUCacheOptions is required");
    notEqual(options.amqpConnectOptions, null, "options.amqpConnectOptions is required");

    const eventEmitter = new EventEmitter();
    let closing = false;
    let reconnecting = false;

    const cacheId = uuid.v1();
    const cache = new LRUCache<string, T>(options.LRUCacheOptions);

    let connection: Connection;
    let publisherChannel: Channel, subscriberChannel: Channel;
    const exchangeName = `rabbit-lru-cache-${options.name}`;

    async function createConnection(options: Options.Connect, handleConnectionError: (error: Error, attempt: number, retryInterval: number) => Promise<void>): Promise<Connection> {
        const connection = await connect(options);
        connection.removeAllListeners("error");
        const errorHandler = once(handleConnectionError);
        connection.on("error", errorHandler);
        connection.on("close", errorHandler);
        return connection;
    }

    async function createPublisher(connection: Connection, exchangeName: string): Promise<Channel> {
        const channel = await connection.createChannel();
        await channel.assertExchange(exchangeName, "fanout", { durable: false });
        return channel;
    }

    async function createConsumer(connection: Connection, exchangeName: string, cacheId: string, cache: LRUCache<string, T>): Promise<Channel> {
        const channel = await connection.createChannel();
        const queueName = `${exchangeName}-${cacheId}`;
        await channel.assertQueue(queueName, {
            durable: false,
            exclusive: true,
            autoDelete: true
        });
        await channel.bindQueue(queueName, exchangeName, "");
        await channel.consume(queueName, function onMessage(msg: ConsumeMessage | null) {
            if (msg === null) {
                throw new Error("consumer has been cancelled by RabbitMq");
            }
            const publisherCacheId = msg.properties.headers["x-cache-id"];
            if (publisherCacheId === cacheId) {
                return;
            }
            const content = msg.content.toString();
            if (content === "reset") {
                cache.reset();
            } else if (content.startsWith("del:")) {
                const key = content.substring(4);
                cache.del(key);
            }
            eventEmitter.emit("invalidation-message-received", content, publisherCacheId);
        }, { exclusive: true, noAck: true, consumerTag: cacheId });
        return channel;
    }

    async function handleConnectionError(error: Error, attempt = 0, retryInterval = 0): Promise<void> {
        if (closing) {
            return;
        }
        const retryIntervalIncrease = options.reconnectionOptions?.retryIntervalIncrease ?? 1000;
        const retryIntervalUpTo = options.reconnectionOptions?.retryIntervalUpTo ?? 60000;
        try {
            attempt++;
            reconnecting = true;
            cache.reset();
            eventEmitter.emit("reconnecting", error, attempt, retryInterval);
            connection = await createConnection(options.amqpConnectOptions, handleConnectionError);
            publisherChannel = await createPublisher(connection, exchangeName);
            subscriberChannel = await createConsumer(connection, exchangeName, cacheId, cache);
            reconnecting = false;
            eventEmitter.emit("reconnected", error, attempt, retryInterval);
        } catch(error) {
            if (retryInterval < retryIntervalUpTo) {
                retryInterval = retryInterval + retryIntervalIncrease;
            }
            setTimeout(handleConnectionError.bind(null, error, attempt, retryInterval), retryInterval);
        }
    }

    connection = await createConnection(options.amqpConnectOptions, handleConnectionError);
    publisherChannel = await createPublisher(connection, exchangeName);
    subscriberChannel = await createConsumer(connection, exchangeName, cacheId, cache);

    function assertIsClosingOrClosed(): void {
        if (closing) {
            throw new ClosingError("Cache is closing or has been closed");
        }
    }

    function assertIsClosingOrClosedDecorator<TT>(fn: (...args) => TT): (...args) => TT {
        return function(...args): TT {
            assertIsClosingOrClosed();
            return fn(...args);
        }
    }

    function publish(message: string): void {
        if (reconnecting) {
            return;
        }
        publisherChannel.publish(exchangeName, "", Buffer.from(message), { headers: {
            "x-cache-id": cacheId
        }});
    }

    return {
        del(key: string): void {
            assertIsClosingOrClosed();
            publish(`del:${key}`);
            cache.del(key);
        },
        reset(): void {
            assertIsClosingOrClosed();
            publish("reset");
            cache.reset();
        },
        set(key: string, value: T): boolean {
            assertIsClosingOrClosed();
            if (reconnecting) {
                return false;
            }
            return cache.set(key, value);
        },
        get: assertIsClosingOrClosedDecorator(cache.get.bind(cache)),
        prune: assertIsClosingOrClosedDecorator(cache.prune.bind(cache)),
        dump: assertIsClosingOrClosedDecorator(cache.dump.bind(cache)),
        values: assertIsClosingOrClosedDecorator(cache.values.bind(cache)),
        has: assertIsClosingOrClosedDecorator(cache.has.bind(cache)),
        forEach: assertIsClosingOrClosedDecorator(cache.forEach.bind(cache)),
        keys: assertIsClosingOrClosedDecorator(cache.keys.bind(cache)),
        load: assertIsClosingOrClosedDecorator(cache.load.bind(cache)),
        peek: assertIsClosingOrClosedDecorator(cache.peek.bind(cache)),
        rforEach: assertIsClosingOrClosedDecorator(cache.rforEach.bind(cache)),
        lengthCalculator: assertIsClosingOrClosedDecorator(cache.lengthCalculator.bind(cache)),
        doesAllowStale(): boolean {
            assertIsClosingOrClosed();
            return cache.allowStale;
        },
        getItemCount(): number {
            assertIsClosingOrClosed();
            return cache.itemCount;
        },
        getLength(): number {
            assertIsClosingOrClosed();
            return cache.length;
        },
        getMax(): number {
            assertIsClosingOrClosed();
            return cache.max;
        },
        getMaxAge(): number {
            assertIsClosingOrClosed();
            return cache.maxAge;
        },
        async close(): Promise<void> {
            closing = true;
            await subscriberChannel.cancel(cacheId);
            await Promise.all([
                subscriberChannel.close(),
                publisherChannel.close()
            ]);
            await connection.close();
            cache.reset();
        },
        addInvalidationMessageReceivedListener(fn: (messageContent: string, publisherCacheId: string) => void): void {
            eventEmitter.addListener("invalidation-message-received", fn);
        },
        removeInvalidationMessageReceivedListener(fn: (messageContent: string, publisherCacheId: string) => void): void {
            eventEmitter.removeListener("invalidation-message-received", fn);
        },
        addReconnectingListener(fn: (error: Error, attempt: number, retryInterval: number) => void): void {
            eventEmitter.addListener("reconnecting", fn);
        },
        removeReconnectingListener(fn: (error: Error, attempt: number, retryInterval: number) => void): void {
            eventEmitter.removeListener("reconnecting", fn);
        },
        addReconnectedListener(fn: (error: Error, attempt: number, retryInterval: number) => void): void {
            eventEmitter.addListener("reconnected", fn);
        },
        removeReconnectedListener(fn: (error: Error, attempt: number, retryInterval: number) => void): void {
            eventEmitter.removeListener("reconnected", fn);
        }
    };
}