#!/usr/bin/env node

/**
 * Quick SEO Testing Script
 * Run with: node test-seo.js
 * 
 * Tests basic SEO elements are present in the HTML
 */

const http = require('http');

const BASE_URL = process.env.TEST_URL || 'http://localhost:212';
const TESTS = [
  {
    name: 'Homepage - SEO Content',
    url: '/',
    checks: [
      { type: 'contains', text: 'Pokémon Color Palette Generator', required: true },
      { type: 'contains', text: 'Extract beautiful color palettes', required: true },
      { type: 'contains', text: '<title>', required: true },
      { type: 'contains', text: 'application/ld+json', required: true },
    ],
  },
  {
    name: 'Pokémon Page - Pikachu',
    url: '/pikachu',
    checks: [
      // React inserts HTML comments, so check for both parts separately
      { type: 'contains', text: 'Pikachu', required: true },
      { type: 'contains', text: 'Color Palette', required: true },
      { type: 'contains', text: '<title>', required: true },
      { type: 'contains', text: 'rel="canonical"', required: true },
    ],
  },
  {
    name: 'robots.txt',
    url: '/robots.txt',
    checks: [
      { type: 'contains', text: 'User-agent:', required: true },
      { type: 'contains', text: 'Sitemap:', required: true },
    ],
  },
  {
    name: 'Sitemap',
    url: '/sitemap.xml',
    checks: [
      { type: 'contains', text: '<?xml', required: true },
      { type: 'contains', text: '<url>', required: true },
      { type: 'contains', text: 'pokemonpalette.com', required: true },
    ],
  },
];

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function runTests() {
  console.log('🧪 Starting SEO Tests...\n');
  console.log('⚠️  Make sure your dev server is running: npm run dev\n');

  let passed = 0;
  let failed = 0;

  for (const test of TESTS) {
    console.log(`\n📋 Testing: ${test.name}`);
    console.log(`   URL: ${BASE_URL}${test.url}`);

    try {
      const result = await fetchPage(`${BASE_URL}${test.url}`);

      if (result.status !== 200) {
        console.log(`   ❌ Failed: HTTP ${result.status}`);
        failed++;
        continue;
      }

      let testPassed = true;
      for (const check of test.checks) {
        const found = result.body.includes(check.text);
        const icon = found ? '✅' : '❌';
        const status = found ? 'PASS' : 'FAIL';

        console.log(`   ${icon} ${check.text.substring(0, 50)}... ${status}`);

        if (!found && check.required) {
          testPassed = false;
        }
      }

      if (testPassed) {
        passed++;
        console.log(`   ✅ Test PASSED`);
      } else {
        failed++;
        console.log(`   ❌ Test FAILED`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      console.log(`   💡 Make sure the dev server is running: npm run dev`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 Results:`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Total: ${passed + failed}\n`);

  if (failed === 0) {
    console.log('🎉 All tests passed! Your SEO improvements are working.\n');
  } else {
    console.log('⚠️  Some tests failed. Please review the output above.\n');
  }
}

// Run tests
runTests().catch(console.error);

