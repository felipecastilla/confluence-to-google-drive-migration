#!/usr/bin/env node
import {Command} from 'commander';
import {createExportPipeline, ExportPipeline} from '../pipeline/export-pipeline';
import {ConfluencePage} from '../types/confluence';

function formatPageTree(pages: ConfluencePage[], depth = 0): string {
    return pages
        .map(page => {
            const indent = '  '.repeat(depth);
            const children = page.children.length > 0 ? `\n${formatPageTree(page.children, depth + 1)}` : '';
            return `${indent}- ${page.name}${children}`;
        })
        .join('\n');
}

async function runWithPipeline(action: (pipeline: ExportPipeline) => Promise<void>): Promise<void> {
    try {
        const pipeline = createExportPipeline();
        await action(pipeline);
    } catch (error) {
        console.error(error);
        process.exitCode = 1;
    }
}

export function buildCli(): Command {
    const program = new Command();

    program
        .name('ctogdm')
        .description('Confluence to Google Drive migration utilities');

    program
        .command('list')
        .description('List pages available in the Confluence export index')
        .action(() =>
            runWithPipeline(async pipeline => {
                const pages = await pipeline.listPages();
                console.log(formatPageTree(pages));
            }),
        );

    program
        .command('download')
        .description('Download Confluence pages using the export API')
        .action(() =>
            runWithPipeline(async pipeline => {
                await pipeline.downloadPages();
            }),
        );

    program
        .command('render')
        .description('Render downloaded pages into the output directory')
        .action(() =>
            runWithPipeline(async pipeline => {
                await pipeline.renderPages();
            }),
        );

    program
        .command('attachments')
        .alias('sync')
        .description('Copy attachments from the Confluence export into the output directory')
        .action(() =>
            runWithPipeline(async pipeline => {
                await pipeline.syncAttachments();
            }),
        );

    return program;
}

if (require.main === module) {
    void buildCli().parseAsync(process.argv);
}
