import {promises as fs} from 'fs';
import os from 'os';
import path from 'path';
import {ExportPipeline} from '../pipeline/export-pipeline';
import {ConfluenceClient, ConfluencePage, PageExporter} from '../types/confluence';
import {FileWriter} from '../services/file-writer';

async function createTempDir(prefix: string): Promise<string> {
    return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

class StubClient implements ConfluenceClient {
    constructor(private readonly pages: ConfluencePage[], private readonly documentContents: Buffer, private readonly attachmentsDir: string | null) {}

    async getPageTree(): Promise<ConfluencePage[]> {
        return this.pages;
    }

    async downloadPage(): Promise<Buffer> {
        return this.documentContents;
    }

    getAttachmentsDirectory(): string | null {
        return this.attachmentsDir;
    }
}

class StubExporter implements PageExporter {
    renderPages = jest.fn(async () => undefined);
}

describe('ExportPipeline', () => {
    it('downloads pages, renders output, and syncs attachments', async () => {
        const downloadDir = await createTempDir('pipeline-downloads-');
        const outputDir = await createTempDir('pipeline-output-');
        const attachmentsSourceDir = path.join(await createTempDir('pipeline-attachments-'), 'attachments');
        await fs.mkdir(attachmentsSourceDir, {recursive: true});
        await fs.writeFile(path.join(attachmentsSourceDir, 'file.txt'), 'attachment');

        const pages: ConfluencePage[] = [
            {name: 'Root', id: '1', file: 'Root_1.html', children: []},
        ];
        const client = new StubClient(pages, Buffer.from('doc'), attachmentsSourceDir);
        const exporter = new StubExporter();
        const fileWriter = new FileWriter();
        const pipeline = new ExportPipeline(client, exporter, fileWriter, {
            downloadDir,
            outputDir,
            attachmentsSourceDir,
            attachmentsOutputDir: path.join(outputDir, 'attachments'),
            documentExtension: 'doc',
        });

        await pipeline.downloadPages();
        const downloadPath = path.join(downloadDir, 'Root_1.doc');
        expect(await fs.readFile(downloadPath, 'utf8')).toEqual('doc');

        await pipeline.renderPages();
        expect(exporter.renderPages).toHaveBeenCalledWith(pages, outputDir);

        await pipeline.syncAttachments();
        const attachmentPath = path.join(outputDir, 'attachments', 'file.txt');
        expect(await fs.readFile(attachmentPath, 'utf8')).toEqual('attachment');
    });
});
