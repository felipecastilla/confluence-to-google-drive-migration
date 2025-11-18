import path from 'path';
import {HtmlExportConfluenceClient} from '../clients/confluence-client';

const fixturePath = path.resolve(__dirname, 'fixtures', 'export');

describe('HtmlExportConfluenceClient', () => {
    it('parses the exported index into a tree', async () => {
        const client = new HtmlExportConfluenceClient({
            exportPath: fixturePath,
        });

        const pages = await client.getPageTree();
        expect(pages).toHaveLength(1);
        const [root] = pages;
        expect(root.name).toContain('Root Page');
        expect(root.children).toHaveLength(1);
        expect(root.children[0].name).toContain('Child Page');
    });
});
