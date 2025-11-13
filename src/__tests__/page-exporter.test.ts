import {promises as fs} from 'fs';
import os from 'os';
import path from 'path';
import {DocxPageExporter} from '../services/page-exporter';
import {FileWriter} from '../services/file-writer';
import {ConfluencePage} from '../types/confluence';

async function createTempDir(prefix: string): Promise<string> {
    return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe('DocxPageExporter', () => {
    it('writes pages into nested directories preserving hierarchy', async () => {
        const downloadDir = await createTempDir('downloads-');
        const outputDir = await createTempDir('output-');
        const fileWriter = new FileWriter();
        const exporter = new DocxPageExporter(fileWriter, {downloadDir, outputDir, documentExtension: 'doc'});

        const pages: ConfluencePage[] = [
            {
                name: '1. Root',
                id: '111',
                file: 'Page_111.html',
                children: [
                    {
                        name: 'Child',
                        id: '222',
                        file: 'Child_222.html',
                        children: [],
                    },
                ],
            },
        ];

        await fs.writeFile(path.join(downloadDir, 'Page_111.doc'), 'root');
        await fs.writeFile(path.join(downloadDir, 'Child_222.doc'), 'child');

        await exporter.renderPages(pages);

        const rootFile = await fs.readFile(path.join(outputDir, '1. Root', '1. Root.doc'), 'utf8');
        const childFile = await fs.readFile(path.join(outputDir, '1. Root', 'Child.doc'), 'utf8');

        expect(rootFile).toEqual('root');
        expect(childFile).toEqual('child');
    });
});
