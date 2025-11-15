import {promises as fs} from 'fs';
import os from 'os';
import path from 'path';
import libreOfficeConvert from '@shelf/libreoffice-convert';

const convertWithOptions = (
    document: Buffer,
    format: string,
    filter?: string | null,
    options?: {fileName?: string},
): Promise<Buffer> =>
    new Promise((resolve, reject) => {
        (libreOfficeConvert as unknown as {
            convertWithOptions: (
                document: Buffer,
                format: string,
                filter: string | null | undefined,
                options: {fileName?: string} | undefined,
                callback: (error: Error | null, result: Buffer) => void,
            ) => void;
        }).convertWithOptions(document, format, filter ?? undefined, options, (error, result) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(result);
        });
    });

export interface DocumentConverter {
    convertMhtmlToDocx(document: Buffer): Promise<Buffer>;
}

export class LibreOfficeConverter implements DocumentConverter {
    constructor(private readonly tmpPrefix = 'ctogdm-') {}

    async convertMhtmlToDocx(document: Buffer): Promise<Buffer> {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), this.tmpPrefix));
        const sourcePath = path.join(tempDir, 'source.mhtml');

        try {
            await fs.writeFile(sourcePath, document);
            const sourceBuffer = await fs.readFile(sourcePath);
            const tempFileName = path.basename(sourcePath);
            return await convertWithOptions(sourceBuffer, 'docx', undefined, {fileName: tempFileName});
        } finally {
            await fs.rm(tempDir, {recursive: true, force: true});
        }
    }
}
