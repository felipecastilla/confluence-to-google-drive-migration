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
    constructor(private readonly pages: ConfluencePage[], private readonly attachmentsDir: string | null) {}

    async getPageTree(): Promise<ConfluencePage[]> {
        return this.pages;
    }

    getAttachmentsDirectory(): string | null {
        return this.attachmentsDir;
    }
}

class StubExporter implements PageExporter {
    renderPages = jest.fn(async () => undefined);
}

describe('ExportPipeline', () => {
    it('renders output and nests attachments next to each page using the page id', async () => {
        const outputDir = await createTempDir('pipeline-output-');
        const attachmentsSourceDir = path.join(await createTempDir('pipeline-attachments-'), 'attachments');
        await fs.mkdir(path.join(attachmentsSourceDir, '1'), {recursive: true});
        await fs.mkdir(path.join(attachmentsSourceDir, '2'), {recursive: true});
        await fs.writeFile(path.join(attachmentsSourceDir, '1', 'root.txt'), 'root-attachment');
        await fs.writeFile(path.join(attachmentsSourceDir, '2', 'child.txt'), 'child-attachment');

        const pages: ConfluencePage[] = [
            {
                name: 'Root',
                id: '1',
                file: 'Root_1.html',
                children: [{name: 'Child', id: '2', file: 'Child_2.html', children: []}],
            },
        ];
        const client = new StubClient(pages, attachmentsSourceDir);
        const exporter = new StubExporter();
        const fileWriter = new FileWriter();
        const pipeline = new ExportPipeline(client, exporter, fileWriter, {
            outputDir,
            attachmentsSourceDir,
            attachmentsOutputDir: path.join(outputDir, 'attachments'),
        });

        await pipeline.renderPages();
        expect(exporter.renderPages).toHaveBeenCalledWith(pages, outputDir);

        await pipeline.syncAttachments();
        const rootAttachmentPath = path.join(outputDir, 'Root', 'attachments', '1', 'root.txt');
        const childAttachmentPath = path.join(outputDir, 'Root', 'attachments', '2', 'child.txt');

        expect(await fs.readFile(rootAttachmentPath, 'utf8')).toEqual('root-attachment');
        expect(await fs.readFile(childAttachmentPath, 'utf8')).toEqual('child-attachment');
    });

    it('syncs attachments without requiring prior render steps', async () => {
        const outputDir = await createTempDir('pipeline-output-');
        const attachmentsSourceDir = path.join(await createTempDir('pipeline-attachments-'), 'attachments');
        await fs.mkdir(path.join(attachmentsSourceDir, '1'), {recursive: true});
        await fs.writeFile(path.join(attachmentsSourceDir, '1', 'file.txt'), 'attachment');

        const pages: ConfluencePage[] = [{name: 'Root', id: '1', file: 'Root_1.html', children: []}];
        const client = new StubClient(pages, attachmentsSourceDir);
        const exporter = new StubExporter();
        const fileWriter = new FileWriter();
        const pipeline = new ExportPipeline(client, exporter, fileWriter, {
            outputDir,
            attachmentsSourceDir,
            attachmentsOutputDir: path.join(outputDir, 'attachments'),
        });

        await pipeline.syncAttachments();

        const attachmentPath = path.join(outputDir, 'attachments', '1', 'file.txt');
        expect(await fs.readFile(attachmentPath, 'utf8')).toEqual('attachment');
        expect(exporter.renderPages).not.toHaveBeenCalled();
    });
});
