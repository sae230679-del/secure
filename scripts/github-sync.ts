import * as fs from 'fs';
import * as path from 'path';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
let GITHUB_REPO = process.env.GITHUB_REPO;

if (!GITHUB_TOKEN || !GITHUB_REPO) {
  console.error('[GitHub Sync] ERROR: GITHUB_TOKEN or GITHUB_REPO not set');
  process.exit(1);
}

if (GITHUB_REPO.includes('github.com')) {
  const match = GITHUB_REPO.match(/github\.com[\/:]([^\/]+)\/([^\/\s]+)/);
  if (match) {
    GITHUB_REPO = `${match[1]}/${match[2].replace('.git', '')}`;
  }
}

const [OWNER, REPO] = GITHUB_REPO.split('/');
const GRAPHQL_URL = 'https://api.github.com/graphql';

interface FileAddition {
  path: string;
  contents: string;
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
  '.replit.workflows',
  'attached_assets',
  '.agent_state',
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

function getAllFiles(dir: string, basePath: string = ''): FileAddition[] {
  const files: FileAddition[] = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(basePath, entry.name).replace(/\\/g, '/');
      
      if (shouldIgnore(relativePath)) continue;
      
      if (entry.isDirectory()) {
        files.push(...getAllFiles(fullPath, relativePath));
      } else if (entry.isFile()) {
        try {
          const content = fs.readFileSync(fullPath);
          files.push({ 
            path: relativePath, 
            contents: content.toString('base64')
          });
        } catch (e) {
          console.log(`[GitHub Sync] Skipping: ${relativePath}`);
        }
      }
    }
  } catch (e) {
    console.error(`[GitHub Sync] Error reading: ${dir}`);
  }
  
  return files;
}

async function graphqlRequest(query: string, variables: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Authorization': `bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  
  const data = await response.json() as { data?: unknown; errors?: Array<{ message: string }> };
  
  if (data.errors) {
    throw new Error(data.errors.map(e => e.message).join(', '));
  }
  
  return data.data;
}

async function getDefaultBranchAndOid(): Promise<{ branch: string; oid: string }> {
  const query = `
    query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        defaultBranchRef {
          name
          target {
            oid
          }
        }
      }
    }
  `;
  
  const result = await graphqlRequest(query, { owner: OWNER, name: REPO }) as {
    repository: { defaultBranchRef: { name: string; target: { oid: string } } }
  };
  
  return {
    branch: result.repository.defaultBranchRef.name,
    oid: result.repository.defaultBranchRef.target.oid,
  };
}

async function createCommitWithFiles(
  branch: string,
  expectedHeadOid: string,
  message: string,
  files: FileAddition[]
): Promise<string> {
  const BATCH_SIZE = 100;
  let currentOid = expectedHeadOid;
  
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(files.length / BATCH_SIZE);
    
    console.log(`[GitHub Sync] Uploading batch ${batchNum}/${totalBatches} (${batch.length} files)...`);
    
    const mutation = `
      mutation($input: CreateCommitOnBranchInput!) {
        createCommitOnBranch(input: $input) {
          commit {
            oid
            url
          }
        }
      }
    `;
    
    const batchMessage = totalBatches > 1 
      ? `${message} (part ${batchNum}/${totalBatches})`
      : message;
    
    const input = {
      branch: {
        repositoryNameWithOwner: GITHUB_REPO,
        branchName: branch,
      },
      expectedHeadOid: currentOid,
      message: { headline: batchMessage },
      fileChanges: {
        additions: batch,
      },
    };
    
    try {
      const result = await graphqlRequest(mutation, { input }) as {
        createCommitOnBranch: { commit: { oid: string; url: string } }
      };
      
      currentOid = result.createCommitOnBranch.commit.oid;
      
      if (i + BATCH_SIZE < files.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (error) {
      console.error(`[GitHub Sync] Batch ${batchNum} failed:`, error);
      throw error;
    }
  }
  
  return currentOid;
}

async function main() {
  console.log('[GitHub Sync] Starting synchronization...');
  console.log(`[GitHub Sync] Repository: ${GITHUB_REPO}`);

  try {
    const { branch, oid } = await getDefaultBranchAndOid();
    console.log(`[GitHub Sync] Branch: ${branch}, HEAD: ${oid.substring(0, 7)}`);

    console.log('[GitHub Sync] Collecting files...');
    const files = getAllFiles('.');
    console.log(`[GitHub Sync] Found ${files.length} files`);

    if (files.length === 0) {
      console.log('[GitHub Sync] No files to sync');
      return;
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const message = `Deploy: ${timestamp}`;

    console.log('[GitHub Sync] Creating commit...');
    const newOid = await createCommitWithFiles(branch, oid, message, files);

    console.log('[GitHub Sync] Success!');
    console.log(`[GitHub Sync] Commit: ${newOid}`);
    console.log(`[GitHub Sync] View: https://github.com/${GITHUB_REPO}`);
  } catch (error) {
    console.error('[GitHub Sync] Error:', error);
    process.exit(1);
  }
}

main();
