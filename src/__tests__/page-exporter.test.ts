import {promises as fs} from 'fs';
import os from 'os';
import path from 'path';
import {HtmlToDocxPageExporter} from '../services/page-exporter';
import {FileWriter} from '../services/file-writer';
import {ConfluencePage} from '../types/confluence';
import {DocumentConverter} from '../services/libreoffice-converter';
import {PageReader} from '../types/confluence';

async function createTempDir(prefix: string): Promise<string> {
    return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe('HtmlToDocxPageExporter', () => {
    it('converts exported HTML pages into docx files preserving hierarchy', async () => {
        const outputDir = await createTempDir('output-');
        const fileWriter = new FileWriter();
        const pagesToContent = new Map<string, Buffer>();
        const reader: PageReader = {
            readPage: jest.fn(async page => {
                const content = pagesToContent.get(page.id);
                if (!content) {
                    throw new Error('missing content');
                }
                return content;
            }),
        };
        const converter: DocumentConverter = {
            convertHtmlToDocx: jest.fn(async buffer => Buffer.from(`${buffer.toString()}-docx`)),
        };
        const exporter = new HtmlToDocxPageExporter(fileWriter, reader, converter, {
            outputDir,
            outputExtension: 'docx',
        });

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

        pagesToContent.set('111', Buffer.from('root'));
        pagesToContent.set('222', Buffer.from('child'));

        await expect(exporter.renderPages(pages)).resolves.toBeUndefined();

        expect(converter.convertHtmlToDocx).toHaveBeenCalledTimes(2);
        const rootFile = await fs.readFile(path.join(outputDir, '1. Root', '1. Root.docx'), 'utf8');
        const childFile = await fs.readFile(path.join(outputDir, '1. Root', 'Child.docx'), 'utf8');

        expect(rootFile).toEqual('root-docx');
        expect(childFile).toEqual('child-docx');
    });

    it('limits concurrent conversions according to configuration', async () => {
        const outputDir = await createTempDir('output-');
        const fileWriter = new FileWriter();
        const pages: ConfluencePage[] = Array.from({length: 4}).map((_, index) => ({
            name: `Page ${index}`,
            id: `${index}`,
            file: `Page_${index}.html`,
            children: [],
        }));

        const reader: PageReader = {
            readPage: jest.fn(async page => Buffer.from(`content-${page.id}`)),
        };

        let activeConversions = 0;
        let maxConcurrency = 0;
        const converter: DocumentConverter = {
            convertHtmlToDocx: jest.fn(async buffer => {
                activeConversions += 1;
                maxConcurrency = Math.max(maxConcurrency, activeConversions);
                await new Promise(resolve => setTimeout(resolve, 10));
                activeConversions -= 1;
                return Buffer.from(buffer);
            }),
        };

        const cpusSpy = jest.spyOn(os, 'cpus').mockReturnValue(
            Array.from({length: 4}).map(() => ({
                model: 'test',
                speed: 1,
                times: {user: 0, nice: 0, sys: 0, idle: 0, irq: 0},
            })),
        );

        const exporter = new HtmlToDocxPageExporter(fileWriter, reader, converter, {
            outputDir,
            outputExtension: 'docx',
            conversionConcurrency: 2,
        });

        await exporter.renderPages(pages);

        cpusSpy.mockRestore();

        expect(maxConcurrency).toBeLessThanOrEqual(2);
        expect(converter.convertHtmlToDocx).toHaveBeenCalledTimes(pages.length);
    });
});
