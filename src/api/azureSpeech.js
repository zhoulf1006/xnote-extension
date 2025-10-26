import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { getStoredValue, STORAGE_KEYS, isExtensionMode as checkExtensionMode } from './storageService';
import { getSecureValue } from './secureStorageService';

export const SpeechSynthesizer = sdk.SpeechSynthesizer;

// Default voice will be set when user selects
const defaultVoice = import.meta.env.VITE_AZURE_SPEECH_DEFAULT_VOICE;

// Supported languages
const supportedLanguages = (import.meta.env.VITE_AZURE_SPEECH_LANGUAGES || 'en-US,zh-CN,ja-JP').split(',');

// Flag to track initialization
let isInitialized = false;
let speechConfig = null;

/**
 * Initialize speech config with API key and region from storage or environment
 * @returns {Promise<sdk.SpeechConfig|null>} The speech config or null if not configured
 */
export async function initializeSpeechConfig() {
  // Reset initialization state if called explicitly
  isInitialized = false;
  speechConfig = null;
  
  try {
    // Use secure storage for API key (encrypted)
    const key = await getSecureValue(
      STORAGE_KEYS.AZURE_SPEECH_KEY, 
      'VITE_AZURE_SPEECH_KEY'
    );
    
    // Region is not sensitive, use regular storage
    const region = await getStoredValue(
      STORAGE_KEYS.AZURE_SPEECH_REGION, 
      'VITE_AZURE_SPEECH_REGION'
    );
    
    if (!key || !region) {
      console.warn('Azure Speech API key or region not configured');
      return null;
    }
    
    speechConfig = sdk.SpeechConfig.fromSubscription(key, region);
    
    // Set output format to MP3 for better browser compatibility with AudioContext
    speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;
    
    isInitialized = true;
    return speechConfig;
  } catch (error) {
    console.error('Error initializing speech config:', error);
    isInitialized = false;
    speechConfig = null;
    return null;
  }
}

/**
 * Check if Speech API is properly configured
 * @returns {Promise<boolean>} Whether the speech service is configured
 */
export async function isSpeechConfigured() {
  const key = await getSecureValue(
    STORAGE_KEYS.AZURE_SPEECH_KEY, 
    'VITE_AZURE_SPEECH_KEY'
  );
  
  const region = await getStoredValue(
    STORAGE_KEYS.AZURE_SPEECH_REGION, 
    'VITE_AZURE_SPEECH_REGION'
  );
  
  return Boolean(key && region);
}

/**
 * Get speech configuration status
 * @returns {Promise<Object>} Configuration status
 */
export async function getSpeechConfigStatus() {
  const key = await getSecureValue(
    STORAGE_KEYS.AZURE_SPEECH_KEY, 
    'VITE_AZURE_SPEECH_KEY'
  );
  
  const region = await getStoredValue(
    STORAGE_KEYS.AZURE_SPEECH_REGION, 
    'VITE_AZURE_SPEECH_REGION'
  );
  
  return {
    isConfigured: Boolean(key && region),
    hasKey: Boolean(key),
    hasRegion: Boolean(region),
    isExtensionMode: checkExtensionMode()
  };
}

// Create a speech synthesizer
export async function createSpeechSynthesizer(voiceName = defaultVoice) {
  // Ensure config is initialized
  await initializeSpeechConfig();
  
  if (!speechConfig) {
    throw new Error('Speech service not configured. Please configure Azure Speech in the settings.');
  }
  
  // Reset speech config voice name if provided
  if (voiceName) {
    speechConfig.speechSynthesisVoiceName = voiceName;
  }
  
  // Create audio config to prevent auto-playback
  const audioConfig = sdk.AudioConfig.fromDefaultSpeakerOutput();
  audioConfig.close(); // Close to prevent auto-playback
  
  // Create synthesizer with null audio config to prevent auto-playback
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);
  return synthesizer;
}

export async function textToSpeech(text, onAudioStart, onAudioEnd, onError) {
  return new Promise(async (resolve, reject) => {
    try {
      // Get voice name from text object or use default
      const voiceName = text.voiceName || defaultVoice;
      const synthesizer = await createSpeechSynthesizer(voiceName);

      // We no longer handle audio events here since we control playback in useSpeech.js
      // The audio start/end states are managed by the actual audio playback, not synthesis completion

      synthesizer.speakTextAsync(
        text.text?.toString() || '',
        result => {
          if (result) {
            // Get the audio data
            const audioData = result.audioData;
            // Don't call onAudioEnd here - let the actual audio playback handle it
            synthesizer.close();
            resolve(audioData);
          }
        },
        error => {
          onError?.(error);
          synthesizer.close();
          reject(error);
        }
      );
    } catch (error) {
      onError?.(error);
      reject(error);
    }
  });
}

// Filter and organize voices by language
function organizeVoices(voices) {
  const voicesByLanguage = {};

  // Simplify voice categorization
  voices.forEach(voice => {
    const locale = voice.locale;
    if (supportedLanguages.includes(locale)) {
      voicesByLanguage[locale] = voicesByLanguage[locale] || { male: [], female: [] };

      // Add voice to appropriate gender category
      const category = voice.gender === 'Female' ? 'female' : 'male';
      voicesByLanguage[locale][category].push(voice);
    }
  });

  return voicesByLanguage;
}

export async function getAvailableVoices() {
  return new Promise(async (resolve, reject) => {
    try {
      const synthesizer = await createSpeechSynthesizer();

      synthesizer.getVoicesAsync(
        '',  // Empty string to get all voices
        voices => {
          synthesizer.close();
          const organizedVoices = organizeVoices(voices);
          resolve(organizedVoices);
        },
        error => {
          synthesizer.close();
          reject(error);
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

// Function to save speech to file
export async function saveSpeechToFile(text, voiceName, filename, format = 'mp3') {
  return new Promise(async (resolve, reject) => {
    try {
      await initializeSpeechConfig();
      
      if (!speechConfig) {
        throw new Error('Speech service not configured. Please configure Azure Speech in the settings.');
      }
      
      // Create a new speech config instance for file saving to avoid modifying the global one
      const key = await getStoredValue(STORAGE_KEYS.AZURE_SPEECH_KEY, 'VITE_AZURE_SPEECH_KEY');
      const region = await getStoredValue(STORAGE_KEYS.AZURE_SPEECH_REGION, 'VITE_AZURE_SPEECH_REGION');
      const fileSpeechConfig = sdk.SpeechConfig.fromSubscription(key, region);
      
      // Set voice if provided
      if (voiceName) {
        fileSpeechConfig.speechSynthesisVoiceName = voiceName;
      }

      // Set output format based on requested format
      if (format === 'mp3') {
        fileSpeechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;
      } else if (format === 'wav') {
        fileSpeechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm;
      }

      // Create synthesizer for file output with null audio config to prevent auto-playback
      const synthesizer = new sdk.SpeechSynthesizer(fileSpeechConfig, null);

      synthesizer.speakTextAsync(
        text,
        result => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            const audioData = result.audioData;
            const blob = new Blob([audioData], { 
              type: format === 'mp3' ? 'audio/mp3' : 'audio/wav'
            });
            const url = URL.createObjectURL(blob);
            
            // Ensure filename has correct extension
            const finalFilename = filename.endsWith(`.${format}`) ? filename : `${filename}.${format}`;
            
            // Create a temporary link to trigger download
            const a = document.createElement('a');
            a.href = url;
            a.download = finalFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            synthesizer.close();
            resolve(finalFilename);
          } else {
            synthesizer.close();
            reject(new Error(result.errorDetails));
          }
        },
        error => {
          synthesizer.close();
          reject(error);
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}