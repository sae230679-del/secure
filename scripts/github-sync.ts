import * as fs from 'fs';
import * as path from 'path';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
let GITHUB_REPO = process.env.GITHUB_REPO;

if (!GITHUB_TOKEN || !GITHUB_REPO) {
  console.error('[GitHub Sync] ERROR: GITHUB_TOKEN (or GITHUB_PERSONAL_ACCESS_TOKEN) or GITHUB_REPO not set');
  process.exit(1);
}

// Normalize GITHUB_REPO - extract owner/repo from various formats
// Supports: "owner/repo", "https://github.com/owner/repo", "github.com/owner/repo"
if (GITHUB_REPO.includes('github.com')) {
  const match = GITHUB_REPO.match(/github\.com[\/:]([^\/]+)\/([^\/\s]+)/);
  if (match) {
    GITHUB_REPO = `${match[1]}/${match[2].replace('.git', '')}`;
  }
}

const API_BASE = 'https://api.github.com';
const headers = {
  'Authorization': `token ${GITHUB_TOKEN}`,
  'Accept': 'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
};

interface FileEntry {
  path: string;
  content: string;
}

const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  '.replit',
  '.upm',
  '.cache',
  '.config',
  'replit.nix',
  '.breakpoints',
  'generated-icon.png',
  '.env',
  '.env.local',
  '*.log',
  'package-lock.json',
];

function shouldIgnore(filePath: string): boolean {
  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      if (regex.test(filePath)) return true;
    } else if (filePath.includes(pattern)) {
      return true;
    }
  }
  return false;
}

function getAllFiles(dir: string, basePath: string = ''): FileEntry[] {
  const files: FileEntry[] = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(basePath, entry.name);
      
      if (shouldIgnore(relativePath)) continue;
      
      if (entry.isDirectory()) {
        files.push(...getAllFiles(fullPath, relativePath));
      } else if (entry.isFile()) {
        try {
          const content = fs.readFileSync(fullPath);
          const base64Content = content.toString('base64');
          files.push({ path: relativePath, content: base64Content });
        } catch (e) {
          console.log(`[GitHub Sync] Skipping unreadable file: ${relativePath}`);
        }
      }
    }
  } catch (e) {
    console.error(`[GitHub Sync] Error reading directory: ${dir}`);
  }
  
  return files;
}

async function getDefaultBranch(): Promise<string> {
  const response = await fetch(`${API_BASE}/repos/${GITHUB_REPO}`, { headers });
  if (!response.ok) {
    return 'main';
  }
  const data = await response.json() as { default_branch: string };
  return data.default_branch || 'main';
}

async function getLatestCommit(branch: string): Promise<string | null> {
  const response = await fetch(`${API_BASE}/repos/${GITHUB_REPO}/git/refs/heads/${branch}`, { headers });
  if (!response.ok) {
    return null;
  }
  const data = await response.json() as { object: { sha: string } };
  return data.object?.sha || null;
}

async function createBlob(content: string, retries = 3): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(`${API_BASE}/repos/${GITHUB_REPO}/git/blobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content, encoding: 'base64' }),
    });
    
    if (response.ok) {
      const data = await response.json() as { sha: string };
      return data.sha;
    }
    
    if (response.status === 403 || response.status === 429) {
      const waitTime = Math.pow(2, attempt) * 2000;
      console.log(`[GitHub Sync] Rate limited, waiting ${waitTime/1000}s (attempt ${attempt}/${retries})...`);
      await new Promise(r => setTimeout(r, waitTime));
      continue;
    }
    
    throw new Error(`Failed to create blob: ${response.statusText}`);
  }
  throw new Error('Failed to create blob after retries');
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processBatch<T, R>(items: T[], batchSize: number, delayMs: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    if (i + batchSize < items.length) {
      await sleep(delayMs);
    }
    console.log(`[GitHub Sync] Progress: ${Math.min(i + batchSize, items.length)}/${items.length} files`);
  }
  return results;
}

async function createTree(files: FileEntry[], baseTree: string | null): Promise<string> {
  const tree = await processBatch(files, 5, 2000, async (file) => ({
    path: file.path.replace(/\\/g, '/'),
    mode: '100644' as const,
    type: 'blob' as const,
    sha: await createBlob(file.content),
  }));

  const body: { tree: typeof tree; base_tree?: string } = { tree };
  if (baseTree) {
    body.base_tree = baseTree;
  }

  const response = await fetch(`${API_BASE}/repos/${GITHUB_REPO}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create tree: ${response.statusText}`);
  }
  
  const data = await response.json() as { sha: string };
  return data.sha;
}

async function createCommit(treeSha: string, parentSha: string | null, message: string): Promise<string> {
  const body: { message: string; tree: string; parents?: string[] } = {
    message,
    tree: treeSha,
  };
  
  if (parentSha) {
    body.parents = [parentSha];
  }

  const response = await fetch(`${API_BASE}/repos/${GITHUB_REPO}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create commit: ${response.statusText}`);
  }
  
  const data = await response.json() as { sha: string };
  return data.sha;
}

async function updateRef(branch: string, commitSha: string, force: boolean = false): Promise<void> {
  const refUrl = `${API_BASE}/repos/${GITHUB_REPO}/git/refs/heads/${branch}`;
  
  let response = await fetch(refUrl, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ sha: commitSha, force }),
  });

  if (response.status === 404) {
    response = await fetch(`${API_BASE}/repos/${GITHUB_REPO}/git/refs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commitSha }),
    });
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update ref: ${response.statusText} - ${text}`);
  }
}

async function main() {
  console.log('[GitHub Sync] Starting synchronization...');
  console.log(`[GitHub Sync] Repository: ${GITHUB_REPO}`);

  try {
    const branch = await getDefaultBranch();
    console.log(`[GitHub Sync] Target branch: ${branch}`);

    const latestCommit = await getLatestCommit(branch);
    console.log(`[GitHub Sync] Latest commit: ${latestCommit || 'none (new repo)'}`);

    console.log('[GitHub Sync] Collecting files...');
    const files = getAllFiles('.');
    console.log(`[GitHub Sync] Found ${files.length} files to sync`);

    if (files.length === 0) {
      console.log('[GitHub Sync] No files to sync');
      return;
    }

    console.log('[GitHub Sync] Creating tree...');
    const treeSha = await createTree(files, latestCommit);

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const message = `Deploy: ${timestamp}`;

    console.log('[GitHub Sync] Creating commit...');
    const commitSha = await createCommit(treeSha, latestCommit, message);

    console.log('[GitHub Sync] Updating reference...');
    await updateRef(branch, commitSha, true);

    console.log('[GitHub Sync] Successfully synchronized to GitHub!');
    console.log(`[GitHub Sync] Commit: ${commitSha}`);
    console.log(`[GitHub Sync] View: https://github.com/${GITHUB_REPO}`);
  } catch (error) {
    console.error('[GitHub Sync] Error:', error);
    process.exit(1);
  }
}

main();
