// Launcher: keeps the local server + public tunnel alive.
// - Spawns server.js (tolerates "port already in use" if one is already running)
// - Spawns an SSH tunnel to localhost.run and auto-restarts it if it dies
// - Writes the current public URL to public-url.txt
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DIR = __dirname;
const URL_FILE = path.join(DIR, 'public-url.txt');

// ---- 1. Ensure local server is up ----
let serverReady = false;
const server = spawn(process.execPath, ['server.js'], { cwd: DIR, stdio: 'inherit' });
server.on('exit', (code, sig) => {
  if (!serverReady) {
    console.error('[launcher] server failed to start (code ' + code + ', sig ' + sig + '). Is port ' + PORT + ' taken by another process?');
  }
});
server.stdout && server.stdout.on('data', d => { if (d.toString().includes('Server running')) serverReady = true; });

// ---- 2. Manage the public tunnel with auto-recovery ----
function startTunnel() {
  console.log('[launcher] starting tunnel...');
  const ssh = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'UserKnownHostsFile=/dev/null',
    '-o', 'ServerAliveInterval=30',
    '-o', 'ServerAliveCountMax=4',
    '-R', '80:localhost:' + PORT,
    'nokey@localhost.run'
  ], { cwd: DIR });

  let urlWritten = false;
  ssh.stdout.on('data', d => {
    const s = d.toString();
    process.stdout.write('[tunnel] ' + s);
    const m = s.match(/https?:\/\/[a-z0-9.-]+\.lhr\.life/);
    if (m && !urlWritten) {
      urlWritten = true;
      fs.writeFileSync(URL_FILE, m[0] + '\n');
      console.log('[launcher] >>> Public URL ready: ' + m[0]);
    }
  });
  ssh.stderr.on('data', d => process.stderr.write('[tunnel-err] ' + d));

  ssh.on('exit', code => {
    console.log('[launcher] tunnel exited (code ' + code + '). Restarting in 5s...');
    if (fs.existsSync(URL_FILE)) fs.unlinkSync(URL_FILE);
    setTimeout(startTunnel, 5000);
  });
  ssh.on('error', err => {
    console.log('[launcher] tunnel spawn error: ' + err.message + '. Retrying in 10s...');
    setTimeout(startTunnel, 10000);
  });
}

// Give the server a moment, then bring up the tunnel.
setTimeout(startTunnel, 1500);
