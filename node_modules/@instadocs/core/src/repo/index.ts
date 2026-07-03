import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { simpleGit } from 'simple-git';

export interface RepoSource {
  /** A git URL (https/ssh) to clone, OR an absolute path to an existing folder. */
  location: string;
  branch?: string;
  /** Optional sub-directory within the repo that holds the automation project. */
  subPath?: string;
}

export interface OpenedRepo {
  /** Absolute path to the working tree (or the sub-path within it). */
  workingDir: string;
  /** True if we cloned into a temp dir and the caller should clean it up. */
  cloned: boolean;
  cleanup: () => void;
}

function looksLikeGitUrl(loc: string): boolean {
  return (
    /^https?:\/\//i.test(loc) ||
    /^git@/i.test(loc) ||
    /^ssh:\/\//i.test(loc) ||
    loc.endsWith('.git')
  );
}

/**
 * Resolve a RepoSource to a local working directory. Clones git URLs into a
 * temp dir; opens local folders in place.
 */
export async function openRepo(source: RepoSource): Promise<OpenedRepo> {
  const { location, branch, subPath } = source;

  if (looksLikeGitUrl(location)) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'instadocs-'));
    const git = simpleGit();
    const opts: string[] = ['--depth', '1'];
    if (branch) opts.push('--branch', branch);
    await git.clone(location, tmp, opts);
    const workingDir = subPath ? path.join(tmp, subPath) : tmp;
    return {
      workingDir,
      cloned: true,
      cleanup: () => rmrf(tmp),
    };
  }

  // Local folder.
  const abs = path.resolve(location);
  if (!fs.existsSync(abs)) {
    throw new Error(`Path does not exist: ${abs}`);
  }
  const workingDir = subPath ? path.join(abs, subPath) : abs;
  return { workingDir, cloned: false, cleanup: () => {} };
}

function rmrf(target: string): void {
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch {
    /* best-effort cleanup */
  }
}
