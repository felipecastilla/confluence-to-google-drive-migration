process.env.ATLASSIAN_BASE_URL = process.env.ATLASSIAN_BASE_URL || 'https://example.atlassian.net';
process.env.ATLASSIAN_EMAIL = process.env.ATLASSIAN_EMAIL || 'user@example.com';
process.env.ATLASSIAN_API_TOKEN = process.env.ATLASSIAN_API_TOKEN || 'token';
process.env.ATLASSIAN_EXPORT_PATH = process.env.ATLASSIAN_EXPORT_PATH || 'confluence-export';
process.env.ATLASSIAN_DOWNLOAD_PATH = process.env.ATLASSIAN_DOWNLOAD_PATH || 'downloaded-pages';
process.env.ATLASSIAN_OUTPUT_PATH = process.env.ATLASSIAN_OUTPUT_PATH || 'output';

jest.mock('p-limit', () => {
    const createLimit = (concurrency: number) => {
        if (!Number.isFinite(concurrency) || concurrency < 1) {
            throw new TypeError('Expected `concurrency` to be a number from 1 and up');
        }

        let currentConcurrency = Math.floor(concurrency);
        let activeCount = 0;
        const queue: Array<() => void> = [];

        const next = () => {
            if (queue.length === 0) {
                return;
            }

            if (activeCount >= currentConcurrency) {
                return;
            }

            const run = queue.shift();
            if (!run) {
                return;
            }

            activeCount += 1;
            run();
        };

        const enqueue = (fn: () => Promise<unknown>, resolve: (value: unknown) => void, reject: (error: unknown) => void) => {
            queue.push(async () => {
                try {
                    const value = await fn();
                    resolve(value);
                } catch (error) {
                    reject(error);
                } finally {
                    activeCount -= 1;
                    next();
                }
            });

            Promise.resolve().then(next);
        };

        const limit = (<Arguments extends unknown[], ReturnType>(
            fn: (...args: Arguments) => PromiseLike<ReturnType> | ReturnType,
            ...args: Arguments
        ) =>
            new Promise<ReturnType>((resolve, reject) => {
                enqueue(
                    () => Promise.resolve(fn(...args)),
                    resolve as (value: unknown) => void,
                    reject as (error: unknown) => void,
                );
            })) as unknown as import('p-limit').LimitFunction;

        Object.defineProperties(limit, {
            activeCount: {get: () => activeCount},
            pendingCount: {get: () => queue.length},
            concurrency: {
                get: () => currentConcurrency,
                set: (value: number) => {
                    if (!Number.isFinite(value) || value < 1) {
                        throw new TypeError('Expected `concurrency` to be a number from 1 and up');
                    }

                    currentConcurrency = Math.floor(value);
                    Promise.resolve().then(next);
                },
            },
        });

        (limit as import('p-limit').LimitFunction).clearQueue = () => {
            queue.length = 0;
        };

        (limit as import('p-limit').LimitFunction).map = async <Input, ReturnType>(
            iterable: Iterable<Input>,
            mapper: (input: Input, index: number) => PromiseLike<ReturnType> | ReturnType,
        ) => {
            const items = Array.from(iterable);
            return Promise.all(items.map((item, index) => limit(() => mapper(item, index))));
        };

        return limit;
    };

    return {
        __esModule: true,
        default: createLimit,
    };
});
