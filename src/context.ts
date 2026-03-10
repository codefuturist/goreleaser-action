import * as os from 'os';
import * as core from '@actions/core';

export const osPlat: string = os.platform();
export const osArch: string = os.arch();

export interface Inputs {
  distribution: string;
  version: string;
  args: string;
  workdir: string;
  installOnly: boolean;
  goreleaserxRepo: string;
  goreleaserxToken: string;
}

export async function getInputs(): Promise<Inputs> {
  return {
    distribution: core.getInput('distribution') || 'goreleaserx',
    version: core.getInput('version') || 'latest',
    args: core.getInput('args'),
    workdir: core.getInput('workdir') || '.',
    installOnly: core.getBooleanInput('install-only'),
    goreleaserxRepo: core.getInput('goreleaserx-repo') || 'codefuturist/goreleaserx',
    goreleaserxToken: core.getInput('goreleaserx-token')
  };
}
