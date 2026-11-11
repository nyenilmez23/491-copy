import { AudioQuality, IOSOutputFormat } from 'expo-audio';
import type { RecordingOptions } from 'expo-audio';

const SAMPLE_RATE = 44100;
const CHANNELS = 1;
const BIT_DEPTH = 16;

/**
 * Standard mono, 16-bit little-endian integer PCM WAV, which the PM2 backend
 * accepts (docs/api.md). On iOS, AVAudioRecorder picks the WAVE container
 * from the `.wav` extension. Files go to the app's document directory so they
 * survive a restart; the cache directory can be purged by the system.
 *
 * Only iOS is targeted for PM2. Android cannot record PCM WAV with these
 * options, so its settings are placeholders.
 */
export const WAV_RECORDING_OPTIONS: RecordingOptions = {
  extension: '.wav',
  sampleRate: SAMPLE_RATE,
  numberOfChannels: CHANNELS,
  bitRate: SAMPLE_RATE * CHANNELS * BIT_DEPTH,
  directory: 'document',
  isMeteringEnabled: false,
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.MAX,
    linearPCMBitDepth: BIT_DEPTH,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: {
    outputFormat: 'default',
    audioEncoder: 'default',
  },
  web: {},
};

/** Full options for one take. The file is named after its take ID. */
export function recordingOptionsForTake(takeId: string): RecordingOptions {
  return { ...WAV_RECORDING_OPTIONS, fileName: `take-${takeId}` };
}
