import {describe, expect, it} from '@jest/globals';
import * as fs from 'fs';
import * as goreleaser from '../src/goreleaser';

describe('install', () => {
  it('acquires v0.182.0 version of GoReleaser', async () => {
    const bin = await goreleaser.install('goreleaser', 'v0.182.0');
    expect(fs.existsSync(bin)).toBe(true);
  }, 100000);

  it('acquires latest version of GoReleaser', async () => {
    const bin = await goreleaser.install('goreleaser', 'latest');
    expect(fs.existsSync(bin)).toBe(true);
  }, 100000);

  it('acquires v0.182.0-pro version of GoReleaser Pro', async () => {
    const bin = await goreleaser.install('goreleaser-pro', 'v0.182.0-pro');
    expect(fs.existsSync(bin)).toBe(true);
  }, 100000);

  it('acquires latest v1 version of GoReleaser', async () => {
    const bin = await goreleaser.install('goreleaser', '~> v1');
    expect(fs.existsSync(bin)).toBe(true);
  }, 100000);

  it('acquires latest v1 version of GoReleaser Pro', async () => {
    const bin = await goreleaser.install('goreleaser-pro', '~> v1');
    expect(fs.existsSync(bin)).toBe(true);
  }, 100000);

  it('acquires latest v2 version of GoReleaser', async () => {
    const bin = await goreleaser.install('goreleaser', '~> v2');
    expect(fs.existsSync(bin)).toBe(true);
  }, 100000);

  it('acquires latest v2 version of GoReleaser Pro', async () => {
    const bin = await goreleaser.install('goreleaser-pro', '~> v2');
    expect(fs.existsSync(bin)).toBe(true);
  }, 100000);

  it('acquires latest version of GoReleaser Pro', async () => {
    const bin = await goreleaser.install('goreleaser-pro', 'latest');
    expect(fs.existsSync(bin)).toBe(true);
  }, 100000);
});

describe('distribSuffix', () => {
  it('suffixes pro distribution', async () => {
    expect(goreleaser.distribSuffix('goreleaser-pro')).toEqual('-pro');
  });

  it('does not suffix oss distribution', async () => {
    expect(goreleaser.distribSuffix('goreleaser')).toEqual('');
  });

  it('does not suffix goreleaserx distribution', async () => {
    expect(goreleaser.distribSuffix('goreleaserx')).toEqual('');
  });
});

describe('isGoreleaserx', () => {
  it('returns true for goreleaserx', () => {
    expect(goreleaser.isGoreleaserx('goreleaserx')).toBe(true);
  });

  it('returns false for goreleaser', () => {
    expect(goreleaser.isGoreleaserx('goreleaser')).toBe(false);
  });

  it('returns false for goreleaser-pro', () => {
    expect(goreleaser.isGoreleaserx('goreleaser-pro')).toBe(false);
  });
});
