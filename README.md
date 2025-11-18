# confluence-to-google-drive-migration

Scripts to help you migrate your Confluence documents to Google Drive.

Because Google Drive supports viewing and editing `.docx` files, we export the Confluence space to Word, clean up the hierarchy locally, and then upload the files to Google Drive.

## Prerequisites

- [Node.js](https://nodejs.org/) 24 or later
- [Yarn](https://yarnpkg.com/) (this project uses the Yarn 4 node-modules linker)
- [LibreOffice](https://www.libreoffice.org/download/download-libreoffice/) (the CLI binary `soffice` must be available)

The document conversion step relies on [`@shelf/libreoffice-convert`](https://www.npmjs.com/package/@shelf/libreoffice-convert),
which shells out to the LibreOffice command-line tools. Install LibreOffice using your platform's package manager:

- **macOS**: `brew install --cask libreoffice`
- **Debian/Ubuntu**: `sudo apt-get update && sudo apt-get install libreoffice`
- **Windows**: download the installer from the LibreOffice website and ensure `soffice.exe` is on the `PATH` (or set the
  `LIBRE_OFFICE_EXE` environment variable).

If LibreOffice is installed in a non-standard location, set `LIBRE_OFFICE_EXE` to the absolute path of the binary so the
converter can locate it.

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

The migration script reads the HTML bundle exported from Confluence (no authenticated API calls are required).

The script reads `ATLASSIAN_EXPORT_PATH` (defaults to `confluence-export`) to locate the Word export bundle you downloaded from Confluence:

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

# render the exported HTML documents and convert them into .docx files
yarn ctogdm render

# copy attachments from the Confluence export bundle into the output directory
yarn ctogdm attachments

# legacy alias for the attachments command
yarn ctogdm sync
```

> ℹ️  The `attachments` command only copies files from the export bundle.

The CLI reads the environment variables documented above at runtime. The default directories are:

- `ATLASSIAN_EXPORT_PATH` — folder containing the HTML export bundle (defaults to `confluence-export`).
- `ATLASSIAN_OUTPUT_PATH` — final structured output directory (defaults to `output`).
- `LIBREOFFICE_CONVERSION_CONCURRENCY` — optional maximum number of parallel LibreOffice conversions. Defaults to the number of
  CPU cores detected by Node.js, but the value will never exceed that CPU count.

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
3. Export your Confluence space to Word and copy the bundle to the folder specified by `ATLASSIAN_EXPORT_PATH`.
4. Run the CLI commands (or call the pipeline programmatically) to list pages, render them to `.docx`, and copy attachments.
5. Upload the final files to Google Drive using the SDK authenticated via your service account credentials.
6. Upload the final files to Google Drive using the SDK authenticated via your service account credentials.

## Limitations

- Attachments that are not images will not be exported. Widgets that Word export does not support are also omitted.
- Confluence page titles containing slashes (`/`) are invalid in most file systems; rename them before starting the migration.
