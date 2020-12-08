# rabbit-lru-cache
A lib to invalidate lru cache keys in distributed systems powered by rabbitmq.

[ ![Npm Version](https://badge.fury.io/js/rabbit-lru-cache.svg)](https://www.npmjs.com/package/rabbit-lru-cache)
[![Actions Status](https://github.com/francescorivola/rabbit-lru-cache/workflows/Node%20CI/badge.svg)](https://github.com/francescorivola/rabbit-lru-cache/actions)
[![CodeFactor](https://www.codefactor.io/repository/github/francescorivola/rabbit-lru-cache/badge)](https://www.codefactor.io/repository/github/francescorivola/rabbit-lru-cache)
[![codecov](https://codecov.io/gh/francescorivola/rabbit-lru-cache/branch/master/graph/badge.svg)](https://codecov.io/gh/francescorivola/rabbit-lru-cache)
[![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=francescorivola/rabbit-lru-cache)](https://dependabot.com)

## Installation

` npm install --save rabbit-lru-cache `

## Getting Started

This library is powered by lru-cache and amqplib (both peer dependencies).

```js
const createRabbitLRUCache = require("rabbit-lru-cache").default;

const cache = await createRabbitLRUCache({
    name: "example",
    LRUCacheOptions: {
        maxAge: 120000
    },
    amqpConnectOptions: {
        hostname: "localhost",
        username: "guest",
        password: "guest"
    }
});
cache.addInvalidationMessageReceivedListener((content, publisherCacheId) => {
    console.log("Cache Message", "publisherCacheId", publisherCacheId, "content", content);
});
cache.addReconnectingListener((error, attempt, retryInterval) => {
    console.log("Reconnecting", error.message, "attempt", attempt, "retryInterval", retryInterval);
});
cache.addReconnectedListener((error, attempt, retryInterval) => {
    console.log("Reconnected", error.message, "attempt", attempt, "retryInterval", retryInterval);
});
    
await cache.getOrLoad("key", () => Promise.resolve(5));
cache.del("key");

await cache.close(); // gracefully shutdown RabbitMq connection
```

Every time the lru-cache **del** or **reset** function is called a message is published in a fan out exchange and each cache subscribers consume the message to invalidate the corresponding key or the entire cache.

The **getOrLoad** function forces you to set item in cache only after loading it, avoiding a wrong usage of the library as, for instance, set in cache an item after modifying it instead of invalidate the cache (calling the **del** function). Finally, this function comes with concurrency mechanism to avoid stale data and [Thundering herd problem](https://en.wikipedia.org/wiki/Thundering_herd_problem) by use the same promise for concurrent requests of the same cache key while the corresponding item is not loaded in cache yet.

The lib handles RabbitMq connection errors and it reconnects automatically if the connection with the broker got lost. During reconnection the local cache get resetted and cache is disabled to ensure it does not store stale data.

## Examples

Examples of the usage of this lib can be found in test folder or [examples](./examples) folder.

## License

MIT
