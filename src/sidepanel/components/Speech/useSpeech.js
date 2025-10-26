import { ref, onMounted, onUnmounted } from 'vue';
import { textToSpeech, getAvailableVoices, saveSpeechToFile, initializeSpeechConfig } from '@/api/azureSpeech';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { voicePresets } from '@/config/voicePresets';

const SPEECH_STORAGE_KEY = 'xnote-speech';

export function useSpeech() {
  const voices = ref([]);
  const selectedVoice = ref(null);
  const isPlaying = ref(false);
  const isRecording = ref(false);
  const transcript = ref('');
  const inputText = ref('');
  const recognition = ref(null);
  const currentSynthesizer = ref(null);
  const currentAudioSource = ref(null);
  const currentAudioContext = ref(null);

  // AudioContext fallback function
  const tryAudioContextFallback = async (audioData) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      currentAudioContext.value = audioContext;
      
      // Decode the audio data
      const audioBuffer = await audioContext.decodeAudioData(audioData.slice(0));
      
      // Create audio source
      const source = audioContext.createBufferSource();
      currentAudioSource.value = source;
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      // Handle playback events
      source.onended = () => {
        isPlaying.value = false;
        currentAudioSource.value = null;
        currentAudioContext.value = null;
        audioContext.close();
      };
      
      // Start playback
      source.start(0);
      isPlaying.value = true;
      console.log('Audio playback started using AudioContext fallback');
      
    } catch (audioContextError) {
      console.error('AudioContext fallback also failed:', audioContextError);
      isPlaying.value = false;
      throw new Error('Unable to play audio. This might be due to an unsupported audio format or Azure Speech configuration issue.');
    }
  };

  // Load saved settings
  const loadSettings = () => {
    try {
      const saved = localStorage.getItem(SPEECH_STORAGE_KEY);
      if (saved) {
        const settings = JSON.parse(saved);
        if (settings.voiceName) {
          // Find voice in presets
          for (const lang in voicePresets) {
            const voice = voicePresets[lang].find(v => v.name === settings.voiceName);
            if (voice) {
              selectedVoice.value = voice;
              break;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading speech settings:', error);
    }
  };

  // Save current settings
  const saveSettings = () => {
    try {
      const settings = {
        voiceName: selectedVoice.value?.name
      };
      localStorage.setItem(SPEECH_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving speech settings:', error);
    }
  };

  // Initialize speech recognition
  const initRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognition.value = new SpeechRecognition();
      recognition.value.continuous = true;
      recognition.value.interimResults = true;

      recognition.value.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        transcript.value = finalTranscript + interimTranscript;
      };

      recognition.value.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        isRecording.value = false;
      };
    }
  };

  // Load available voices
  const loadVoices = async () => {
    try {
      // Initialize speech config first
      await initializeSpeechConfig();
      
      // Set default voice from environment or first available voice
      const defaultVoiceName = import.meta.env.VITE_AZURE_SPEECH_DEFAULT_VOICE;
      const defaultLanguage = defaultVoiceName?.split('-')[0] || 'en-US';
      const defaultVoices = voicePresets[defaultLanguage];
      
      if (defaultVoices?.length) {
        selectedVoice.value = defaultVoices[0];
      }
    } catch (error) {
      console.error('Error loading voices:', error);
    }
  };

  // Text to Speech (now only for playback)
  const speak = async (text, autoPlay = true) => {
    try {
      // Initialize speech config first
      await initializeSpeechConfig();
      
      // Close any existing synthesizer
      if (currentSynthesizer.value) {
        currentSynthesizer.value.close();
        currentSynthesizer.value = null;
      }

      const audioData = await textToSpeech(
        {
          text,
          voiceName: selectedVoice.value?.name
        },
        null, // Don't set isPlaying here, set it when audio actually starts playing
        null, // Don't set isPlaying to false here, let the audio playback handle it
        (error) => {
          console.error('Speech synthesis error:', error);
          isPlaying.value = false;
        }
      );

      if (autoPlay) {
        try {
          console.log('Audio data received, length:', audioData ? audioData.byteLength || audioData.length : 'undefined');
          
          if (!audioData || (audioData.byteLength || audioData.length) === 0) {
            throw new Error('No audio data received from Azure Speech service');
          }
          
          // Since Azure Speech returns MP3 data, use HTML5 Audio as primary method
          // MP3 is better supported by HTML5 Audio than AudioContext in most browsers
          const blob = new Blob([audioData], { type: 'audio/mp3' });
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          currentAudioSource.value = audio;
          
          // Set up event handlers
          audio.oncanplaythrough = () => {
            console.log('Audio can play through');
          };
          
          audio.onended = () => {
            isPlaying.value = false;
            currentAudioSource.value = null;
            URL.revokeObjectURL(url);
          };
          
          audio.onerror = (error) => {
            console.error('HTML5 Audio playback error:', error);
            currentAudioSource.value = null;
            URL.revokeObjectURL(url);
            
            // Try AudioContext as fallback (though less likely to work with MP3)
            tryAudioContextFallback(audioData);
          };
          
          audio.onloadeddata = () => {
            console.log('Audio data loaded successfully');
          };
          
          // Try to play
          await audio.play();
          isPlaying.value = true;
          console.log('Audio playback started using HTML5 Audio');
          
        } catch (primaryError) {
          console.warn('HTML5 Audio failed, trying AudioContext fallback:', primaryError.message);
          await tryAudioContextFallback(audioData);
        }
      }
      
      return audioData;
    } catch (error) {
      console.error('Error in speech synthesis:', error);
      isPlaying.value = false;
      throw error;
    }
  };

  // Save audio as WAV file (new implementation)
  const saveAudio = async (text, filename, format = 'wav') => {
    try {
      // Initialize speech config first
      await initializeSpeechConfig();
      
      if (!selectedVoice.value?.name) {
        throw new Error('No voice selected');
      }
      await saveSpeechToFile(
        text,
        selectedVoice.value.name,
        filename,
        format
      );
    } catch (error) {
      console.error('Error saving audio:', error);
      throw error;
    }
  };

  // Stop speaking
  const stop = () => {
    // Stop Azure Speech synthesizer if running
    if (currentSynthesizer.value) {
      currentSynthesizer.value.close();
      currentSynthesizer.value = null;
    }
    
    // Stop AudioContext source if running
    if (currentAudioSource.value) {
      try {
        if (currentAudioSource.value.stop) {
          // AudioContext BufferSource
          currentAudioSource.value.stop();
        } else if (currentAudioSource.value.pause) {
          // HTML Audio element
          currentAudioSource.value.pause();
          currentAudioSource.value.currentTime = 0;
        }
      } catch (error) {
        console.warn('Error stopping audio source:', error);
      }
      currentAudioSource.value = null;
    }
    
    // Close AudioContext if open
    if (currentAudioContext.value) {
      try {
        currentAudioContext.value.close();
      } catch (error) {
        console.warn('Error closing audio context:', error);
      }
      currentAudioContext.value = null;
    }
    
    // Reset playing state
    isPlaying.value = false;
  };

  // Toggle recording
  const toggleRecording = () => {
    if (!recognition.value) return;
    
    if (isRecording.value) {
      recognition.value.stop();
      isRecording.value = false;
    } else {
      transcript.value = '';
      recognition.value.start();
      isRecording.value = true;
    }
  };

  onMounted(() => {
    loadSettings();
    initRecognition();
    loadVoices();
  });

  onUnmounted(() => {
    stop();
    if (recognition.value && isRecording.value) {
      recognition.value.stop();
    }
  });

  return {
    voices,
    selectedVoice,
    isPlaying,
    isRecording,
    transcript,
    inputText,
    speak,
    saveAudio,
    stop,
    toggleRecording,
    saveSettings
  };
} 