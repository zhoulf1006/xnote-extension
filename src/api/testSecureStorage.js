/**
 * Test script for secure storage functionality
 * Run this in the browser console to test encryption
 */

import { secureStorageService, STORAGE_KEYS } from './storageService.js'

export async function runSecureStorageTests() {
  console.log('🔐 Running Secure Storage Tests...')
  
  try {
    // Test 1: Initialize secure storage
    console.log('\n📝 Test 1: Initialize secure storage')
    await secureStorageService.initialize()
    const status = secureStorageService.getEncryptionStatus()
    console.log('Encryption status:', status)
    
    if (status.encryptionEnabled) {
      console.log('✅ Encryption is enabled')
    } else {
      console.log('⚠️ Encryption not available, using plain storage')
    }
    
    // Test 2: Test encryption functionality
    console.log('\n📝 Test 2: Test encryption functionality')
    const encryptionTest = await secureStorageService.testEncryption()
    console.log('Encryption test result:', encryptionTest)
    
    if (encryptionTest.success) {
      console.log('✅ Encryption test passed')
    } else {
      console.log('❌ Encryption test failed:', encryptionTest.error)
    }
    
    // Test 3: Store and retrieve a test API key
    console.log('\n📝 Test 3: Store and retrieve test API key')
    const testKey = 'sk-test-1234567890abcdef'
    await secureStorageService.storeSecure(STORAGE_KEYS.AZURE_OPENAI_KEY, testKey)
    const retrieved = await secureStorageService.getSecure(STORAGE_KEYS.AZURE_OPENAI_KEY)
    
    if (retrieved === testKey) {
      console.log('✅ API key storage/retrieval test passed')
    } else {
      console.log('❌ API key storage/retrieval test failed')
      console.log('Expected:', testKey)
      console.log('Actual:', retrieved)
    }
    
    // Test 4: Check if key is properly configured
    console.log('\n📝 Test 4: Check key configuration status')
    const isConfigured = await secureStorageService.isSecureKeyConfigured(STORAGE_KEYS.AZURE_OPENAI_KEY)
    
    if (isConfigured) {
      console.log('✅ Key configuration check passed')
    } else {
      console.log('❌ Key configuration check failed')
    }
    
    // Test 5: Test empty string handling
    console.log('\n📝 Test 5: Test empty string handling')
    await secureStorageService.storeSecure(STORAGE_KEYS.DEEPSEEK_API_KEY, '')
    const emptyRetrieved = await secureStorageService.getSecure(STORAGE_KEYS.DEEPSEEK_API_KEY)
    const isEmptyConfigured = await secureStorageService.isSecureKeyConfigured(STORAGE_KEYS.DEEPSEEK_API_KEY)
    
    if (emptyRetrieved === '' && !isEmptyConfigured) {
      console.log('✅ Empty string handling test passed')
    } else {
      console.log('❌ Empty string handling test failed')
      console.log('Retrieved value:', emptyRetrieved)
      console.log('Is configured:', isEmptyConfigured)
    }
    
    // Test 6: Get encryption status info
    console.log('\n📝 Test 6: Get detailed encryption status')
    const detailedStatus = secureStorageService.getEncryptionStatus()
    console.log('Detailed encryption status:', detailedStatus)
    
    console.log('\n🎉 All secure storage tests completed!')
    return {
      success: true,
      encryptionEnabled: status.encryptionEnabled,
      testsRun: 6
    }
    
  } catch (error) {
    console.error('❌ Secure storage test failed:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// Utility function to manually test encryption in console
export async function testEncryptionInConsole() {
  const { default: encryptionService } = await import('./encryptionService.js')
  
  console.log('🔐 Manual Encryption Test')
  
  try {
    await encryptionService.initialize()
    
    const testData = 'sk-test-api-key-12345'
    console.log('Original:', testData)
    
    const encrypted = await encryptionService.encrypt(testData)
    console.log('Encrypted:', encrypted)
    
    const decrypted = await encryptionService.decrypt(encrypted)
    console.log('Decrypted:', decrypted)
    
    console.log('Test result:', testData === decrypted ? '✅ PASS' : '❌ FAIL')
    
    return testData === decrypted
  } catch (error) {
    console.error('Encryption test error:', error)
    return false
  }
}