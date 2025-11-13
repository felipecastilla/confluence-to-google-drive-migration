import {promises as fsPromises} from 'fs';
import path from 'path';

export async function readFile(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    return fsPromises.readFile(filePath, {encoding});
}

export async function readFileBuffer(filePath: string): Promise<Buffer> {
    return fsPromises.readFile(filePath);
}

export async function writeFile(filePath: string, data: string | Buffer): Promise<void> {
    await ensureDir(path.dirname(filePath));
    await fsPromises.writeFile(filePath, data as any);
}

export async function ensureDir(dirPath: string): Promise<void> {
    await fsPromises.mkdir(dirPath, {recursive: true});
}

export async function removeDir(dirPath: string): Promise<void> {
    if (!(await pathExists(dirPath))) {
        return;
    }

    await fsPromises.rm(dirPath, {recursive: true, force: true});
}

export async function pathExists(targetPath: string): Promise<boolean> {
    try {
        await fsPromises.access(targetPath);
        return true;
    } catch (error) {
        return false;
    }
}

export async function copyDir(source: string, destination: string): Promise<void> {
    if (!(await pathExists(source))) {
        return;
    }

    await ensureDir(destination);
    const cp = (fsPromises as unknown as {cp?: typeof fsPromises.cp}).cp;
    if (typeof cp === 'function') {
        await cp(source, destination, {recursive: true});
        return;
    }

    const entries = await fsPromises.readdir(source, {withFileTypes: true});
    for (const entry of entries) {
        const srcPath = path.join(source, entry.name);
        const destPath = path.join(destination, entry.name);
        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath);
        } else {
            await ensureDir(path.dirname(destPath));
            await fsPromises.copyFile(srcPath, destPath);
        }
    }
}
