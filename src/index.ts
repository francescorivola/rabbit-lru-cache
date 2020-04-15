import { 
    createRabbitLRUCache, 
    RabbitLRUCache as RabbitLRUCacheType, 
    RabbitLRUCacheOptions as RabbitLRUCacheOptionsType 
} from "./rabbit-lru-cache";

export type RabbitLRUCache<T> = RabbitLRUCacheType<T>;
export type RabbitLRUCacheOptions<T> = RabbitLRUCacheOptionsType<T>;
export default createRabbitLRUCache;
