declare module '@shelf/libreoffice-convert' {
    interface LibreOfficeAsyncOptions {
        times?: number;
        interval?: number;
    }

    interface LibreOfficeTmpOptions {
        prefix?: string;
        postfix?: string;
        dir?: string;
        unsafeCleanup?: boolean;
    }

    interface LibreOfficeExecOptions {
        [key: string]: unknown;
    }

    interface LibreOfficeOptions {
        fileName?: string;
        tmpOptions?: LibreOfficeTmpOptions;
        asyncOptions?: LibreOfficeAsyncOptions;
        execOptions?: LibreOfficeExecOptions;
        sofficeBinaryPaths?: string[];
    }

    function convert(
        document: Buffer,
        format: string,
        filter: string | undefined,
        callback: (error: Error | null, result: Buffer) => void,
    ): void;

    function convertWithOptions(
        document: Buffer,
        format: string,
        filter: string | undefined,
        options: LibreOfficeOptions,
        callback: (error: Error | null, result: Buffer) => void,
    ): void;

    const libreOfficeConvert: {
        convert: typeof convert;
        convertWithOptions: typeof convertWithOptions;
    };

    export default libreOfficeConvert;
}
