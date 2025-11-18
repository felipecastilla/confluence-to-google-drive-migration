import path from 'path';
import {promises as fs} from 'fs';
import {execFile} from 'child_process';
import {LibreOfficeConverter} from '../services/libreoffice-converter';

jest.mock('child_process', () => ({
    execFile: jest.fn(),
}));

const execFileMock = execFile as jest.MockedFunction<typeof execFile>;

describe('LibreOfficeConverter', () => {
    const accessSpy = jest.spyOn(fs, 'access');
    const documentBuffer = Buffer.from('content');
    const convertedBuffer = Buffer.from('converted');
    const originalEnvPath = process.env.LIBRE_OFFICE_EXE;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.LIBRE_OFFICE_EXE = '/fake/path/soffice';
        accessSpy.mockReset();
        accessSpy.mockResolvedValue();
    });

    afterAll(() => {
        process.env.LIBRE_OFFICE_EXE = originalEnvPath;
        accessSpy.mockRestore();
    });

    it('invokes the soffice CLI and returns the converted buffer', async () => {
        execFileMock.mockImplementation((_cmd, argsOrOptions, maybeCallback) => {
            const args = (Array.isArray(argsOrOptions) ? argsOrOptions : []) as string[];
            const callbackCandidate = typeof maybeCallback === 'function' ? maybeCallback : argsOrOptions;
            if (typeof callbackCandidate !== 'function') {
                throw new Error('Missing callback in execFile mock');
            }

            const callback = callbackCandidate as (
                error: Error | null,
                stdout: string,
                stderr: string,
            ) => void;
            const outDirIndex = args.indexOf('--outdir');
            const outDir = args[outDirIndex + 1] as string;
            const resultPath = path.join(outDir, 'source.docx');
            fs.writeFile(resultPath, convertedBuffer).then(() => callback(null, '', '')).catch(error => {
                callback(error as Error, '', '');
            });
            return undefined as never;
        });

        const converter = new LibreOfficeConverter('test-');
        const result = await converter.convertHtmlToDocx(documentBuffer);

        expect(accessSpy).toHaveBeenCalledWith('/fake/path/soffice');
        expect(execFileMock).toHaveBeenCalledTimes(1);
        const [binaryPath, args] = execFileMock.mock.calls[0];
        expect(binaryPath).toBe('/fake/path/soffice');
        expect(args).toContain('--convert-to');
        expect(args).toContain('docx');
        expect(args).toContain('--infilter=HTML (StarWriter)');
        expect(result.equals(convertedBuffer)).toBe(true);
    });

    it('throws when the soffice binary cannot be found', async () => {
        process.env.LIBRE_OFFICE_EXE = '/missing/soffice';
        accessSpy.mockRejectedValue(new Error('not found'));
        execFileMock.mockImplementation(() => undefined as never);

        const converter = new LibreOfficeConverter('test-');

        await expect(converter.convertHtmlToDocx(documentBuffer)).rejects.toThrow('Could not find soffice binary');
        expect(execFileMock).not.toHaveBeenCalled();
    });
});
