export interface HtmlToDocxOptions {
    workingDirectory?: string;
    inputFileName?: string;
}

export interface HtmlToDocxConverter {
    convertHtmlToDocx(document: Buffer, options?: HtmlToDocxOptions): Promise<Buffer>;
}
