#!/usr/bin/env node

const { spawn } = require('child_process');
const ngrok = require('ngrok');
const fs = require('fs');
const path = require('path');

const PORT = 212; // Your dev server port
const WEBHOOK_PATH = '/api/webhooks/clerk';

async function startDevWithNgrok() {
  console.log('🚀 Starting development server with ngrok...\n');

  try {
    // Start the Next.js development server
    console.log('📦 Starting Next.js development server...');
    const nextProcess = spawn('npm', ['run', 'dev'], {
      stdio: 'pipe',
      shell: true
    });

    // Wait for the dev server to be ready
    await new Promise((resolve) => {
      nextProcess.stdout.on('data', (data) => {
        const output = data.toString();
        process.stdout.write(output);
        
        if (output.includes('Ready') || output.includes('started server')) {
          resolve();
        }
      });

      nextProcess.stderr.on('data', (data) => {
        process.stderr.write(data);
      });
    });

    // Start ngrok tunnel
    console.log('\n🌐 Starting ngrok tunnel...');
    const url = await ngrok.connect({
      port: PORT,
      authtoken: process.env.NGROK_AUTHTOKEN, // Optional: set your ngrok authtoken
    });

    const webhookUrl = `${url}${WEBHOOK_PATH}`;

    console.log('\n✅ Development environment ready!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🌍 Local URL:    http://localhost:${PORT}`);
    console.log(`🔗 Public URL:   ${url}`);
    console.log(`📡 Webhook URL:  ${webhookUrl}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📋 Next steps:');
    console.log('1. Copy the Webhook URL above');
    console.log('2. Go to Clerk Dashboard → Webhooks');
    console.log('3. Add/Update your webhook endpoint with the URL above');
    console.log('4. Select events: user.created, user.updated, user.deleted');
    console.log('5. Test by creating/updating users in your app');
    console.log('\n💡 Tip: Keep this terminal open to maintain the tunnel');
    console.log('Press Ctrl+C to stop both the dev server and ngrok tunnel\n');

    // Save webhook URL to a file for easy access
    const webhookInfo = {
      publicUrl: url,
      webhookUrl: webhookUrl,
      localUrl: `http://localhost:${PORT}`,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(process.cwd(), '.ngrok-info.json'),
      JSON.stringify(webhookInfo, null, 2)
    );

    // Handle process termination
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down...');
      
      // Kill Next.js process
      nextProcess.kill('SIGINT');
      
      // Disconnect ngrok
      await ngrok.disconnect();
      await ngrok.kill();
      
      // Clean up info file
      try {
        fs.unlinkSync(path.join(process.cwd(), '.ngrok-info.json'));
      } catch (e) {
        // File might not exist, ignore
      }
      
      console.log('✅ Cleanup complete');
      process.exit(0);
    });

    // Keep the process running
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error starting development environment:', error);
    process.exit(1);
  }
}

startDevWithNgrok();
