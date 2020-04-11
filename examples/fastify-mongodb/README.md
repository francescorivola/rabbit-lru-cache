# rabbit-lru-cache example with fastify and mongodb

Here is an about 80 lines code example of this cache library used in a fastify server with mongodb as database.

This examples provides also a docker-compose that runs this server in 3 instances behind an nginx load balancer available at http://localhost:8080.

Http requests responses have the custom header **X-Server-Id** to identify which server is serving each request. Also, get requests responses have the custom header **X-Cache** with value **HIT** and **MISS** to let you know if the request hits the cache or not.

## Run the example

From this folder run the following commands:
```
npm ci                    # install dependencies
docker-compose up -d      # run server in a distributed system
node client.js            # run client that perform requests against the server
```