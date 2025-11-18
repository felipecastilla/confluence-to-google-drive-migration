import {promises as fs} from 'fs';
import os from 'os';
import path from 'path';
import {execFile} from 'child_process';
import {pathToFileURL} from 'url';

export interface DocumentConverter {
    convertMhtmlToDocx(document: Buffer): Promise<Buffer>;
}

export class LibreOfficeConverter implements DocumentConverter {
    private sofficeBinary: Promise<string> | null = null;

    constructor(private readonly tmpPrefix = 'ctogdm-') {}

    async convertMhtmlToDocx(document: Buffer): Promise<Buffer> {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), this.tmpPrefix));
        const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), `${this.tmpPrefix}profile-`));
        const sourcePath = path.join(tempDir, 'source.mhtml');
        const outputCandidates = this.buildOutputCandidates(tempDir, sourcePath);

        try {
            await fs.writeFile(sourcePath, document);
            await this.runLibreOfficeConversion(sourcePath, tempDir, profileDir);
            return await this.readConvertedDocument(outputCandidates);
        } finally {
            await fs.rm(profileDir, {recursive: true, force: true});
            await fs.rm(tempDir, {recursive: true, force: true});
        }
    }

    private buildOutputCandidates(outputDir: string, sourcePath: string): string[] {
        const baseName = path.basename(sourcePath);
        const parsed = path.parse(sourcePath);
        const strippedName = parsed.name;
        return [
            path.join(outputDir, `${strippedName}.docx`),
            path.join(outputDir, `${baseName}.docx`),
        ];
    }

    private async readConvertedDocument(possiblePaths: string[]): Promise<Buffer> {
        for (const outputPath of possiblePaths) {
            try {
                return await fs.readFile(outputPath);
            } catch {
                // try next candidate
            }
        }

        throw new Error('LibreOffice conversion produced no output file');
    }

    private async runLibreOfficeConversion(inputPath: string, outputDir: string, profileDir: string): Promise<void> {
        const sofficePath = await this.getSofficeBinary();
        const userInstallationArg = `-env:UserInstallation=${pathToFileURL(profileDir).href}`;
        const args = [
            userInstallationArg,
            '--headless',
            '--convert-to',
            'docx',
            '--infilter=HTML (StarWriter)',
            '--outdir',
            outputDir,
            inputPath,
        ];

        await new Promise<void>((resolve, reject) => {
            execFile(sofficePath, args, (error, _stdout, stderr) => {
                if (error) {
                    reject(new Error(`LibreOffice conversion failed: ${error.message}`));
                    return;
                }

                if (stderr && stderr.toLowerCase().includes('error')) {
                    reject(new Error(`LibreOffice reported an error: ${stderr.trim()}`));
                    return;
                }

                resolve();
            });
        });
    }

    private async getSofficeBinary(): Promise<string> {
        if (!this.sofficeBinary) {
            this.sofficeBinary = this.resolveSofficeBinary();
        }

        return this.sofficeBinary;
    }

    private async resolveSofficeBinary(): Promise<string> {
        const candidates = this.buildBinaryCandidateList();
        for (const candidate of candidates) {
            if (!candidate) {
                continue;
            }

            if (!path.isAbsolute(candidate)) {
                return candidate;
            }

            try {
                await fs.access(candidate);
                return candidate;
            } catch {
                continue;
            }
        }

        throw new Error('Could not find soffice binary. Install LibreOffice or set LIBRE_OFFICE_EXE.');
    }

    private buildBinaryCandidateList(): string[] {
        const envBinary = process.env.LIBRE_OFFICE_EXE || '';
        const baseCandidates = envBinary ? [envBinary] : [];

        switch (process.platform) {
            case 'darwin':
                baseCandidates.push('/Applications/LibreOffice.app/Contents/MacOS/soffice');
                break;
            case 'linux':
                baseCandidates.push(
                    '/usr/bin/libreoffice',
                    '/usr/bin/soffice',
                    '/snap/bin/libreoffice',
                    '/opt/libreoffice/program/soffice',
                    '/opt/libreoffice7.6/program/soffice',
                );
                break;
            case 'win32':
                baseCandidates.push(
                    path.join(process.env['PROGRAMFILES(X86)'] || '', 'LibreOffice/program/soffice.exe'),
                    path.join(process.env.PROGRAMFILES_X86 || '', 'LibreOffice/program/soffice.exe'),
                    path.join(process.env.PROGRAMFILES || '', 'LibreOffice/program/soffice.exe'),
                    'C:/Program Files/LibreOffice/program/soffice.exe',
                );
                break;
            default:
                throw new Error(`Operating system not yet supported: ${process.platform}`);
        }

        return baseCandidates.filter(candidate => candidate.trim().length > 0);
    }
}
