import os from 'os';
import path from 'path';
import pLimit, {LimitFunction} from 'p-limit';
import {ConfluencePage, PageExporter, PageReader} from '../types/confluence';
import {FileWriter} from './file-writer';
import {DocumentConverter} from './libreoffice-converter';

export interface PageExporterOptions {
    outputDir: string;
    outputExtension?: string;
    conversionConcurrency?: number;
}

export class HtmlToDocxPageExporter implements PageExporter {
    private readonly outputExtension: string;
    private readonly conversionQueue: LimitFunction;

    constructor(
        private readonly fileWriter: FileWriter,
        private readonly pageReader: PageReader,
        private readonly converter: DocumentConverter,
        private readonly options: PageExporterOptions,
    ) {
        const cpuCount = Math.max(os.cpus()?.length ?? 1, 1);
        const concurrency = this.options.conversionConcurrency ?? cpuCount;
        this.conversionQueue = pLimit(Math.max(1, Math.min(cpuCount, concurrency)));
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
        const destinationPath = path.join(destinationDir, `${page.name}.${this.outputExtension}`);
        const buffer = await this.pageReader.readPage(page);
        const converted = await this.converter.convertHtmlToDocx(buffer);
        await this.fileWriter.writeBuffer(destinationPath, converted);
    }
}
