import os from 'os';
import path from 'path';
import pLimit, {LimitFunction} from 'p-limit';
import {ConfluencePage, PageExporter} from '../types/confluence';
import {FileWriter} from './file-writer';
import {getPageFileBaseName} from '../utils/page';
import {DocumentConverter} from './libreoffice-converter';

export interface PageExporterOptions {
    downloadDir: string;
    outputDir: string;
    documentExtension?: string;
    outputExtension?: string;
    conversionConcurrency?: number;
}

export class DocxPageExporter implements PageExporter {
    private readonly sourceExtension: string;
    private readonly outputExtension: string;
    private readonly conversionQueue: LimitFunction;

    constructor(
        private readonly fileWriter: FileWriter,
        private readonly converter: DocumentConverter,
        private readonly options: PageExporterOptions,
    ) {
        const cpuCount = Math.max(os.cpus()?.length ?? 1, 1);
        const concurrency = this.options.conversionConcurrency ?? cpuCount;
        this.conversionQueue = pLimit(Math.max(1, Math.min(cpuCount, concurrency)));
        this.sourceExtension = options.documentExtension || 'doc';
        this.outputExtension = options.outputExtension || 'docx';
    }

    async renderPages(pages: ConfluencePage[], baseDir: string = this.options.outputDir): Promise<void> {
        await this.fileWriter.ensureDir(baseDir);
        await Promise.all(pages.map(page => this.processPage(page, baseDir)));
    }

    private async processPage(page: ConfluencePage, baseDir: string): Promise<void> {
        if (page.children.length > 0) {
            const nestedDir = path.join(baseDir, page.name);
            await this.fileWriter.ensureDir(nestedDir);
            await Promise.all([
                this.queueConversion(page, nestedDir),
                Promise.all(page.children.map(child => this.processPage(child, nestedDir))),
            ]);
            return;
        }

        await this.queueConversion(page, baseDir);
    }

    private async queueConversion(page: ConfluencePage, destinationDir: string): Promise<void> {
        await this.fileWriter.ensureDir(destinationDir);
        await this.conversionQueue(() => this.writeSinglePage(page, destinationDir));
    }

    private async writeSinglePage(page: ConfluencePage, destinationDir: string): Promise<void> {
        const sourceFileName = `${getPageFileBaseName(page)}.${this.sourceExtension}`;
        const sourcePath = path.join(this.options.downloadDir, sourceFileName);
        const destinationPath = path.join(destinationDir, `${page.name}.${this.outputExtension}`);

        if (!(await this.fileWriter.pathExists(sourcePath))) {
            throw new Error(`Missing downloaded page for ${page.name} at ${sourcePath}`);
        }

        const buffer = await this.fileWriter.readBuffer(sourcePath);
        const converted = await this.converter.convertMhtmlToDocx(buffer);
        await this.fileWriter.writeBuffer(destinationPath, converted);
    }
}
