import path from 'path';
import {ensureDir, pathExists, readFileBuffer, removeDir, writeFile, copyDir} from '../utils/fs';

export class FileWriter {
    async writeFile(filePath: string, data: string | Buffer): Promise<void> {
        await writeFile(filePath, data);
    }

    async writeBuffer(filePath: string, data: Buffer): Promise<void> {
        await writeFile(filePath, data);
    }

    async readBuffer(filePath: string): Promise<Buffer> {
        return readFileBuffer(filePath);
    }

    async ensureDir(dirPath: string): Promise<void> {
        await ensureDir(dirPath);
    }

    async removeDir(dirPath: string): Promise<void> {
        await removeDir(dirPath);
    }

    async pathExists(targetPath: string): Promise<boolean> {
        return pathExists(targetPath);
    }

    async copyDir(source: string, destination: string): Promise<void> {
        await copyDir(source, destination);
    }

    async ensureParentDir(filePath: string): Promise<void> {
        const dir = path.dirname(filePath);
        await ensureDir(dir);
    }
}
