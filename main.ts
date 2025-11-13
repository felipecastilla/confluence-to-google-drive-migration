import {MakeDirectoryOptions, Mode, PathLike, PathOrFileDescriptor, WriteFileOptions} from "fs";
import axios from 'axios';
import * as path from 'path';
import {ATLASSIAN_API_TOKEN, ATLASSIAN_BASE_URL, ATLASSIAN_EMAIL, ATLASSIAN_EXPORT_PATH} from './config/env';
const fs = require('fs');
const ncp = require('ncp');
const http = require('http');
import {HTMLElement, parse} from 'node-html-parser';
import * as _ from "lodash";

interface IConfluencePage {
    name: string;
    id: string;
    file: string;
    children: IConfluencePage[] | null;
}

async function readFile(file: string): Promise<string> {
    return new Promise((resolve, reject) => {
        fs.readFile(file, 'utf8', (err, data) => {
            if (data) {
                resolve(data);
            } else {
                reject(err);
            }
        })
    })
}

async function writeFile(file: PathOrFileDescriptor, data: string | NodeJS.ArrayBufferView, options: WriteFileOptions = 'utf8'): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.writeFile(file, data, options, (err) => {
            if (!err) {
                resolve();
            } else {
                reject(err);
            }
        })
    })
}

async function mkdir(path: PathLike, options: Mode | MakeDirectoryOptions | null | undefined = null): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.mkdir(path, options, (err) => {
            if (!err) {
                resolve();
            } else {
                reject(err);
            }
        })
    })
}

async function getConfluencePages(): Promise<IConfluencePage[]> {
    const indexPath = path.join(ATLASSIAN_EXPORT_PATH, 'index.html');
    const file: string = await readFile(indexPath);
    const parsedHtml: HTMLElement = parse(file);
    const rootUlElement = parsedHtml.querySelector('ul');

    return parseList(rootUlElement, 0).children;

    function parseList(ulElement: HTMLElement, index: number): IConfluencePage {
        // every ulElement has a single child li element. This li element might contain 0 or multiple ulElements.
        // @ts-ignore
        const liElement: HTMLElement = ulElement.childNodes.filter(node => node instanceof HTMLElement)[0];
        const anchorElement: HTMLElement = liElement.querySelector('a');
        // @ts-ignore
        let innerUlElementList: HTMLElement[] = liElement.childNodes.filter(node => node instanceof HTMLElement && node.rawTagName === 'ul');
        return {
            name: `${index + 1}. ${anchorElement.innerText.trim()}`,
            id: _.last(anchorElement.getAttribute('href').split('_')).split('.')[0],
            file: anchorElement.getAttribute('href'),
            children: !!innerUlElementList && !!innerUlElementList.length ? innerUlElementList.map((element: HTMLElement, index: number) => parseList(element, index)) : null,
        }
    }
}

function removeElement(htmlElementToRemove: HTMLElement) {
    htmlElementToRemove.parentNode.removeChild(htmlElementToRemove);
}

function removeElementByQuery(htmlElement: HTMLElement, query: string): void {
    const element = htmlElement.querySelector(query);
    if (!element) {
        return;
    }
    removeElement(element);
}

function writeConfluencePages(confluencePages: IConfluencePage[], currentPath: string = 'output', depth = 0): void {
    console.log(currentPath);
    for (let confluencePage of confluencePages) {
        if (!confluencePage.children) {
            try {
                const file = fs.readFileSync(`downloaded-pages/${confluencePage.file.split('.')[0]}.docx`);
                // const parsedHTML: HTMLElement = parse(file);
                // removeElementByQuery(parsedHTML, '#footer');
                // removeElementByQuery(parsedHTML, '#main-header');
                // removeElementByQuery(parsedHTML, '.page-metadata');
                // removeElementByQuery(parsedHTML, '.pageSection');
                // if (depth > 0) {
                //     const imgElementList = parsedHTML.querySelectorAll('img');
                //     for (let imgElement of imgElementList) {
                //         const src = imgElement.getAttribute('src');
                //         imgElement.setAttribute('src', '../'.repeat(depth - 1) + src);
                //     }
                // }

                const pathToFile: string[] = `${currentPath}/${confluencePage.name}`.split('/');
                const fileName: string = pathToFile.pop();
                const pathToFileContainingFolder = pathToFile.join('/');
                if (!fs.existsSync(pathToFileContainingFolder)){
                    fs.mkdirSync(pathToFileContainingFolder, {recursive: true});
                }
                // todo: files that ended with number did not get the html postfix.
                fs.writeFileSync(`${__dirname}/${pathToFileContainingFolder}/${fileName}.docx`, file);
            } catch(err) {
                console.error(err);
            }
        } else {
            writeConfluencePages([
                {
                    name: confluencePage.name,
                    file: confluencePage.file,
                    id: confluencePage.id,
                    children: null,
                },
                ...confluencePage.children,
            ], `${currentPath}/${confluencePage.name}`, depth++)
        }
    }
}

async function downloadPage(confluencePage: IConfluencePage): Promise<void> {
    console.log('downloading page', confluencePage.name);
    try {
        const pageUrl = new URL(`/wiki/exportword?pageId=${confluencePage.id}`, ATLASSIAN_BASE_URL).toString();
        const authorizationHeader = `Basic ${Buffer.from(`${ATLASSIAN_EMAIL}:${ATLASSIAN_API_TOKEN}`).toString('base64')}`;
        const data = (await axios.get(
            pageUrl,
            {
                headers: {
                    Authorization: authorizationHeader,
                },
                responseType: 'arraybuffer',
            },
        )).data

        fs.writeFileSync(`downloaded-pages/${confluencePage.file.split('.')[0]}.doc`, data);
    } catch (e) {
        console.error(`Failed for ${confluencePage.id}`);
    }
}

async function downloadPages(confluencePageList: IConfluencePage[]): Promise<void> {
    for (let page of confluencePageList) {
        await downloadPage(page);
        if (page.children) {
            await downloadPages(page.children);
        }
    }
}

(async () => {
    fs.rmdirSync('output', {recursive: true});
    const confluencePages = await getConfluencePages();
    // await writeConfluencePages(confluencePages);
    // await new Promise<void>((resolve, reject) => ncp('confluence-export/attachments', 'output/attachments', err => {
    //    if (!err) {
    //        resolve();
    //    }  else {
    //        reject(err);
    //    }
    // }));
    // await downloadPages(confluencePages);
    await writeConfluencePages(confluencePages);

    console.log('completed'); // todo
})();