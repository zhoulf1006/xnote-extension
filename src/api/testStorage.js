/**
 * Test script to identify API key storage issues
 */

import { storeValue, getStoredValue, isKeyConfigured, STORAGE_KEYS } from './storageService.js'

export async function runStorageTests() {
  console.log('🧪 Running API Key Storage Tests...')
  
  const testResults = {
    tests: [],
    passed: 0,
    failed: 0
  }
  
  // Test 1: Basic storage and retrieval
  try {
    console.log('\n📝 Test 1: Basic storage and retrieval')
    await storeValue(STORAGE_KEYS.AZURE_OPENAI_KEY, 'test-key-123')
    const retrieved = await getStoredValue(STORAGE_KEYS.AZURE_OPENAI_KEY)
    
    if (retrieved === 'test-key-123') {
      console.log('✅ Basic storage test passed')
      testResults.tests.push({ name: 'Basic storage', status: 'passed' })
      testResults.passed++
    } else {
      console.log('❌ Basic storage test failed:', { expected: 'test-key-123', actual: retrieved })
      testResults.tests.push({ name: 'Basic storage', status: 'failed', error: 'Retrieved value does not match stored value' })
      testResults.failed++
    }
  } catch (error) {
    console.log('❌ Basic storage test failed with error:', error)
    testResults.tests.push({ name: 'Basic storage', status: 'failed', error: error.message })
    testResults.failed++
  }
  
  // Test 2: Empty string handling
  try {
    console.log('\n📝 Test 2: Empty string handling')
    await storeValue(STORAGE_KEYS.DEEPSEEK_API_KEY, '')
    const retrieved = await getStoredValue(STORAGE_KEYS.DEEPSEEK_API_KEY)
    
    if (retrieved === '') {
      console.log('✅ Empty string test passed')
      testResults.tests.push({ name: 'Empty string handling', status: 'passed' })
      testResults.passed++
    } else {
      console.log('❌ Empty string test failed:', { expected: '', actual: retrieved })
      testResults.tests.push({ name: 'Empty string handling', status: 'failed', error: 'Empty string not handled correctly' })
      testResults.failed++
    }
  } catch (error) {
    console.log('❌ Empty string test failed with error:', error)
    testResults.tests.push({ name: 'Empty string handling', status: 'failed', error: error.message })
    testResults.failed++
  }
  
  // Test 3: isKeyConfigured function
  try {
    console.log('\n📝 Test 3: isKeyConfigured function')
    
    // Should be true for the key we just stored
    const isConfiguredTrue = await isKeyConfigured(STORAGE_KEYS.AZURE_OPENAI_KEY)
    
    // Should be false for empty key
    const isConfiguredFalse = await isKeyConfigured(STORAGE_KEYS.DEEPSEEK_API_KEY)
    
    if (isConfiguredTrue === true && isConfiguredFalse === false) {
      console.log('✅ isKeyConfigured test passed')
      testResults.tests.push({ name: 'isKeyConfigured function', status: 'passed' })
      testResults.passed++
    } else {
      console.log('❌ isKeyConfigured test failed:', { 
        expectedTrue: true, actualTrue: isConfiguredTrue,
        expectedFalse: false, actualFalse: isConfiguredFalse
      })
      testResults.tests.push({ name: 'isKeyConfigured function', status: 'failed', error: 'Function does not return correct boolean values' })
      testResults.failed++
    }
  } catch (error) {
    console.log('❌ isKeyConfigured test failed with error:', error)
    testResults.tests.push({ name: 'isKeyConfigured function', status: 'failed', error: error.message })
    testResults.failed++
  }
  
  // Test 4: Multiple sequential saves (simulate UI behavior)
  try {
    console.log('\n📝 Test 4: Multiple sequential saves')
    
    const testKey = STORAGE_KEYS.GEMINI_API_KEY
    
    // Simulate rapid saves like in UI
    await storeValue(testKey, 'first-value')
    await storeValue(testKey, 'second-value')
    await storeValue(testKey, 'final-value')
    
    const retrieved = await getStoredValue(testKey)
    
    if (retrieved === 'final-value') {
      console.log('✅ Sequential saves test passed')
      testResults.tests.push({ name: 'Sequential saves', status: 'passed' })
      testResults.passed++
    } else {
      console.log('❌ Sequential saves test failed:', { expected: 'final-value', actual: retrieved })
      testResults.tests.push({ name: 'Sequential saves', status: 'failed', error: 'Final value not stored correctly' })
      testResults.failed++
    }
  } catch (error) {
    console.log('❌ Sequential saves test failed with error:', error)
    testResults.tests.push({ name: 'Sequential saves', status: 'failed', error: error.message })
    testResults.failed++
  }
  
  // Test 5: Asterisk handling (common UI bug)
  try {
    console.log('\n📝 Test 5: Asterisk handling in UI')
    
    const testKey = STORAGE_KEYS.AZURE_OPENAI_KEY
    const maskedValue = '**********test-key'
    
    // This should NOT be saved since it contains asterisks (masked value)
    await storeValue(testKey, maskedValue)
    const retrieved = await getStoredValue(testKey)
    
    // This test checks if the system incorrectly saves masked values
    if (retrieved !== maskedValue) {
      console.log('✅ Asterisk handling test passed - masked value was not saved')
      testResults.tests.push({ name: 'Asterisk handling', status: 'passed' })
      testResults.passed++
    } else {
      console.log('❌ Asterisk handling test failed - system saved masked value:', retrieved)
      testResults.tests.push({ name: 'Asterisk handling', status: 'failed', error: 'System incorrectly saved masked value' })
      testResults.failed++
    }
  } catch (error) {
    console.log('❌ Asterisk handling test failed with error:', error)
    testResults.tests.push({ name: 'Asterisk handling', status: 'failed', error: error.message })
    testResults.failed++
  }
  
  console.log('\n📊 Test Results Summary:')
  console.log(`✅ Passed: ${testResults.passed}`)
  console.log(`❌ Failed: ${testResults.failed}`)
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`)
  
  if (testResults.failed > 0) {
    console.log('\n🔍 Failed Tests:')
    testResults.tests.filter(t => t.status === 'failed').forEach(test => {
      console.log(`  - ${test.name}: ${test.error}`)
    })
  }
  
  return testResults
}