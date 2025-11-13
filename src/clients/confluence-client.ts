import axios, {AxiosInstance} from 'axios';
import path from 'path';
import {HTMLElement, parse} from 'node-html-parser';
import {ConfluenceClient, ConfluencePage} from '../types/confluence';
import {readFile} from '../utils/fs';

export interface ConfluenceClientConfig {
    exportPath: string;
    baseUrl: string;
    email: string;
    apiToken: string;
}

export class HtmlExportConfluenceClient implements ConfluenceClient {
    private readonly indexPath: string;

    constructor(private readonly config: ConfluenceClientConfig, private readonly httpClient: AxiosInstance = axios.create()) {
        this.indexPath = path.join(this.config.exportPath, 'index.html');
    }

    async getPageTree(): Promise<ConfluencePage[]> {
        const indexContent = await readFile(this.indexPath);
        const parsedHtml = parse(indexContent);
        const rootUlElement = parsedHtml.querySelector('ul');
        if (!rootUlElement) {
            return [];
        }

        const tree = this.parseList(rootUlElement, 0);
        return tree.children;
    }

    async downloadPage(page: ConfluencePage): Promise<Buffer> {
        const pageUrl = new URL(`/wiki/exportword?pageId=${page.id}`, this.config.baseUrl).toString();
        const authorizationHeader = `Basic ${Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString('base64')}`;
        const response = await this.httpClient.get<ArrayBuffer>(pageUrl, {
            headers: {
                Authorization: authorizationHeader,
            },
            responseType: 'arraybuffer',
        });

        return Buffer.from(response.data);
    }

    getAttachmentsDirectory(): string | null {
        return path.join(this.config.exportPath, 'attachments');
    }

    private parseList(ulElement: HTMLElement, index: number): ConfluencePage {
        const listChildren = ulElement.childNodes.filter(node => node instanceof HTMLElement) as HTMLElement[];
        if (listChildren.length === 0) {
            throw new Error('Invalid export index: missing list item element');
        }

        const liElement = listChildren[0];
        const anchorElement = liElement.querySelector('a');
        if (!anchorElement) {
            throw new Error('Invalid export index: missing anchor element');
        }

        const innerElements = liElement.childNodes.filter(
            node => node instanceof HTMLElement && (node as HTMLElement).rawTagName === 'ul',
        ) as HTMLElement[];

        const page: ConfluencePage = {
            name: `${index + 1}. ${anchorElement.innerText.trim()}`,
            id: this.extractPageId(anchorElement.getAttribute('href') || ''),
            file: anchorElement.getAttribute('href') || '',
            children: [],
        };

        if (innerElements.length > 0) {
            page.children = innerElements.map((element, childIndex) => this.parseList(element, childIndex));
        }

        return page;
    }

    private extractPageId(href: string): string {
        const hrefSegments = href.split('_');
        const lastSegment = hrefSegments[hrefSegments.length - 1];
        return lastSegment.split('.')[0];
    }
}
