import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';

import type {
  RecordingMode,
  SelectedAudio,
  UploadTakeResponse,
} from './src/api/types';
import { MAX_AUDIO_BYTES } from './src/api/types';
import { uploadTake } from './src/api/uploadTake';

type UploadPhase = 'idle' | 'uploading' | 'success' | 'error';

function formatBytes(size: number | null): string {
  if (size == null) {
    return 'Unknown size';
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function formatResponse(result: UploadTakeResponse | null): string {
  if (!result) {
    return '';
  }

  if (result.ok) {
    return result.rawText || JSON.stringify(result.body, null, 2);
  }

  if (result.rawText) {
    return result.rawText;
  }

  if (result.body != null) {
    return JSON.stringify(result.body, null, 2);
  }

  return result.message;
}

export default function App() {
  const [baseUrl, setBaseUrl] = useState('');
  const [developerSettingsOpen, setDeveloperSettingsOpen] = useState(false);
  const [recordingMode, setRecordingMode] =
    useState<RecordingMode>('separate_take');
  const [selectedAudio, setSelectedAudio] = useState<SelectedAudio | null>(
    null,
  );
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [uploadResult, setUploadResult] = useState<UploadTakeResponse | null>(
    null,
  );
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSelectAudio() {
    setLocalError(null);

    const result = await DocumentPicker.getDocumentAsync({
      type: ['audio/*', 'public.audio'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const asset = result.assets[0];
    const size = asset.size ?? null;

    if (size != null && size <= 0) {
      setSelectedAudio(null);
      setPhase('idle');
      setUploadResult(null);
      setLocalError('Selected audio file is empty.');
      return;
    }

    if (size != null && size > MAX_AUDIO_BYTES) {
      setSelectedAudio(null);
      setPhase('idle');
      setUploadResult(null);
      setLocalError(
        `Selected audio exceeds the ${MAX_AUDIO_BYTES} byte (32 MiB) limit.`,
      );
      return;
    }

    setSelectedAudio({
      uri: asset.uri,
      name: asset.name,
      size,
      mimeType: asset.mimeType ?? null,
      projectId: Crypto.randomUUID(),
      takeId: Crypto.randomUUID(),
    });
    setPhase('idle');
    setUploadResult(null);
  }

  async function handleUpload() {
    setLocalError(null);

    if (!selectedAudio) {
      setLocalError('Select an audio file before uploading.');
      return;
    }

    if (!baseUrl.trim()) {
      setLocalError('Enter a backend base URL.');
      return;
    }

    setPhase('uploading');
    setUploadResult(null);

    const result = await uploadTake({
      baseUrl,
      projectId: selectedAudio.projectId,
      takeId: selectedAudio.takeId,
      recordingMode,
      audio: {
        uri: selectedAudio.uri,
        name: selectedAudio.name,
        mimeType: selectedAudio.mimeType,
      },
    });

    setUploadResult(result);
    setPhase(result.ok ? 'success' : 'error');
  }

  const statusLabel =
    phase === 'uploading'
      ? 'Uploading…'
      : phase === 'success'
        ? 'Success'
        : phase === 'error'
          ? 'Error'
          : 'Idle';

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Intelligent Music Recorder</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recording</Text>
          <Text style={styles.hint}>
            Microphone recording is not connected yet. These controls are
            placeholders for Emir’s recording module.
          </Text>
          <View style={styles.modeRow}>
            <Pressable style={[styles.modeButton, styles.placeholderButton]} disabled>
              <Text style={[styles.modeButtonText, styles.placeholderButtonText]}>
                Record
              </Text>
            </Pressable>
            <Pressable style={[styles.modeButton, styles.placeholderButton]} disabled>
              <Text style={[styles.modeButtonText, styles.placeholderButtonText]}>
                Stop
              </Text>
            </Pressable>
          </View>
          <Text style={styles.meta}>Status: Not connected</Text>
        </View>

        <Text style={styles.label}>Recording mode</Text>
        <View style={styles.modeRow}>
          {(
            [
              ['separate_take', 'Separate take'],
              ['continuous_recording', 'Continuous'],
            ] as const
          ).map(([value, label]) => {
            const selected = recordingMode === value;
            return (
              <Pressable
                key={value}
                onPress={() => setRecordingMode(value)}
                style={[styles.modeButton, selected && styles.modeButtonSelected]}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    selected && styles.modeButtonTextSelected,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.secondaryButton} onPress={handleSelectAudio}>
          <Text style={styles.secondaryButtonText}>Select audio file</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Selected recording</Text>
          {selectedAudio ? (
            <>
              <Text style={styles.meta}>Name: {selectedAudio.name}</Text>
              <Text style={styles.meta}>
                Size: {formatBytes(selectedAudio.size)}
              </Text>
              <Text style={styles.meta}>
                project_id: {selectedAudio.projectId}
              </Text>
              <Text style={styles.meta}>take_id: {selectedAudio.takeId}</Text>
              <Text style={styles.hint}>
                Retrying this recording reuses these UUIDs. Selecting a new
                file generates new ones.
              </Text>
            </>
          ) : (
            <Text style={styles.meta}>No audio selected.</Text>
          )}
        </View>

        <Pressable
          style={[
            styles.primaryButton,
            (phase === 'uploading' || !selectedAudio) &&
              styles.primaryButtonDisabled,
          ]}
          onPress={handleUpload}
          disabled={phase === 'uploading' || !selectedAudio}
        >
          {phase === 'uploading' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Upload Recording</Text>
          )}
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Upload state</Text>
          <Text style={styles.meta}>Status: {statusLabel}</Text>
          {uploadResult?.status != null ? (
            <Text style={styles.meta}>HTTP: {uploadResult.status}</Text>
          ) : null}
          {localError ? (
            <Text style={styles.errorText}>{localError}</Text>
          ) : null}
          {uploadResult && !uploadResult.ok ? (
            <Text style={styles.errorText}>{uploadResult.message}</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Backend response</Text>
          <Text style={styles.response}>
            {formatResponse(uploadResult) ||
              'No response yet. Successful JSON from the backend will appear here after a real upload.'}
          </Text>
        </View>

        <View style={styles.card}>
          <Pressable
            onPress={() => setDeveloperSettingsOpen((open) => !open)}
            style={styles.developerHeader}
          >
            <Text style={styles.cardTitle}>Developer Settings</Text>
            <Text style={styles.meta}>
              {developerSettingsOpen ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
          {developerSettingsOpen ? (
            <>
              <Text style={styles.label}>Backend base URL</Text>
              <TextInput
                value={baseUrl}
                onChangeText={setBaseUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="http://192.168.x.x:8000"
                style={styles.input}
              />
              <Text style={styles.hint}>
                Use your computer’s LAN IP on a physical iPhone. Do not use
                localhost.
              </Text>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
  content: {
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 48,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#12263a',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#12263a',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#c9d3de',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#12263a',
  },
  hint: {
    fontSize: 12,
    color: '#6b7c8f',
    lineHeight: 17,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#c9d3de',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modeButtonSelected: {
    backgroundColor: '#12263a',
    borderColor: '#12263a',
  },
  modeButtonText: {
    color: '#12263a',
    fontWeight: '600',
  },
  modeButtonTextSelected: {
    color: '#fff',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#12263a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  secondaryButtonText: {
    color: '#12263a',
    fontWeight: '600',
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: '#1f6feb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9e2ec',
    padding: 14,
    gap: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#12263a',
    marginBottom: 2,
  },
  meta: {
    fontSize: 13,
    color: '#334e68',
    lineHeight: 18,
  },
  errorText: {
    fontSize: 13,
    color: '#b42318',
    lineHeight: 18,
  },
  response: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#243b53',
    lineHeight: 17,
  },
  placeholderButton: {
    opacity: 0.55,
  },
  placeholderButtonText: {
    color: '#829ab1',
  },
  developerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
