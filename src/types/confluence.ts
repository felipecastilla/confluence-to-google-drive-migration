export interface ConfluencePage {
    name: string;
    id: string;
    file: string;
    children: ConfluencePage[];
}

export interface ConfluenceClient {
    getPageTree(): Promise<ConfluencePage[]>;
    getAttachmentsDirectory(): string | null;
}

export interface PageExporter {
    renderPages(pages: ConfluencePage[], baseDir?: string): Promise<void>;
}

export interface PageContent {
    buffer: Buffer;
    workingDirectory?: string;
    fileName?: string;
}

export interface PageReader {
    readPage(page: ConfluencePage): Promise<PageContent>;
}
