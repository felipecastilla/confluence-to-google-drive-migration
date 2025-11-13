export interface ConfluencePage {
    name: string;
    id: string;
    file: string;
    children: ConfluencePage[];
}

export interface ConfluenceClient {
    getPageTree(): Promise<ConfluencePage[]>;
    downloadPage(page: ConfluencePage): Promise<Buffer>;
    getAttachmentsDirectory(): string | null;
}

export interface PageExporter {
    renderPages(pages: ConfluencePage[], baseDir?: string): Promise<void>;
}
