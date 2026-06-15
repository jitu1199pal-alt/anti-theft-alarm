import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// 1. Ensure signing variables are set
const storePassword = 'a52ab903ad5f8817';
const keyAlias = 'charging_alarm_pro_key';
const keyPassword = 'a52ab903ad5f8817';

const env = {
  ...process.env,
  SIGNING_STORE_PASSWORD: storePassword,
  SIGNING_KEY_ALIAS: keyAlias,
  SIGNING_KEY_PASSWORD: keyPassword,
};

console.log('--- Starting Signed Android App Bundle Build ---');
console.log('Using Keystore Alias:', keyAlias);

// Make sure gradlew is executable
const gradlewPath = path.resolve('android/gradlew');
try {
  if (fs.existsSync(gradlewPath)) {
    fs.chmodSync(gradlewPath, 0o755);
    console.log('Made android/gradlew executable.');
  }
} catch (err) {
  console.warn('Could not chmod gradlew:', err);
}

// 2. Spawn gradlew bundleRelease inside /android directory
const gradlewDir = path.resolve('android');
const gradleProcess = spawn('./gradlew', ['bundleRelease', '--no-daemon'], {
  cwd: gradlewDir,
  env,
  stdio: 'inherit', // Stream logs in real-time
});

gradleProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n==================================================');
    console.log('SUCCESS: Android App Bundle (.aab) built perfectly!');
    console.log('Look for the signed file in:');
    console.log('android/app/build/outputs/bundle/release/app-release.aab');
    console.log('==================================================\n');
    process.exit(0);
  } else {
    console.error(`\nGradle compilation failed with exit code: ${code}`);
    process.exit(code || 1);
  }
});
