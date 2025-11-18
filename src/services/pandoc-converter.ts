import {promises as fs} from 'fs';
import os from 'os';
import path from 'path';
import {execFile} from 'child_process';
import {HtmlToDocxConverter, HtmlToDocxOptions} from './html-to-docx-converter';

export class PandocConverter implements HtmlToDocxConverter {
    constructor(private readonly tmpPrefix = 'ctogdm-') {}

    async convertHtmlToDocx(document: Buffer, options: HtmlToDocxOptions = {}): Promise<Buffer> {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), this.tmpPrefix));
        const inputFileName = options.inputFileName ? path.basename(options.inputFileName) : 'source.html';
        const inputPath = path.join(tempDir, inputFileName);
        const outputPath = path.join(tempDir, `${path.parse(inputFileName).name}.docx`);
        const workingDirectory = options.workingDirectory || tempDir;

        try {
            await fs.writeFile(inputPath, document);
            await this.runPandoc(inputPath, outputPath, workingDirectory);
            return await fs.readFile(outputPath);
        } catch (error) {
            const err = error as NodeJS.ErrnoException;
            if (err?.code === 'ENOENT') {
                throw new Error('Pandoc is not available. Please install pandoc and ensure it is on the PATH.');
            }
            throw err;
        } finally {
            await fs.rm(tempDir, {recursive: true, force: true});
        }
    }

    private async runPandoc(inputPath: string, outputPath: string, workingDirectory: string): Promise<void> {
        const args = ['--from', 'html', '--to', 'docx', '--output', outputPath, '--resource-path', workingDirectory, inputPath];

        await new Promise<void>((resolve, reject) => {
            execFile('pandoc', args, {cwd: workingDirectory}, (error, _stdout, stderr) => {
                if (error) {
                    const enrichedError = new Error(`Pandoc conversion failed: ${error.message}`) as NodeJS.ErrnoException;
                    enrichedError.code = (error as NodeJS.ErrnoException).code;
                    reject(enrichedError);
                    return;
                }

                if (stderr && stderr.trim().length > 0) {
                    reject(new Error(`Pandoc reported an error: ${stderr.trim()}`));
                    return;
                }

                resolve();
            });
        });
    }
}
