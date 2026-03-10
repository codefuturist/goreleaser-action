import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import yaml from 'js-yaml';
import * as context from './context';
import * as github from './github';
import * as core from '@actions/core';
import * as httpm from '@actions/http-client';
import * as tc from '@actions/tool-cache';

interface GitHubAsset {
  id: number;
  name: string;
  url: string;
}

interface GitHubReleaseWithAssets {
  tag_name: string;
  assets: GitHubAsset[];
}

// Download a release asset from a private GitHub repo via the API.
// The browser URL (github.com/.../releases/download/...) redirects to S3,
// which strips the auth header. The API endpoint streams directly.
async function downloadGoreleaserxAsset(repo: string, tag: string, filename: string, token: string): Promise<string> {
  const http = new httpm.HttpClient('goreleaser-action', [], {
    headers: {Authorization: `token ${token}`, Accept: 'application/vnd.github+json'}
  });

  const releaseUrl = `https://api.github.com/repos/${repo}/releases/tags/${tag}`;
  core.info(`Looking up release ${tag} from ${repo}`);
  const releaseResp = await http.getJson<GitHubReleaseWithAssets>(releaseUrl);
  if (!releaseResp.result || !releaseResp.result.assets) {
    throw new Error(`Failed to find release ${tag} in ${repo}`);
  }

  const asset = releaseResp.result.assets.find((a: GitHubAsset) => a.name === filename);
  if (!asset) {
    const available = releaseResp.result.assets.map((a: GitHubAsset) => a.name).join(', ');
    throw new Error(`Asset ${filename} not found in release ${tag}. Available: ${available}`);
  }

  const assetApiUrl = `https://api.github.com/repos/${repo}/releases/assets/${asset.id}`;
  core.info(`Downloading ${filename} via API (asset ${asset.id})`);
  return await tc.downloadTool(assetApiUrl, undefined, `token ${token}`, {Accept: 'application/octet-stream'});
}

export async function install(
  distribution: string,
  version: string,
  goreleaserxRepo?: string,
  goreleaserxToken?: string
): Promise<string> {
  const release: github.GitHubRelease = await github.getRelease(distribution, version);
  const filename = getFilename(distribution);

  let downloadPath: string;

  if (isGoreleaserx(distribution)) {
    const repo = goreleaserxRepo || 'codefuturist/goreleaser-pro-internal';
    if (!goreleaserxToken) {
      throw new Error('goreleaserx-token is required to download from the private repo');
    }
    downloadPath = await downloadGoreleaserxAsset(repo, release.tag_name, filename, goreleaserxToken);
  } else {
    const downloadUrl = util.format(
      'https://github.com/goreleaser/%s/releases/download/%s/%s',
      distribution,
      release.tag_name,
      filename
    );
    core.info(`Downloading ${downloadUrl}`);
    downloadPath = await tc.downloadTool(downloadUrl);
  }

  core.debug(`Downloaded to ${downloadPath}`);

  core.info('Extracting GoReleaser');
  let extPath: string;
  if (context.osPlat == 'win32') {
    if (!downloadPath.endsWith('.zip')) {
      const newPath = downloadPath + '.zip';
      fs.renameSync(downloadPath, newPath);
      extPath = await tc.extractZip(newPath);
    } else {
      extPath = await tc.extractZip(downloadPath);
    }
  } else {
    extPath = await tc.extractTar(downloadPath);
  }
  core.debug(`Extracted to ${extPath}`);

  const toolName = isGoreleaserx(distribution) ? 'goreleaserx-action' : 'goreleaser-action';
  const cachePath: string = await tc.cacheDir(extPath, toolName, release.tag_name.replace(/^v/, ''));
  core.debug(`Cached to ${cachePath}`);

  const binName = isGoreleaserx(distribution) ? 'goreleaserx' : 'goreleaser';
  const exePath: string = path.join(cachePath, context.osPlat == 'win32' ? `${binName}.exe` : binName);
  core.debug(`Exe path is ${exePath}`);

  return exePath;
}

export const distribSuffix = (distribution: string): string => {
  return isPro(distribution) ? '-pro' : '';
};

export const isPro = (distribution: string): boolean => {
  return distribution === 'goreleaser-pro';
};

export const isGoreleaserx = (distribution: string): boolean => {
  return distribution === 'goreleaserx';
};

const getFilename = (distribution: string): string => {
  if (isGoreleaserx(distribution)) {
    return getGoreleaserxFilename();
  }
  return getStandardFilename(distribution);
};

const getGoreleaserxFilename = (): string => {
  let arch: string;
  switch (context.osArch) {
    case 'x64': {
      arch = 'amd64';
      break;
    }
    case 'arm64': {
      arch = 'arm64';
      break;
    }
    default: {
      arch = context.osArch;
      break;
    }
  }
  const platform: string = context.osPlat == 'win32' ? 'windows' : context.osPlat;
  const ext: string = context.osPlat == 'win32' ? 'zip' : 'tar.gz';
  return util.format('goreleaserx_%s_%s.%s', platform, arch, ext);
};

const getStandardFilename = (distribution: string): string => {
  let arch: string;
  switch (context.osArch) {
    case 'x64': {
      arch = 'x86_64';
      break;
    }
    case 'x32': {
      arch = 'i386';
      break;
    }
    case 'arm': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const arm_version = (process.config.variables as any).arm_version;
      arch = arm_version ? 'armv' + arm_version : 'arm';
      break;
    }
    default: {
      arch = context.osArch;
      break;
    }
  }
  if (context.osPlat == 'darwin') {
    arch = 'all';
  }
  const platform: string = context.osPlat == 'win32' ? 'Windows' : context.osPlat == 'darwin' ? 'Darwin' : 'Linux';
  const ext: string = context.osPlat == 'win32' ? 'zip' : 'tar.gz';
  const suffix: string = distribSuffix(distribution);
  return util.format('goreleaser%s_%s_%s.%s', suffix, platform, arch, ext);
};

export async function getDistPath(yamlfile: string): Promise<string> {
  const cfg = yaml.load(fs.readFileSync(yamlfile, 'utf8'));
  return cfg.dist || 'dist';
}

export async function getArtifacts(distpath: string): Promise<string | undefined> {
  const artifactsFile = path.join(distpath, 'artifacts.json');
  if (!fs.existsSync(artifactsFile)) {
    return undefined;
  }
  const content = fs.readFileSync(artifactsFile, {encoding: 'utf-8'}).trim();
  if (content === 'null') {
    return undefined;
  }
  return content;
}

export async function getMetadata(distpath: string): Promise<string | undefined> {
  const metadataFile = path.join(distpath, 'metadata.json');
  if (!fs.existsSync(metadataFile)) {
    return undefined;
  }
  const content = fs.readFileSync(metadataFile, {encoding: 'utf-8'}).trim();
  if (content === 'null') {
    return undefined;
  }
  return content;
}
