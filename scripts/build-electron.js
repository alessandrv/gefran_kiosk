#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Building GEFRAN Network Settings Electron App...\n');

// Check if out directory exists, if not build first
if (!fs.existsSync(path.join(__dirname, '..', 'out'))) {
  console.log('📦 Building frontend...');
  
  const buildProcess = spawn('npm', ['run', 'export'], {
    stdio: 'inherit',
    shell: true,
    cwd: path.join(__dirname, '..')
  });

  buildProcess.on('close', (code) => {
    if (code !== 0) {
      console.error('❌ Frontend build failed');
      process.exit(1);
    }
    
    console.log('✅ Frontend build complete');
    startElectron();
  });
} else {
  console.log('📦 Frontend already built, starting Electron...');
  startElectron();
}

function startElectron() {
  console.log('🖥️  Starting Electron app...\n');
  
  const electronProcess = spawn('npm', ['run', 'electron'], {
    stdio: 'inherit',
    shell: true,
    cwd: path.join(__dirname, '..')
  });

  electronProcess.on('close', (code) => {
    console.log(`\n🏁 Electron app exited with code ${code}`);
  });

  electronProcess.on('error', (error) => {
    console.error('❌ Failed to start Electron:', error);
  });
} 