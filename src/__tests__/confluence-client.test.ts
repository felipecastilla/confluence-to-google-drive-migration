import path from 'path';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import {HtmlExportConfluenceClient} from '../clients/confluence-client';
import {ConfluencePage} from '../types/confluence';

const fixturePath = path.resolve(__dirname, 'fixtures', 'export');

describe('HtmlExportConfluenceClient', () => {
    it('parses the exported index into a tree', async () => {
        const client = new HtmlExportConfluenceClient({
            exportPath: fixturePath,
            baseUrl: 'https://example.atlassian.net',
            email: 'user@example.com',
            apiToken: 'token',
        });

        const pages = await client.getPageTree();
        expect(pages).toHaveLength(1);
        const [root] = pages;
        expect(root.name).toContain('Root Page');
        expect(root.children).toHaveLength(1);
        expect(root.children[0].name).toContain('Child Page');
    });

    it('downloads pages using the authenticated API', async () => {
        const mock = new MockAdapter(axios);
        const client = new HtmlExportConfluenceClient(
            {
                exportPath: fixturePath,
                baseUrl: 'https://example.atlassian.net',
                email: 'user@example.com',
                apiToken: 'token',
            },
            axios,
        );

        const page: ConfluencePage = {
            name: 'Sample',
            id: '123',
            file: 'Sample_123.html',
            children: [],
        };

        mock.onGet('https://example.atlassian.net/wiki/exportword?pageId=123').reply(200, Buffer.from('data'), {
            'Content-Type': 'application/msword',
        });

        const buffer = await client.downloadPage(page);
        expect(Buffer.isBuffer(buffer)).toBe(true);
        expect(buffer.toString()).toEqual('data');
        mock.restore();
    });
});
