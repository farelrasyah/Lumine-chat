#!/usr/bin/env node

/**
 * Script untuk encode Google Sheets credentials ke base64
 * Digunakan untuk deployment ke Render.com
 */

const fs = require('fs');
const path = require('path');

const CREDENTIALS_PATH = process.argv[2] || 'src/credentials/credentials.json';

function encodeCredentials(filePath) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Credentials file not found: ${filePath}`);
      console.log('\n📝 Usage:');
      console.log('   node scripts/encode-credentials.js [path-to-credentials.json]');
      console.log('\n💡 Example:');
      console.log('   node scripts/encode-credentials.js src/credentials/credentials.json');
      process.exit(1);
    }

    // Read and validate JSON
    const credentialsContent = fs.readFileSync(filePath, 'utf8');
    let credentialsObj;
    
    try {
      credentialsObj = JSON.parse(credentialsContent);
    } catch (e) {
      console.error(`❌ Invalid JSON in credentials file: ${e.message}`);
      process.exit(1);
    }

    // Validate required fields
    const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
    const missingFields = requiredFields.filter(field => !credentialsObj[field]);
    
    if (missingFields.length > 0) {
      console.error(`❌ Missing required fields in credentials: ${missingFields.join(', ')}`);
      process.exit(1);
    }

    // Encode to base64
    const base64Credentials = Buffer.from(credentialsContent).toString('base64');
    
    console.log('🔐 Google Sheets Credentials Encoder');
    console.log('=====================================\n');
    
    console.log(`✅ Credentials file: ${filePath}`);
    console.log(`📧 Service account: ${credentialsObj.client_email}`);
    console.log(`📁 Project ID: ${credentialsObj.project_id}`);
    console.log(`📊 Original size: ${credentialsContent.length} bytes`);
    console.log(`🔢 Base64 size: ${base64Credentials.length} characters\n`);
    
    console.log('🚀 For Render.com deployment, add this environment variable:');
    console.log('============================================================\n');
    
    console.log(`GOOGLE_CREDENTIALS_BASE64=${base64Credentials}\n`);
    
    console.log('📋 Steps to deploy:');
    console.log('1. Copy the base64 string above');
    console.log('2. In Render.com dashboard, go to your service');
    console.log('3. Navigate to "Environment" tab');
    console.log('4. Add new environment variable:');
    console.log('   Key: GOOGLE_CREDENTIALS_BASE64');
    console.log('   Value: [paste the base64 string]');
    console.log('5. Save and redeploy your service\n');
    
    // Save to file for convenience
    const outputFile = 'credentials-base64.txt';
    fs.writeFileSync(outputFile, base64Credentials);
    console.log(`💾 Base64 credentials also saved to: ${outputFile}`);
    console.log(`⚠️  Remember to add ${outputFile} to .gitignore\n`);

    // Security reminder
    console.log('🔒 SECURITY REMINDER:');
    console.log('=====================');
    console.log('• Never commit credentials to version control');
    console.log('• Keep your service account key secure');
    console.log('• Regularly rotate your credentials');
    console.log('• Use environment variables for all secrets');
    console.log('• Monitor access logs in Google Cloud Console\n');

    console.log('✨ Encoding completed successfully!');

  } catch (error) {
    console.error(`❌ Error encoding credentials: ${error.message}`);
    process.exit(1);
  }
}

// Run the encoder
encodeCredentials(CREDENTIALS_PATH);
