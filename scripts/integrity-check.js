const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Runtime Integrity Checker
 * Verifies that obfuscated code hasn't been tampered with
 */
class IntegrityChecker {
  constructor(manifestPath) {
    this.manifestPath = manifestPath;
    this.manifest = null;
    this.loadManifest();
  }

  loadManifest() {
    try {
      if (fs.existsSync(this.manifestPath)) {
        this.manifest = JSON.parse(fs.readFileSync(this.manifestPath, 'utf8'));
      } else {
        console.warn('⚠️  No build manifest found - integrity checking disabled');
      }
    } catch (error) {
      console.error('❌ Failed to load build manifest:', error.message);
    }
  }

  // Calculate file hash
  calculateFileHash(filePath) {
    try {
      const content = fs.readFileSync(filePath);
      return crypto.createHash('md5').update(content).digest('hex');
    } catch (error) {
      throw new Error(`Cannot calculate hash for ${filePath}: ${error.message}`);
    }
  }

  // Verify a single file
  verifyFile(filePath) {
    if (!this.manifest) return { valid: true, reason: 'No manifest available' };

    const relativePath = path.relative(path.dirname(this.manifestPath), filePath);
    const fileRecord = this.manifest.files.find(f => f.path === relativePath);

    if (!fileRecord) {
      return { valid: false, reason: 'File not in manifest' };
    }

    const currentHash = this.calculateFileHash(filePath);
    const valid = currentHash === fileRecord.hash;

    return {
      valid,
      reason: valid ? 'Hash matches' : 'Hash mismatch - file may be tampered',
      expectedHash: fileRecord.hash,
      actualHash: currentHash
    };
  }

  // Verify all files in manifest
  verifyAllFiles() {
    if (!this.manifest) {
      return { valid: true, results: [], warnings: ['No manifest available'] };
    }

    const results = [];
    const manifestDir = path.dirname(this.manifestPath);
    let allValid = true;

    for (const fileRecord of this.manifest.files) {
      const filePath = path.join(manifestDir, fileRecord.path);
      
      if (!fs.existsSync(filePath)) {
        results.push({
          file: fileRecord.path,
          valid: false,
          reason: 'File missing'
        });
        allValid = false;
        continue;
      }

      const verification = this.verifyFile(filePath);
      results.push({
        file: fileRecord.path,
        ...verification
      });

      if (!verification.valid) {
        allValid = false;
      }
    }

    return { valid: allValid, results };
  }

  // Generate security report
  generateSecurityReport() {
    const verification = this.verifyAllFiles();
    
    console.log('\n🔐 SECURITY INTEGRITY REPORT');
    console.log('================================');
    
    if (this.manifest) {
      console.log(`📋 Build Hash: ${this.manifest.buildHash}`);
      console.log(`📅 Build Time: ${this.manifest.buildTime}`);
      console.log(`📦 Version: ${this.manifest.version}`);
      console.log('');
    }

    if (verification.valid) {
      console.log('✅ ALL FILES VERIFIED - No tampering detected');
    } else {
      console.log('❌ INTEGRITY VIOLATION DETECTED');
      console.log('⚠️  Some files may have been modified or corrupted');
    }

    console.log('\nFile Verification Results:');
    console.log('---------------------------');
    
    verification.results.forEach(result => {
      const status = result.valid ? '✅' : '❌';
      console.log(`${status} ${result.file}: ${result.reason}`);
      
      if (!result.valid && result.expectedHash && result.actualHash) {
        console.log(`   Expected: ${result.expectedHash}`);
        console.log(`   Actual:   ${result.actualHash}`);
      }
    });

    if (verification.warnings) {
      console.log('\nWarnings:');
      verification.warnings.forEach(warning => {
        console.log(`⚠️  ${warning}`);
      });
    }

    console.log('================================\n');
    
    return verification.valid;
  }

  // Anti-tampering middleware for Express
  static createMiddleware(manifestPath) {
    const checker = new IntegrityChecker(manifestPath);
    
    return (req, res, next) => {
      // Only check on specific routes or intervals to avoid performance impact
      const shouldCheck = req.path === '/api/health' || Math.random() < 0.01; // 1% of requests
      
      if (shouldCheck && checker.manifest) {
        const verification = checker.verifyAllFiles();
        
        if (!verification.valid) {
          console.error('🚨 SECURITY ALERT: Code integrity violation detected!');
          console.error('🚨 Server may be compromised - check logs immediately');
          
          // You can choose to:
          // 1. Log and continue (monitoring mode)
          // 2. Return error (protective mode)
          // 3. Shutdown server (maximum security mode)
          
          // For now, just log - uncomment below for protective mode:
          // return res.status(500).json({ error: 'Security integrity check failed' });
        }
      }
      
      next();
    };
  }
}

// CLI usage
if (require.main === module) {
  const manifestPath = process.argv[2] || path.join(__dirname, '..', 'backend-secure', 'build-manifest.json');
  const checker = new IntegrityChecker(manifestPath);
  const isValid = checker.generateSecurityReport();
  
  process.exit(isValid ? 0 : 1);
}

module.exports = IntegrityChecker; 