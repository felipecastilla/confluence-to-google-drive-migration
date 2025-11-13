import path from 'path';
import {ConfluenceClient, ConfluencePage, PageExporter} from '../types/confluence';
import {FileWriter} from '../services/file-writer';
import {getPageFileBaseName} from '../utils/page';
import {ATLASSIAN_API_TOKEN, ATLASSIAN_BASE_URL, ATLASSIAN_EMAIL, ATLASSIAN_EXPORT_PATH, DOWNLOAD_PATH, OUTPUT_PATH} from '../config/env';
import {HtmlExportConfluenceClient} from '../clients/confluence-client';
import {DocxPageExporter} from '../services/page-exporter';

export interface ExportPipelineOptions {
    downloadDir: string;
    outputDir: string;
    attachmentsSourceDir?: string | null;
    attachmentsOutputDir?: string;
    documentExtension?: string;
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

    async downloadPages(pages?: ConfluencePage[]): Promise<void> {
        const documentExtension = this.options.documentExtension || 'doc';
        const tree = pages || (await this.listPages());
        await this.fileWriter.ensureDir(this.options.downloadDir);
        await this.downloadRecursive(tree, documentExtension);
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

    private async downloadRecursive(pages: ConfluencePage[], extension: string): Promise<void> {
        for (const page of pages) {
            const buffer = await this.client.downloadPage(page);
            const targetFileName = `${getPageFileBaseName(page)}.${extension}`;
            const targetFilePath = path.join(this.options.downloadDir, targetFileName);
            await this.fileWriter.writeBuffer(targetFilePath, buffer);

            if (page.children.length > 0) {
                await this.downloadRecursive(page.children, extension);
            }
        }
    }
}

export function createExportPipeline(): ExportPipeline {
    const fileWriter = new FileWriter();
    const client = new HtmlExportConfluenceClient({
        exportPath: ATLASSIAN_EXPORT_PATH,
        baseUrl: ATLASSIAN_BASE_URL,
        email: ATLASSIAN_EMAIL,
        apiToken: ATLASSIAN_API_TOKEN,
    });

    const exporter = new DocxPageExporter(fileWriter, {
        downloadDir: DOWNLOAD_PATH,
        outputDir: OUTPUT_PATH,
        documentExtension: 'doc',
    });

    return new ExportPipeline(client, exporter, fileWriter, {
        downloadDir: DOWNLOAD_PATH,
        outputDir: OUTPUT_PATH,
        attachmentsSourceDir: client.getAttachmentsDirectory(),
        attachmentsOutputDir: path.join(OUTPUT_PATH, 'attachments'),
        documentExtension: 'doc',
    });
}
