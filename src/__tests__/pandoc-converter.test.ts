import {promises as fs} from 'fs';
import {execFile} from 'child_process';
import {PandocConverter} from '../services/pandoc-converter';

jest.mock('child_process', () => ({
    execFile: jest.fn(),
}));

const execFileMock = execFile as jest.MockedFunction<typeof execFile>;

describe('PandocConverter', () => {
    const documentBuffer = Buffer.from('<html><body><img src="attachments/123/file.png" /></body></html>');

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('invokes pandoc with a working directory pointing to the export path', async () => {
        execFileMock.mockImplementation((_cmd, argsOrOptions, optionsOrCallback, maybeCallback) => {
            const callbackCandidate =
                typeof maybeCallback === 'function'
                    ? maybeCallback
                    : typeof optionsOrCallback === 'function'
                        ? optionsOrCallback
                        : null;

            if (!callbackCandidate) {
                throw new Error('Missing callback');
            }

            const args = (Array.isArray(argsOrOptions) ? argsOrOptions : []) as string[];
            const outputIndex = args.indexOf('--output');
            const outputPath = args[outputIndex + 1] as string;
            fs.writeFile(outputPath, Buffer.from('converted')).then(() => {
                (callbackCandidate as (err: Error | null, stdout: string, stderr: string) => void)(null, '', '');
            });
            return undefined as never;
        });

        const converter = new PandocConverter('test-');
        const result = await converter.convertHtmlToDocx(documentBuffer, {
            workingDirectory: '/exports/site',
            inputFileName: 'Page_123.html',
        });

        expect(execFileMock).toHaveBeenCalledTimes(1);
        const [binary, args, options] = execFileMock.mock.calls[0];
        expect(binary).toBe('pandoc');
        expect(args).toContain('--resource-path');
        expect(args).toContain('/exports/site');
        expect(options?.cwd).toBe('/exports/site');
        expect(result.toString()).toBe('converted');
    });

    it('throws a descriptive error when pandoc is missing', async () => {
        execFileMock.mockImplementation((_cmd, _argsOrOptions, optionsOrCallback, maybeCallback) => {
            const callbackCandidate =
                typeof maybeCallback === 'function'
                    ? maybeCallback
                    : typeof optionsOrCallback === 'function'
                        ? optionsOrCallback
                        : null;

            if (!callbackCandidate) {
                throw new Error('Missing callback');
            }

            const error = new Error('spawn pandoc ENOENT') as NodeJS.ErrnoException;
            error.code = 'ENOENT';
            (callbackCandidate as (err: NodeJS.ErrnoException) => void)(error);
            return undefined as never;
        });

        const converter = new PandocConverter('test-');

        await expect(
            converter.convertHtmlToDocx(documentBuffer, {workingDirectory: '/exports/site', inputFileName: 'page.html'}),
        ).rejects.toThrow('Pandoc is not available');
    });
});
