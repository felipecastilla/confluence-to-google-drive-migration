import path from 'path';
import {ConfluencePage, PageReader} from '../types/confluence';
import {readFileBuffer} from '../utils/fs';

export class HtmlPageReader implements PageReader {
    constructor(private readonly exportPath: string) {}

    async readPage(page: ConfluencePage): Promise<Buffer> {
        const pagePath = path.join(this.exportPath, page.file);
        return readFileBuffer(pagePath);
    }
}
