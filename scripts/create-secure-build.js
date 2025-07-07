const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Security configuration
const securityConfig = {
  // Environment variables to strip from production
  stripEnvVars: [
    'DEBUG',
    'NODE_ENV=development',
    'VERBOSE',
    'TEST_MODE'
  ],
  
  // Files to exclude from production build
  excludeFiles: [
    '*.test.js',
    '*.spec.js',
    '*.dev.js',
    'debug.js',
    'test-*',
    '*.map'
  ],
  
  // Add integrity checks
  enableIntegrityCheck: true,
  
  // License/copyright header to add
  copyrightHeader: `/*
 * PROPRIETARY AND CONFIDENTIAL
 * 
 * This software is the confidential and proprietary information of your company.
 * You shall not disclose such Confidential Information and shall use it only
 * in accordance with the terms of the license agreement.
 * 
 * Unauthorized copying, modification, distribution, or use is strictly prohibited.
 * 
 * Generated: ${new Date().toISOString()}
 * Build Hash: {{BUILD_HASH}}
 */\n\n`
};

// Generate build hash for integrity checking
function generateBuildHash() {
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(16).toString('hex');
  return crypto.createHash('sha256').update(timestamp + random).digest('hex').substring(0, 16);
}

// Add copyright header to obfuscated files
function addCopyrightHeader(filePath, buildHash) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const headerWithHash = securityConfig.copyrightHeader.replace('{{BUILD_HASH}}', buildHash);
    const newContent = headerWithHash + content;
    fs.writeFileSync(filePath, newContent);
    console.log(`✓ Added copyright header to: ${path.basename(filePath)}`);
  } catch (error) {
    console.error(`✗ Failed to add header to ${filePath}:`, error.message);
  }
}

// Remove debug and development code
function stripDevelopmentCode(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remove console.log statements (additional layer beyond obfuscator)
    content = content.replace(/console\.(log|debug|info|warn)\([^;]*\);?/g, '');
    
    // Remove development comments
    content = content.replace(/\/\*[\s\S]*?\*\//g, '');
    content = content.replace(/\/\/.*$/gm, '');
    
    // Remove empty lines
    content = content.replace(/^\s*[\r\n]/gm, '');
    
    fs.writeFileSync(filePath, content);
    console.log(`✓ Stripped development code from: ${path.basename(filePath)}`);
  } catch (error) {
    console.error(`✗ Failed to strip development code from ${filePath}:`, error.message);
  }
}

// Create production build with security enhancements
async function createSecureBuild() {
  console.log('🔐 Creating secure production build...\n');
  
  const buildHash = generateBuildHash();
  console.log(`📋 Build Hash: ${buildHash}\n`);
  
  // Step 1: Run obfuscation
  console.log('1️⃣ Running obfuscation...');
  try {
    execSync('npm run obfuscate', { stdio: 'inherit' });
    console.log('✓ Obfuscation complete\n');
  } catch (error) {
    console.error('✗ Obfuscation failed:', error.message);
    process.exit(1);
  }
  
  // Step 2: Create secure build directory
  const secureDir = path.join(__dirname, '..', 'backend-secure');
  console.log('2️⃣ Creating secure build directory...');
  
  if (fs.existsSync(secureDir)) {
    fs.rmSync(secureDir, { recursive: true, force: true });
  }
  fs.mkdirSync(secureDir, { recursive: true });
  
  // Copy obfuscated files
  const obfuscatedDir = path.join(__dirname, '..', 'backend-obfuscated');
  copyDirectory(obfuscatedDir, secureDir);
  console.log('✓ Copied obfuscated files\n');
  
  // Step 3: Apply additional security measures
  console.log('3️⃣ Applying security enhancements...');
  
  const jsFiles = findJSFiles(secureDir);
  jsFiles.forEach(file => {
    stripDevelopmentCode(file);
    addCopyrightHeader(file, buildHash);
  });
  
  // Step 4: Create build manifest
  console.log('4️⃣ Creating build manifest...');
  const manifest = {
    buildHash,
    buildTime: new Date().toISOString(),
    version: require('../package.json').version,
    files: jsFiles.map(file => ({
      path: path.relative(secureDir, file),
      size: fs.statSync(file).size,
      hash: crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex')
    }))
  };
  
  fs.writeFileSync(
    path.join(secureDir, 'build-manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  console.log('✓ Build manifest created\n');
  
  // Step 5: Create deployment package
  console.log('5️⃣ Creating deployment package...');
  const deploymentReadme = `# Secure Backend Deployment

## Build Information
- Build Hash: ${buildHash}
- Build Time: ${new Date().toISOString()}
- Version: ${require('../package.json').version}

## Deployment Instructions

1. Install dependencies:
   \`\`\`bash
   npm install --production
   \`\`\`

2. Start the server:
   \`\`\`bash
   node server-new.js
   \`\`\`

## Security Notes
- This is an obfuscated production build
- All debug code has been removed
- Source code is protected with multiple layers of obfuscation
- Build integrity can be verified using build-manifest.json

## Support
Contact your development team for support. Do not attempt to modify these files.
`;
  
  fs.writeFileSync(path.join(secureDir, 'DEPLOYMENT.md'), deploymentReadme);
  
  console.log('🎉 Secure build created successfully!');
  console.log(`📁 Location: ${secureDir}`);
  console.log(`🔑 Build Hash: ${buildHash}`);
  console.log(`\n🚀 Ready for production deployment!`);
}

// Helper functions
function findJSFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!['node_modules', '.git'].includes(file)) {
        findJSFiles(filePath, fileList);
      }
    } else if (file.endsWith('.js')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const files = fs.readdirSync(src);
  files.forEach(file => {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

// Run if called directly
if (require.main === module) {
  createSecureBuild().catch(console.error);
}

module.exports = { createSecureBuild, generateBuildHash }; 