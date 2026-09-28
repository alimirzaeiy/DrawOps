import { SecurityGuardian } from '../securityGuardian.js';

console.log('--- Running Security Guardian Tests ---');

// Test 1: Assert forbidden delete commands are properly blocked
const forbidden = [
  'rm -rf /srv/app',
  'rmdir /srv/test',
  'unlink /srv/file.txt',
  'docker rm container_1',
  'docker rmi myimage',
  'docker compose down -v',
  'truncate -s 0 /srv/config.json',
  'shred /srv/keys.txt',
  'wipefs -a /dev/sda'
];

let caughtCount = 0;
for (const cmd of forbidden) {
  try {
    SecurityGuardian.assertNoDelete(cmd);
    console.error(`FAILED to block: ${cmd}`);
  } catch (err: any) {
    caughtCount++;
  }
}

if (caughtCount === forbidden.length) {
  console.log(`[PASS] Blocked all ${forbidden.length} dangerous deletion commands.`);
} else {
  throw new Error(`Failed security tests: only ${caughtCount}/${forbidden.length} blocked`);
}

// Test 2: Assert safe commands are allowed
const allowed = [
  'mkdir -p /srv/new_folder',
  'touch /srv/new_file.txt',
  'cat /srv/app/docker-compose.yml',
  'docker ps -a --format json',
  'find /srv -maxdepth 5'
];

for (const cmd of allowed) {
  try {
    SecurityGuardian.assertNoDelete(cmd);
  } catch (err: any) {
    throw new Error(`Safe command was falsely rejected: ${cmd}`);
  }
}
console.log(`[PASS] All ${allowed.length} safe commands allowed.`);

// Test 3: Assert path traversal is blocked
try {
  SecurityGuardian.sanitizePath('/srv/../../etc/passwd');
  throw new Error('Path traversal was not blocked!');
} catch (err: any) {
  console.log('[PASS] Path traversal attack successfully blocked.');
}

// Test 4: Backup path generator
const backupPath = SecurityGuardian.generateBackupPath('testuser', '/srv/my_app/docker-compose.yml');
if (backupPath.startsWith('/home/testuser/srv_backups/') && backupPath.includes('docker-compose.yml')) {
  console.log(`[PASS] Backup path generated correctly: ${backupPath}`);
} else {
  throw new Error(`Unexpected backup path: ${backupPath}`);
}

console.log('--- ALL SECURITY TESTS PASSED SUCCESSFULLY ---');
