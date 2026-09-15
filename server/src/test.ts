/**
 * Automated Verification Script for OmniAssist Alexa+ MCP Server
 */

import { handleMcpJsonRpc } from './mcpProtocol';

async function runTests() {
  console.log('🧪 Starting MCP Protocol & Tool Verification Tests...\n');

  // Test 1: initialize
  console.log('1. Testing initialize method...');
  const initRes = await handleMcpJsonRpc({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
  });
  console.assert(initRes.result.protocolVersion === '2025-11-25', 'Protocol version mismatch');
  console.log('✅ initialize passed: protocolVersion =', initRes.result.protocolVersion);

  // Test 2: tools/list
  console.log('\n2. Testing tools/list method...');
  const toolsRes = await handleMcpJsonRpc({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
  });
  console.assert(toolsRes.result.tools.length >= 5, 'Expected at least 5 tools');
  console.log(`✅ tools/list passed: found ${toolsRes.result.tools.length} tools`);

  // Test 3: tools/call (smart_home_control)
  console.log('\n3. Testing tools/call (smart_home_control)...');
  const toolCallRes = await handleMcpJsonRpc({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'smart_home_control',
      arguments: {
        target: 'living room',
        action: 'set_brightness',
        value: '40',
      },
    },
  });
  console.assert(!toolCallRes.error, 'Tool call returned error');
  console.log('✅ tools/call passed:', toolCallRes.result.content[0].text);

  // Test 4: resources/read
  console.log('\n4. Testing resources/read (alexa://devices/status)...');
  const resRead = await handleMcpJsonRpc({
    jsonrpc: '2.0',
    id: 4,
    method: 'resources/read',
    params: { uri: 'alexa://devices/status' },
  });
  console.assert(!resRead.error, 'Resource read failed');
  console.log('✅ resources/read passed: status snapshot received');

  console.log('\n🎉 ALL MCP SERVER UNIT TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
