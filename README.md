# confluence-to-google-drive-migration

Scripts to help you migrate your Confluence documents to Google Drive.

Because Google Drive supports viewing and editing `.docx` files, we convert the Confluence **HTML export** locally and then upload the files to Google Drive.

## Prerequisites

- [Node.js](https://nodejs.org/) 24 or later
- [Yarn](https://yarnpkg.com/) (this project uses the Yarn 4 node-modules linker)
- [Pandoc](https://pandoc.org/) 3.0 or later (must be available on your `PATH`)

The document conversion step shells out to the `pandoc` binary. Install it with your platform's package manager or grab the
latest release from the [Pandoc installation guide](https://pandoc.org/installing.html). Ensure `pandoc` is discoverable on
your `PATH` before running the CLI.

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

### Atlassian Cloud export bundle

The migration script reads the static HTML bundle exported from Confluence (no authenticated API calls are required). Point `ATLASSIAN_EXPORT_PATH` (defaults to `confluence-export`) at the unzipped export folder containing **`index.html`**, all page HTML files referenced from that index, and the **`attachments/`** directory created by Confluence. The folder layout should look like:

```
confluence-export/
├── index.html               # page tree used by the pipeline to discover pages
├── <page>.html              # HTML for each page listed in index.html
└── attachments/             # Confluence’s exported attachments
    └── <page-id>/           # subfolders and filenames match the export bundle
```

The `render` step reads the HTML files directly from `ATLASSIAN_EXPORT_PATH` (no download step exists). When attachments are present in the export, the `attachments` command copies the entire `attachments/` tree to `${ATLASSIAN_OUTPUT_PATH}/attachments`, preserving the directory structure from the export bundle.

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

# render the exported HTML documents from ATLASSIAN_EXPORT_PATH into .docx files under ATLASSIAN_OUTPUT_PATH
yarn ctogdm render

# copy attachments from the Confluence export bundle into ATLASSIAN_OUTPUT_PATH/attachments
yarn ctogdm attachments

# legacy alias for the attachments command
yarn ctogdm sync
```

> ℹ️  The `render` command converts the existing HTML files in `ATLASSIAN_EXPORT_PATH`; it does not download or fetch additional content. The `attachments` command only copies files from the export bundle.

The CLI reads the environment variables documented above at runtime. The default directories are:

- `ATLASSIAN_EXPORT_PATH` — folder containing the HTML export bundle (defaults to `confluence-export`).
- `ATLASSIAN_OUTPUT_PATH` — final structured output directory (defaults to `output`). The exporter mirrors the page hierarchy
  from `index.html` into nested folders using the numbered names generated from the export.

## Programmatic usage

The core migration workflow is exposed through the `ExportPipeline` class. The factory `createExportPipeline` configures all
dependencies from the environment, so you can integrate the pipeline into your own scripts:

```ts
import {createExportPipeline} from './dist/pipeline/export-pipeline';

async function main(): Promise<void> {
  const pipeline = createExportPipeline();

  const pages = await pipeline.listPages();
  console.log(`Found ${pages.length} top-level pages`);
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
3. Export your Confluence space as **HTML** and copy the bundle (including `index.html` and `attachments/`) to the folder specified by `ATLASSIAN_EXPORT_PATH`.
4. Run the CLI commands (or call the pipeline programmatically) to list pages, render them to `.docx`, and copy attachments.
5. Upload the final files to Google Drive using the SDK authenticated via your service account credentials.

## Limitations

- Attachments that are not images will not be exported. Widgets that Word export does not support are also omitted.
- Confluence page titles containing slashes (`/`) are invalid in most file systems; rename them before starting the migration.
