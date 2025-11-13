# confluence-to-google-drive-migration

Scripts to help you migrate your Confluence documents to Google Drive.

Because Google Drive supports viewing and editing `.docx` files, we export the Confluence space to Word, clean up the hierarchy locally, and then upload the files to Google Drive.

## Prerequisites

- [Node.js](https://nodejs.org/) 16 or later
- [Yarn](https://yarnpkg.com/) (this project uses the Yarn 4 node-modules linker)

Install the dependencies once:

```bash
yarn install
```

Build the TypeScript sources whenever you change the code or before running the CLI:

```bash
yarn build
```

## Environment configuration

The project loads credentials and runtime configuration from a `.env` file. Start from the provided template and fill in your values:

```bash
cp .env.example .env
```

### Atlassian Cloud credentials

The migration script downloads each page via the Confluence **exportword** endpoint. Atlassian Cloud requires Basic authentication with an API token.

1. Log in to [https://id.atlassian.com/manage/api-tokens](https://id.atlassian.com/manage/api-tokens) and create a new token.
2. Note the email address associated with your Atlassian account.
3. Update your `.env` file:
   - `ATLASSIAN_BASE_URL` — your site URL (e.g. `https://your-domain.atlassian.net`).
   - `ATLASSIAN_EMAIL` — the email address from step 2.
   - `ATLASSIAN_API_TOKEN` — the API token created in step 1.

The script also reads `ATLASSIAN_EXPORT_PATH` (defaults to `confluence-export`) to locate the Word export bundle you downloaded from Confluence:

1. Export your Confluence space as “Word” using the procedure described in the [Atlassian documentation](https://community.atlassian.com/t5/Confluence-questions/Migrating-Data-from-confluence-to-google-Drive/qaq-p/1297000).
2. Place the resulting folder (containing `index.html` and attachments) inside this project directory under the name configured in `ATLASSIAN_EXPORT_PATH`.

### Google Drive credentials

All Drive interactions use the official [`googleapis`](https://www.npmjs.com/package/googleapis) SDK. The recommended setup is a **service account** with domain-wide delegation (or a standard service account for personal Drives).

1. Visit the [Google Cloud Console](https://console.cloud.google.com/) and create a new project or select an existing one.
2. Enable the **Google Drive API** for the project.
3. In **APIs & Services → Credentials**, create a **Service Account**. Download the JSON key file and store it **outside of version control**.
4. Share the destination Drive folder with the service account (or grant domain-wide delegation if using a Workspace domain).
5. Update your `.env` file:
   - `GOOGLE_APPLICATION_CREDENTIALS` — absolute or relative path to the downloaded JSON key file.
   - `GOOGLE_AUTH_SCOPES` — comma-separated scopes; defaults to `https://www.googleapis.com/auth/drive.file`.
   - `GOOGLE_DRIVE_PARENT_FOLDER_ID` — optional Drive folder ID to use as the migration root.

> ⚠️  Never commit the `.env` file or raw credential JSON to your repository. The `.gitignore` file already excludes common secrets, but always verify before pushing.

## CLI usage

After building the project you can invoke the CLI directly from the compiled output or through the convenience script:

```bash
# list available commands
yarn ctogdm --help

# list all pages detected in the Confluence export index
yarn ctogdm list

# download every page as a .doc file using the Confluence export API
yarn ctogdm download

# render the downloaded documents into the structured output directory
yarn ctogdm render

# perform download, render, and attachment sync in a single step
yarn ctogdm sync
```

The CLI reads the environment variables documented above at runtime. The default directories are:

- `ATLASSIAN_EXPORT_PATH` — folder containing the HTML export bundle (defaults to `confluence-export`).
- `ATLASSIAN_DOWNLOAD_PATH` — target directory for downloaded `.doc` files (defaults to `downloaded-pages`).
- `ATLASSIAN_OUTPUT_PATH` — final structured output directory (defaults to `output`).

## Programmatic usage

The core migration workflow is exposed through the `ExportPipeline` class. The factory `createExportPipeline` configures all
dependencies from the environment, so you can integrate the pipeline into your own scripts:

```ts
import {createExportPipeline} from './dist/pipeline/export-pipeline';

async function main(): Promise<void> {
  const pipeline = createExportPipeline();

  const pages = await pipeline.listPages();
  console.log(`Found ${pages.length} top-level pages`);

  await pipeline.downloadPages(pages);
  await pipeline.renderPages(pages);
  await pipeline.syncAttachments();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
```

If you prefer to provide custom implementations or override paths programmatically, instantiate `ExportPipeline` directly with
your own clients, exporters, and `FileWriter`.

## Migration workflow overview

1. Clone this repository and install dependencies.
2. Configure your `.env` file as described above.
3. Export your Confluence space to Word and copy the bundle to the folder specified by `ATLASSIAN_EXPORT_PATH`.
4. Run the CLI commands (or call the pipeline programmatically) to list, download, and render the pages.
5. Convert the rendered documents to `.docx` if desired (for example, using [this batch conversion method](https://www.extendoffice.com/documents/word/5601-word-batch-convert-doc-to-docx.html)).
6. Upload the final files to Google Drive using the SDK authenticated via your service account credentials.

## Limitations

- Attachments that are not images will not be exported. Widgets that Word export does not support are also omitted.
- Confluence page titles containing slashes (`/`) are invalid in most file systems; rename them before starting the migration.
