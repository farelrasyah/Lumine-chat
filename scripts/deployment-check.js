#!/usr/bin/env node

/**
 * Pre-deployment checklist script
 * Validates that all requirements are met before deploying
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Lumine Chat Bot - Deployment Readiness Check');
console.log('===============================================\n');

let allChecksPass = true;
let warnings = [];
let criticalIssues = [];

function checkPass(message) {
  console.log(`✅ ${message}`);
}

function checkWarn(message) {
  console.log(`⚠️  ${message}`);
  warnings.push(message);
}

function checkFail(message) {
  console.log(`❌ ${message}`);
  criticalIssues.push(message);
  allChecksPass = false;
}

console.log('1. 📋 Checking Required Files');
console.log('-----------------------------');

// Check package.json
if (fs.existsSync('package.json')) {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  checkPass('package.json exists');
  
  // Check required scripts
  const requiredScripts = ['build', 'start:prod'];
  requiredScripts.forEach(script => {
    if (pkg.scripts && pkg.scripts[script]) {
      checkPass(`Script "${script}" defined`);
    } else {
      checkFail(`Script "${script}" missing from package.json`);
    }
  });
  
  // Check dependencies
  const criticalDeps = ['@nestjs/core', '@nestjs/common', '@whiskeysockets/baileys'];
  criticalDeps.forEach(dep => {
    if (pkg.dependencies && pkg.dependencies[dep]) {
      checkPass(`Dependency "${dep}" installed`);
    } else {
      checkFail(`Critical dependency "${dep}" missing`);
    }
  });
} else {
  checkFail('package.json not found');
}

// Check main entry point
if (fs.existsSync('src/main.ts')) {
  checkPass('src/main.ts exists');
  const mainContent = fs.readFileSync('src/main.ts', 'utf8');
  if (mainContent.includes('process.env.PORT')) {
    checkPass('PORT environment variable handling found');
  } else {
    checkWarn('PORT environment variable handling not found');
  }
} else {
  checkFail('src/main.ts not found');
}

// Check TypeScript config
if (fs.existsSync('tsconfig.json')) {
  checkPass('tsconfig.json exists');
} else {
  checkFail('tsconfig.json not found');
}

console.log('\n2. 🔧 Checking Deployment Configuration');
console.log('---------------------------------------');

// Check render.yaml
if (fs.existsSync('render.yaml')) {
  checkPass('render.yaml configuration exists');
} else {
  checkWarn('render.yaml not found (will use manual configuration)');
}

// Check Dockerfile
if (fs.existsSync('Dockerfile')) {
  checkPass('Dockerfile exists');
} else {
  checkWarn('Dockerfile not found (will use Render\'s automatic build)');
}

// Check environment template
if (fs.existsSync('.env.example')) {
  checkPass('.env.example template exists');
} else {
  checkWarn('.env.example not found (consider adding for documentation)');
}

console.log('\n3. 🏥 Checking Health Check System');
console.log('-----------------------------------');

// Check health check files
const healthFiles = [
  'src/health/health-check.service.ts',
  'src/health/health-server.ts',
  'src/health/index.ts'
];

healthFiles.forEach(file => {
  if (fs.existsSync(file)) {
    checkPass(`${file} exists`);
  } else {
    checkWarn(`${file} not found (health checks may not work)`);
  }
});

console.log('\n4. 🔐 Checking Security & Secrets');
console.log('----------------------------------');

// Check .gitignore
if (fs.existsSync('.gitignore')) {
  const gitignoreContent = fs.readFileSync('.gitignore', 'utf8');
  
  checkPass('.gitignore exists');
  
  const sensitivePatterns = ['.env', 'credentials.json', 'baileys_auth_info'];
  sensitivePatterns.forEach(pattern => {
    if (gitignoreContent.includes(pattern)) {
      checkPass(`Sensitive pattern "${pattern}" in .gitignore`);
    } else {
      checkWarn(`Pattern "${pattern}" not found in .gitignore`);
    }
  });
} else {
  checkFail('.gitignore not found');
}

// Check for accidentally committed secrets
const secretFiles = ['.env', 'src/credentials/credentials.json'];
secretFiles.forEach(file => {
  if (fs.existsSync(file)) {
    checkWarn(`Secret file "${file}" exists locally - ensure it's not committed`);
  }
});

console.log('\n5. 📱 Checking WhatsApp Integration');
console.log('-----------------------------------');

// Check WhatsApp service
if (fs.existsSync('src/whatsapp/')) {
  checkPass('WhatsApp service directory exists');
} else {
  checkFail('WhatsApp service directory not found');
}

// Check message processor
if (fs.existsSync('src/whatsapp/message-processor.service.ts')) {
  checkPass('Message processor service exists');
} else {
  checkFail('Message processor service not found');
}

console.log('\n6. 🗄️ Checking Database Integration');
console.log('------------------------------------');

// Check Supabase service
if (fs.existsSync('src/supabase/supabase.service.ts')) {
  checkPass('Supabase service exists');
  
  const supabaseContent = fs.readFileSync('src/supabase/supabase.service.ts', 'utf8');
  if (supabaseContent.includes('SUPABASE_URL') && supabaseContent.includes('SUPABASE_KEY')) {
    checkPass('Supabase environment variables configured');
  } else {
    checkWarn('Supabase environment variables not found in service');
  }
} else {
  checkFail('Supabase service not found');
}

console.log('\n7. 📊 Checking Google Sheets Integration');
console.log('----------------------------------------');

// Check Sheets service
if (fs.existsSync('src/sheet/sheet.service.ts')) {
  checkPass('Google Sheets service exists');
  
  const sheetContent = fs.readFileSync('src/sheet/sheet.service.ts', 'utf8');
  if (sheetContent.includes('GOOGLE_CREDENTIALS_BASE64')) {
    checkPass('Base64 credentials support implemented');
  } else {
    checkWarn('Base64 credentials support not found (deployment may fail)');
  }
} else {
  checkWarn('Google Sheets service not found (sheets integration disabled)');
}

console.log('\n8. 🤖 Checking AI Integration');
console.log('------------------------------');

// Check AI service usage
const aiFiles = ['src/classification/category-classification.service.ts', 'src/whatsapp/message-processor.service.ts'];
let aiConfigFound = false;

aiFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('AI_API_KEY')) {
      aiConfigFound = true;
    }
  }
});

if (aiConfigFound) {
  checkPass('AI API configuration found');
} else {
  checkFail('AI API configuration not found');
}

console.log('\n📊 DEPLOYMENT READINESS SUMMARY');
console.log('================================\n');

if (allChecksPass && warnings.length === 0) {
  console.log('🎉 EXCELLENT! All checks passed. Your bot is ready for deployment!');
  console.log('\n🚀 Next steps:');
  console.log('1. Push your code to GitHub');
  console.log('2. Connect repository to Render.com');
  console.log('3. Configure environment variables');
  console.log('4. Deploy as Background Worker');
} else if (allChecksPass && warnings.length > 0) {
  console.log(`✅ GOOD! All critical checks passed, but there are ${warnings.length} warnings.`);
  console.log('\n⚠️  Warnings to address:');
  warnings.forEach((warning, index) => {
    console.log(`${index + 1}. ${warning}`);
  });
  console.log('\n🚀 You can proceed with deployment, but consider addressing warnings.');
} else {
  console.log(`❌ DEPLOYMENT NOT READY! Found ${criticalIssues.length} critical issues.`);
  console.log('\n💥 Critical issues to fix:');
  criticalIssues.forEach((issue, index) => {
    console.log(`${index + 1}. ${issue}`);
  });
  
  if (warnings.length > 0) {
    console.log('\n⚠️  Additional warnings:');
    warnings.forEach((warning, index) => {
      console.log(`${index + 1}. ${warning}`);
    });
  }
  
  console.log('\n🔧 Fix all critical issues before deployment.');
}

console.log('\n📚 Resources:');
console.log('• Deployment Guide: DEPLOYMENT_GUIDE.md');
console.log('• Environment Template: .env.example');
console.log('• Render.com Documentation: https://render.com/docs');

// Exit with appropriate code
process.exit(allChecksPass ? 0 : 1);
