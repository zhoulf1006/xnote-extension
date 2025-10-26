# Speech Feature

## User Stories

### Story 1: Text-to-Speech Conversion
**As a** user who prefers audio content  
**I want to** convert text into natural-sounding speech  
**So that** I can consume content through audio while multitasking or for better accessibility

**Acceptance Criteria:**
1. Given I have text input
   When I click the speak button
   Then the text is converted to speech and plays audio

2. Given speech is playing
   When I click the stop button
   Then the audio playback stops immediately

3. Given I select different voices
   When I play the text
   Then it uses the selected voice for speech

4. Given I'm using the feature
   When I change language settings
   Then available voices update to match the selected language

5. Given speech is playing
   When I input new text
   Then current playback stops before starting new speech

### Story 2: Voice Configuration
**As a** user with specific language or voice preferences  
**I want to** customize the speech settings  
**So that** I can have a personalized and comfortable listening experience

**Acceptance Criteria:**
1. Given I'm on the speech page
   When I view voice options
   Then I see available voices grouped by language

2. Given I select a language
   When I view voice options
   Then I only see voices for that language

3. Given I change voice settings
   When I play new text
   Then my preferences are remembered

4. Given speech is configured
   When I close and reopen the extension
   Then my voice preferences are preserved

## Product Requirements

### 1. Functionality Overview
The Speech feature provides text-to-speech conversion capabilities using Azure Speech Services, allowing users to listen to text content with customizable voice options and language settings.

### 2. Detailed Requirements

#### Inputs
- Text content (string)
- Voice selection (from available options)
- Language selection (supported languages)
- Playback controls (play/stop)

#### Processing
- Text normalization
- Language detection
- Voice synthesis
- Audio stream handling

#### Outputs
- Audio playback
- Voice selection UI
- Language selection UI
- Playback status indicators

### 3. Business Rules
- Support multiple languages (en-US, zh-CN, ja-JP)
- Default to system language if available
- Maintain voice preferences
- Handle text length limits
- Respect API rate limits

### 4. Dependencies
- Azure Speech Service
- Browser audio capabilities
- Extension storage permissions
- Vue.js framework

### 5. User Interaction
- Text input area
- Voice selection dropdown
- Language selection
- Play/Stop controls
- Loading indicators

### 6. Performance Requirements
- Speech synthesis starts within 1 second
- Voice list loads within 500ms
- Smooth audio playback
- Efficient memory usage
- Quick language switching

### 7. Security Requirements
- Secure API key handling
- Input sanitization
- Safe audio processing
- Secure storage of preferences

### 8. Data Requirements
- Voice configuration structure:
  ```typescript
  {
    language: string
    voice: string
    pitch: number
    rate: number
    volume: number
  }
  ```
- Local storage for preferences
- Voice metadata caching

### 9. Acceptance Criteria
- All user stories acceptance criteria met
- Voice selection works across languages
- Preferences persist between sessions
- Error handling implemented
- Smooth playback control

### 10. Constraints and Limitations
- Azure Speech Service quotas
- Browser audio limitations
- Text length restrictions
- Network dependency
- Storage limits

### 11. Localization and Accessibility
- Multi-language support
- Screen reader compatibility
- Keyboard controls
- Visual feedback for audio state
- Clear error messages in user's language

## API Key Configuration

The Speech component now supports configuring Azure Speech API keys and region through the UI:

1. Click the configuration (gear) icon in the top-right of the Speech page
2. Enter your Azure Speech API key and region
3. Click "Save" to store the configuration

### Storage Modes

- **Extension Mode**: When running as a Chrome extension, API keys and region are securely stored in Chrome's account storage, making them available across devices with the same Chrome account.
- **Development Mode**: In local development, configuration falls back to environment variables (`VITE_AZURE_SPEECH_KEY` and `VITE_AZURE_SPEECH_REGION`).

### Security Considerations

- API keys are displayed in a masked format in the UI for security
- Configuration is checked on page load but not pre-loaded until the Speech page is visited
- API keys are securely stored in Chrome's synced storage when in extension mode

### Implementation Details

Configuration is handled through several components:

- `storageService.js`: Provides an abstraction for storage operations
- `azureSpeech.js`: Initializes speech service using keys from storage
- `Speech/index.vue`: Provides UI for configuring the speech service