/**
 * Manual test script for @proofgate/sdk
 * 
 * Run: npx ts-node test/manual-test.ts
 */

import { ProofGate, ProofGateError } from '../src/index';

const API_KEY = process.env.PROOFGATE_API_KEY || 'pg_test_key';

async function testSDK() {
  console.log('🧪 Testing @proofgate/sdk\n');

  // Test 1: Initialize client
  console.log('1️⃣ Testing client initialization...');
  try {
    const pg = new ProofGate({ apiKey: API_KEY });
    console.log('   ✅ Client initialized\n');
  } catch (error) {
    console.log('   ❌ Failed:', error);
  }

  // Test 2: Invalid API key
  console.log('2️⃣ Testing invalid API key rejection...');
  try {
    new ProofGate({ apiKey: '' });
    console.log('   ❌ Should have thrown\n');
  } catch (error) {
    if (error instanceof ProofGateError && error.code === 'MISSING_API_KEY') {
      console.log('   ✅ Correctly rejected empty key\n');
    }
  }

  // Test 3: Invalid key format
  console.log('3️⃣ Testing invalid key format rejection...');
  try {
    new ProofGate({ apiKey: 'invalid_key' });
    console.log('   ❌ Should have thrown\n');
  } catch (error) {
    if (error instanceof ProofGateError && error.code === 'INVALID_API_KEY') {
      console.log('   ✅ Correctly rejected bad format\n');
    }
  }

  // Test 4: Validate (will fail without real key, but tests the flow)
  console.log('4️⃣ Testing validation request...');
  if (API_KEY !== 'pg_test_key') {
    try {
      const pg = new ProofGate({ apiKey: API_KEY });
      const result = await pg.validate({
        from: '0x1234567890123456789012345678901234567890' as `0x${string}`,
        to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`,
        data: '0xa9059cbb' as `0x${string}`,
        value: '0',
      });
      console.log('   ✅ Validation result:', result.safe ? 'PASS' : 'FAIL');
      console.log('   Reason:', result.reason, '\n');
    } catch (error) {
      if (error instanceof ProofGateError) {
        console.log('   ⚠️ API Error:', error.message, '\n');
      }
    }
  } else {
    console.log('   ⏭️ Skipped (no real API key)\n');
  }

  // Test 5: Check agent
  console.log('5️⃣ Testing agent check...');
  if (API_KEY !== 'pg_test_key') {
    try {
      const pg = new ProofGate({ apiKey: API_KEY });
      const agent = await pg.checkAgent('0x1234567890123456789012345678901234567890' as `0x${string}`);
      console.log('   ✅ Agent check:', agent.verificationStatus);
      console.log('   Trust score:', agent.trustScore, '\n');
    } catch (error) {
      if (error instanceof ProofGateError) {
        console.log('   ⚠️ API Error:', error.message, '\n');
      }
    }
  } else {
    console.log('   ⏭️ Skipped (no real API key)\n');
  }

  console.log('✨ Tests complete!\n');
  console.log('To test with real API:');
  console.log('  PROOFGATE_API_KEY=pg_your_key npx ts-node test/manual-test.ts');
}

testSDK().catch(console.error);
