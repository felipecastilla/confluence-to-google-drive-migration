import path from 'path';
import {ConfluencePage, PageExporter} from '../types/confluence';
import {FileWriter} from './file-writer';
import {getPageFileBaseName} from '../utils/page';

export interface PageExporterOptions {
    downloadDir: string;
    outputDir: string;
    documentExtension?: string;
}

export class DocxPageExporter implements PageExporter {
    private readonly extension: string;

    constructor(private readonly fileWriter: FileWriter, private readonly options: PageExporterOptions) {
        this.extension = options.documentExtension || 'doc';
    }

    async renderPages(pages: ConfluencePage[], baseDir: string = this.options.outputDir): Promise<void> {
        await this.fileWriter.ensureDir(baseDir);
        for (const page of pages) {
            if (page.children.length > 0) {
                const nestedDir = path.join(baseDir, page.name);
                await this.fileWriter.ensureDir(nestedDir);
                await this.writeSinglePage(page, nestedDir);
                await this.renderPages(page.children, nestedDir);
            } else {
                await this.writeSinglePage(page, baseDir);
            }
        }
    }

    private async writeSinglePage(page: ConfluencePage, destinationDir: string): Promise<void> {
        const sourceFileName = `${getPageFileBaseName(page)}.${this.extension}`;
        const sourcePath = path.join(this.options.downloadDir, sourceFileName);
        const destinationPath = path.join(destinationDir, `${page.name}.${this.extension}`);

        if (!(await this.fileWriter.pathExists(sourcePath))) {
            throw new Error(`Missing downloaded page for ${page.name} at ${sourcePath}`);
        }

        const buffer = await this.fileWriter.readBuffer(sourcePath);
        await this.fileWriter.writeBuffer(destinationPath, buffer);
    }
}
