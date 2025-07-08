const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

// Configuration for obfuscation
const obfuscationOptions = {
  // High security settings
  compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 1,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 1,
    debugProtection: true,
    debugProtectionInterval: 4000,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 5,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ['rc4'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 5,
    stringArrayWrappersChainedCalls: true,    
    stringArrayWrappersParametersMaxCount: 5,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 1,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
};

// Function to recursively find all JS files
function findJSFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and other unnecessary directories
      if (!['node_modules', '.git', 'dist', 'build'].includes(file)) {
        findJSFiles(filePath, fileList);
      }
    } else if (file.endsWith('.js')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Function to obfuscate a single file
function obfuscateFile(inputPath, outputPath) {
  try {
    console.log(`Obfuscating: ${inputPath}`);
    
    const sourceCode = fs.readFileSync(inputPath, 'utf8');
    const obfuscatedCode = JavaScriptObfuscator.obfuscate(sourceCode, obfuscationOptions);
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, obfuscatedCode.getObfuscatedCode());
    console.log(`✓ Obfuscated: ${outputPath}`);
  } catch (error) {
    console.error(`✗ Failed to obfuscate ${inputPath}:`, error.message);
  }
}

// Main obfuscation process
function main() {
  console.log('🔒 Starting backend obfuscation...\n');
  
  const backendDir = path.join(__dirname, '..', 'backend');
  const outputDir = path.join(__dirname, '..', 'backend-obfuscated');
  
  // Clean output directory
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  
  // Find all JS files in backend directory
  const jsFiles = findJSFiles(backendDir);
  
  console.log(`Found ${jsFiles.length} JavaScript files to obfuscate:\n`);
  
  // Obfuscate each file
  jsFiles.forEach(inputPath => {
    const relativePath = path.relative(backendDir, inputPath);
    const outputPath = path.join(outputDir, relativePath);
    obfuscateFile(inputPath, outputPath);
  });
  
  // Copy package.json (needed for dependencies)
  const packageJsonPath = path.join(backendDir, '..', 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const outputPackageJsonPath = path.join(outputDir, 'package.json');
    
    // Read and modify package.json to point to obfuscated entry point
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Add obfuscated backend scripts
    packageJson.scripts = {
      ...packageJson.scripts,
      'backend:obfuscated': 'node backend-obfuscated/server-new.js',
      'backend:obfuscated:legacy': 'node backend-obfuscated/server.js'
    };
    
    fs.writeFileSync(outputPackageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('✓ Updated package.json for obfuscated backend');
  }
  
  // Create README for obfuscated version
  const readmePath = path.join(outputDir, 'README.md');
  const readmeContent = `# Obfuscated Backend

This directory contains the obfuscated version of the backend code.

## Usage

\`\`\`bash
# Run obfuscated modular backend
npm run backend:obfuscated

# Run obfuscated legacy backend  
npm run backend:obfuscated:legacy
\`\`\`

## Security Notes

- This code has been obfuscated for intellectual property protection
- Variable names, function names, and control flow have been transformed
- String literals have been encoded and encrypted
- Dead code injection provides additional protection
- Self-defending code will detect tampering attempts

## Warning

- Do not modify these files manually
- Always work with the original source code in the \`backend/\` directory
- Regenerate obfuscated code when making changes to source

Generated on: ${new Date().toISOString()}
`;
  
  fs.writeFileSync(readmePath, readmeContent);
  
  console.log(`\n🎉 Obfuscation complete!`);
  console.log(`📁 Obfuscated files saved to: ${outputDir}`);
  console.log(`\n🚀 To run obfuscated backend:`);
  console.log(`   npm run backend:obfuscated`);
  console.log(`\n⚠️  Remember: Always work with source files in backend/ directory`);
}

// Run the obfuscation
if (require.main === module) {
  main();
}

module.exports = { obfuscateFile, findJSFiles }; 