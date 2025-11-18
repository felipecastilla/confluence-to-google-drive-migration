import path from 'path';
import {ConfluencePage, PageContent, PageReader} from '../types/confluence';
import {readFileBuffer} from '../utils/fs';

export class HtmlPageReader implements PageReader {
    constructor(private readonly exportPath: string) {}

    async readPage(page: ConfluencePage): Promise<PageContent> {
        const pagePath = path.join(this.exportPath, page.file);
        return {
            buffer: await readFileBuffer(pagePath),
            workingDirectory: this.exportPath,
            fileName: path.basename(page.file),
        };
    }
}
