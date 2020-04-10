import * as LRUCache from "lru-cache";
import { connect, Options, ConsumeMessage } from "amqplib";
import * as uuid from "uuid";
import { ClosingError } from "./errors/ClosingError";
import { notEqual } from "assert";

export type RabbitLRUCache<T> = {
    close: () => Promise<void>;
    getItemCount: () => number;
    doesAllowStale: () => boolean;
    getLength: () => number;
    getMax: () => number;
    getMaxAge: () => number;
} & Omit<LRUCache<string, T>, "itemCount" | "length" | "allowStale" | "max" | "maxAge">;

export type RabbitLRUCacheOptions<T> = {
    name: string;
    LRUCacheOptions: LRUCache.Options<string, T>;
    amqpConnectOptions: Options.Connect;
};

export async function createRabbitLRUCache<T>(options: RabbitLRUCacheOptions<T>): Promise<RabbitLRUCache<T>> {
    notEqual(options, null);
    notEqual(options.name, null);
    notEqual(options.name, "");
    notEqual(options.LRUCacheOptions, null);
    notEqual(options.amqpConnectOptions, null);

    let closing = false;
    const cacheId = uuid.v1();
    const connection = await connect(options.amqpConnectOptions);
    const [ publisherChannel, subscriberChannel ] = await Promise.all([
        connection.createChannel(),
        connection.createChannel()
    ]);
    const exchangeName = `rabbit-lru-cache-${options.name}`;
    await publisherChannel.assertExchange(exchangeName, 'fanout', { durable: false });
    const queueName = `${exchangeName}-${cacheId}`;
    await subscriberChannel.assertQueue(queueName, {
        durable: false,
        exclusive: true,
        autoDelete: true
    });
    const cache = new LRUCache<string, T>(options.LRUCacheOptions);
    await subscriberChannel.bindQueue(queueName, exchangeName, '');
    const consumer = await subscriberChannel.consume(queueName, (msg: ConsumeMessage | null) => {
        if (msg === null) {
            // TODO: handle msg null scenario
            return;
        }
        const publisherCacheId = msg.properties.headers["x-cache-id"];
        if (publisherCacheId === cacheId) {
            return;
        }
        const content = msg.content.toString();
        if (content === 'reset') {
            cache.reset();
        } else if (content.startsWith('del:')) {
            const key = content.substring(4);
            cache.del(key);
        }
    }, { exclusive: true, noAck: true });

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
        publisherChannel.publish(exchangeName, '', Buffer.from(message), { headers: {
            'x-cache-id': cacheId
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
            publish('reset');
            cache.reset();
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
        set: assertIsClosingOrClosedDecorator(cache.set.bind(cache)),
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
            await subscriberChannel.cancel(consumer.consumerTag);
            await Promise.all([
                subscriberChannel.close(),
                publisherChannel.close()
            ]);
            await connection.close();
            cache.reset();
        }
    };
}