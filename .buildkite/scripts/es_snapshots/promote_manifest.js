const fs = require('fs');
const { execSync } = require('child_process');

const BASE_BUCKET_DAILY = 'ci-artifacts.kibana.dev/es-snapshots-daily-buildkite';
const BASE_BUCKET_PERMANENT = 'ci-artifacts.kibana.dev/es-snapshots-permanent-buildkite';

(async () => {
  try {
    const MANIFEST_URL = process.argv[2];

    if (!MANIFEST_URL) {
      throw Error('Manifest URL missing');
    }

    fs.mkdirSync('target/snapshot-promotion', { recursive: true });
    process.chdir('target/snapshot-promotion');

    execSync(`curl '${MANIFEST_URL}' > manifest.json`);

    const manifestJson = fs.readFileSync('manifest.json').toString();
    const manifest = JSON.parse(manifestJson);
    const { id, bucket, version } = manifest;

    const manifestPermanentJson = manifestJson.split(BASE_BUCKET_DAILY).join(BASE_BUCKET_PERMANENT); // e.g. replaceAll

    fs.writeFileSync('manifest-permanent.json', manifestPermanentJson);

    execSync(
      `
      set -euo pipefail
      cp manifest.json manifest-latest-verified.json
      gsutil cp manifest-latest-verified.json gs://${BASE_BUCKET_DAILY}/${version}/
      rm manifest.json
      cp manifest-permanent.json manifest.json
      gsutil -m cp -r gs://${bucket}/* gs://${BASE_BUCKET_PERMANENT}/${version}/
      gsutil cp manifest.json gs://${BASE_BUCKET_PERMANENT}/${version}/
    `,
      { shell: '/bin/bash' }
    );
  } catch (ex) {
    console.error(ex);
    process.exit(1);
  }
})();
