#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Utility script to help test webhook functionality
 */

function getWebhookInfo() {
  try {
    const infoPath = path.join(process.cwd(), '.ngrok-info.json');
    if (fs.existsSync(infoPath)) {
      const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
      return info;
    }
    return null;
  } catch (error) {
    return null;
  }
}

function displayWebhookInfo() {
  const info = getWebhookInfo();
  
  if (!info) {
    console.log('❌ No ngrok tunnel found. Start development server with:');
    console.log('   npm run dev:ngrok');
    return;
  }

  console.log('🔗 Current Webhook Information');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Webhook URL: ${info.webhookUrl}`);
  console.log(`🌍 Public URL:  ${info.publicUrl}`);
  console.log(`🏠 Local URL:   ${info.localUrl}`);
  console.log(`⏰ Started:     ${new Date(info.timestamp).toLocaleString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📋 Setup Instructions:');
  console.log('1. Copy the Webhook URL above');
  console.log('2. Go to Clerk Dashboard → Webhooks');
  console.log('3. Add/Update endpoint with the Webhook URL');
  console.log('4. Select events: user.created, user.updated, user.deleted');
  console.log('5. Copy the webhook secret to your .env.local file');
}

function generateTestCurl() {
  const info = getWebhookInfo();
  
  if (!info) {
    console.log('❌ No ngrok tunnel found.');
    return;
  }

  console.log('\n🧪 Test your webhook endpoint:');
  console.log(`curl -X POST ${info.webhookUrl} \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"test": "webhook"}'`);
}

// Main execution
const command = process.argv[2];

switch (command) {
  case 'info':
    displayWebhookInfo();
    break;
  case 'curl':
    generateTestCurl();
    break;
  case 'url':
    const info = getWebhookInfo();
    if (info) {
      console.log(info.webhookUrl);
    } else {
      console.log('No ngrok tunnel found');
      process.exit(1);
    }
    break;
  default:
    console.log('🔧 Webhook Testing Utility');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/test-webhook.js info  - Show webhook information');
    console.log('  node scripts/test-webhook.js url   - Get webhook URL only');
    console.log('  node scripts/test-webhook.js curl  - Generate test curl command');
    console.log('');
    console.log('Examples:');
    console.log('  npm run dev:ngrok                  - Start dev server with ngrok');
    console.log('  node scripts/test-webhook.js info  - Show current webhook info');
}
