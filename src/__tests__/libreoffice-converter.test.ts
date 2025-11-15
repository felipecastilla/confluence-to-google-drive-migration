import {LibreOfficeConverter} from '../services/libreoffice-converter';

jest.mock('@shelf/libreoffice-convert', () => ({
    convertWithOptions: jest.fn(),
}));

const {convertWithOptions: convertWithOptionsMock} = jest.requireMock('@shelf/libreoffice-convert') as {
    convertWithOptions: jest.Mock;
};

describe('LibreOfficeConverter', () => {
    beforeEach(() => {
        convertWithOptionsMock.mockReset();
    });

    it('invokes convertWithOptions with a base filename and docx format', async () => {
        const converter = new LibreOfficeConverter('test-');
        const document = Buffer.from('content');
        const converted = Buffer.from('converted');

        convertWithOptionsMock.mockResolvedValue(converted);

        const result = await converter.convertMhtmlToDocx(document);

        expect(result).toBe(converted);
        expect(convertWithOptionsMock).toHaveBeenCalledTimes(1);
        const [bufferArg, formatArg, filterArg, optionsArg] = convertWithOptionsMock.mock.calls[0];

        expect(bufferArg.equals(document)).toBe(true);
        expect(formatArg).toBe('docx');
        expect(filterArg).toBeUndefined();
        expect(optionsArg).toEqual({fileName: 'source'});
    });
});
