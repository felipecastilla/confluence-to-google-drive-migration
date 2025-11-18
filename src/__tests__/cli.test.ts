import {Command} from 'commander';
import {buildCli} from '../cli/index';
import {ExportPipeline} from '../pipeline/export-pipeline';

describe('CLI commands', () => {
    let command: Command;
    const syncAttachments = jest.fn(async () => undefined);
    const renderPages = jest.fn(async () => undefined);

    beforeEach(() => {
        jest.spyOn(require('../pipeline/export-pipeline'), 'createExportPipeline').mockReturnValue({
            renderPages,
            syncAttachments,
        } as unknown as ExportPipeline);
        command = buildCli();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        syncAttachments.mockClear();
        renderPages.mockClear();
    });

    it('invokes only syncAttachments when running the attachments command', async () => {
        await command.parseAsync(['node', 'ctogdm', 'attachments']);

        expect(syncAttachments).toHaveBeenCalledTimes(1);
        expect(renderPages).not.toHaveBeenCalled();
    });

    it('supports the legacy sync alias for attachments', async () => {
        await command.parseAsync(['node', 'ctogdm', 'sync']);

        expect(syncAttachments).toHaveBeenCalledTimes(1);
    });

    it('runs render when requested', async () => {
        await command.parseAsync(['node', 'ctogdm', 'render']);

        expect(renderPages).toHaveBeenCalledTimes(1);
        expect(syncAttachments).not.toHaveBeenCalled();
    });
});
