import {promises as fs} from 'fs';
import os from 'os';
import path from 'path';
import {promisify} from 'util';
import libreOfficeConvert from '@shelf/libreoffice-convert';

type ConvertWithOptions = (
    document: Buffer,
    format: string,
    filter: string | undefined,
    options: {fileName?: string},
    callback: (error: Error | null, result: Buffer) => void,
) => void;

const convertAsync = promisify(
    (libreOfficeConvert as {convertWithOptions: ConvertWithOptions}).convertWithOptions.bind(libreOfficeConvert),
) as (document: Buffer, format: string, filter?: string | null, options?: {fileName?: string}) => Promise<Buffer>;

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
            return await convertAsync(sourceBuffer, '.docx', undefined, {fileName: path.basename(sourcePath)});
        } finally {
            await fs.rm(tempDir, {recursive: true, force: true});
        }
    }
}
