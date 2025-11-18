import path from 'path';
import {ConfluenceClient, ConfluencePage, PageExporter, PageReader} from '../types/confluence';
import {FileWriter} from '../services/file-writer';
import {ATLASSIAN_EXPORT_PATH, LIBREOFFICE_CONVERSION_CONCURRENCY, OUTPUT_PATH} from '../config/env';
import {HtmlExportConfluenceClient} from '../clients/confluence-client';
import {HtmlToDocxPageExporter} from '../services/page-exporter';
import {LibreOfficeConverter} from '../services/libreoffice-converter';
import {HtmlPageReader} from '../services/html-page-reader';

export interface ExportPipelineOptions {
    outputDir: string;
    attachmentsSourceDir?: string | null;
    attachmentsOutputDir?: string;
}

export class ExportPipeline {
    private cachedPages: ConfluencePage[] | null = null;

    constructor(
        private readonly client: ConfluenceClient,
        private readonly exporter: PageExporter,
        private readonly fileWriter: FileWriter,
        private readonly options: ExportPipelineOptions,
    ) {}

    async listPages(): Promise<ConfluencePage[]> {
        if (!this.cachedPages) {
            this.cachedPages = await this.client.getPageTree();
        }

        return this.cachedPages;
    }

    async renderPages(pages?: ConfluencePage[]): Promise<void> {
        const tree = pages || (await this.listPages());
        await this.fileWriter.removeDir(this.options.outputDir);
        await this.exporter.renderPages(tree, this.options.outputDir);
    }

    async syncAttachments(): Promise<void> {
        if (!this.options.attachmentsSourceDir) {
            return;
        }

        const destination = this.options.attachmentsOutputDir || path.join(this.options.outputDir, 'attachments');
        await this.fileWriter.removeDir(destination);
        await this.fileWriter.copyDir(this.options.attachmentsSourceDir, destination);
    }
}

export function createExportPipeline(): ExportPipeline {
    const fileWriter = new FileWriter();
    const client = new HtmlExportConfluenceClient({
        exportPath: ATLASSIAN_EXPORT_PATH,
    });

    const converter = new LibreOfficeConverter();
    const pageReader: PageReader = new HtmlPageReader(ATLASSIAN_EXPORT_PATH);
    const exporter = new HtmlToDocxPageExporter(fileWriter, pageReader, converter, {
        outputDir: OUTPUT_PATH,
        outputExtension: 'docx',
        conversionConcurrency: LIBREOFFICE_CONVERSION_CONCURRENCY,
    });

    return new ExportPipeline(client, exporter, fileWriter, {
        outputDir: OUTPUT_PATH,
        attachmentsSourceDir: client.getAttachmentsDirectory(),
        attachmentsOutputDir: path.join(OUTPUT_PATH, 'attachments'),
    });
}
