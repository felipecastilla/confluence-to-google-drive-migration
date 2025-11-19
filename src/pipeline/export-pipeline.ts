import path from 'path';
import {ConfluenceClient, ConfluencePage, PageExporter, PageReader} from '../types/confluence';
import {FileWriter} from '../services/file-writer';
import {ATLASSIAN_EXPORT_PATH, OUTPUT_PATH} from '../config/env';
import {HtmlExportConfluenceClient} from '../clients/confluence-client';
import {HtmlToDocxPageExporter} from '../services/page-exporter';
import {PandocConverter} from '../services/pandoc-converter';
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

        const pages = await this.listPages();
        const attachmentsFolderName = this.getAttachmentsFolderName();
        await Promise.all(pages.map(page => this.syncPageAttachments(page, this.options.outputDir, attachmentsFolderName)));
    }

    private async syncPageAttachments(
        page: ConfluencePage,
        baseDir: string,
        attachmentsFolderName: string,
    ): Promise<void> {
        const pageDir = page.children.length > 0 ? path.join(baseDir, page.name) : baseDir;
        await this.copyAttachments(page, pageDir, attachmentsFolderName);
        await Promise.all(page.children.map(child => this.syncPageAttachments(child, pageDir, attachmentsFolderName)));
    }

    private async copyAttachments(page: ConfluencePage, pageDir: string, attachmentsFolderName: string): Promise<void> {
        const source = path.join(this.options.attachmentsSourceDir!, page.id);
        if (!(await this.fileWriter.pathExists(source))) {
            return;
        }

        const destination = path.join(pageDir, attachmentsFolderName, page.id);
        await this.fileWriter.removeDir(destination);
        await this.fileWriter.copyDir(source, destination);
    }

    private getAttachmentsFolderName(): string {
        if (this.options.attachmentsOutputDir) {
            return path.basename(this.options.attachmentsOutputDir);
        }

        return 'attachments';
    }
}

export function createExportPipeline(): ExportPipeline {
    const fileWriter = new FileWriter();
    const client = new HtmlExportConfluenceClient({
        exportPath: ATLASSIAN_EXPORT_PATH,
    });

    const converter = new PandocConverter();
    const pageReader: PageReader = new HtmlPageReader(ATLASSIAN_EXPORT_PATH);
    const exporter = new HtmlToDocxPageExporter(fileWriter, pageReader, converter, {
        outputDir: OUTPUT_PATH,
        outputExtension: 'docx',
    });

    return new ExportPipeline(client, exporter, fileWriter, {
        outputDir: OUTPUT_PATH,
        attachmentsSourceDir: client.getAttachmentsDirectory(),
        attachmentsOutputDir: path.join(OUTPUT_PATH, 'attachments'),
    });
}
