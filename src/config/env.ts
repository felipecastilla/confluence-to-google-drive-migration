import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value || value.trim().length === 0) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

export const ATLASSIAN_BASE_URL = process.env.ATLASSIAN_BASE_URL || '';
export const ATLASSIAN_EMAIL = process.env.ATLASSIAN_EMAIL || '';
export const ATLASSIAN_API_TOKEN = process.env.ATLASSIAN_API_TOKEN || '';

export const ATLASSIAN_EXPORT_PATH = process.env.ATLASSIAN_EXPORT_PATH
    ? path.resolve(process.cwd(), process.env.ATLASSIAN_EXPORT_PATH)
    : path.resolve(process.cwd(), 'confluence-export');

export const DOWNLOAD_PATH = process.env.ATLASSIAN_DOWNLOAD_PATH
    ? path.resolve(process.cwd(), process.env.ATLASSIAN_DOWNLOAD_PATH)
    : path.resolve(process.cwd(), 'downloaded-pages');

export const OUTPUT_PATH = process.env.ATLASSIAN_OUTPUT_PATH
    ? path.resolve(process.cwd(), process.env.ATLASSIAN_OUTPUT_PATH)
    : path.resolve(process.cwd(), 'output');

export const GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';
export const GOOGLE_AUTH_SCOPES = process.env.GOOGLE_AUTH_SCOPES || 'https://www.googleapis.com/auth/drive.file';
export const GOOGLE_DRIVE_PARENT_FOLDER_ID = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || '';
