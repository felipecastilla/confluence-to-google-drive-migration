import {ConfluencePage} from '../types/confluence';

export function getPageFileBaseName(page: ConfluencePage): string {
    const segments = page.file.split('.');
    if (segments.length === 1) {
        return page.file;
    }

    segments.pop();
    return segments.join('.');
}
