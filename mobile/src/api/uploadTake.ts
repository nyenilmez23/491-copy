import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';

import type { UploadTakeRequest, UploadTakeResponse } from './types';
import { MAX_AUDIO_BYTES } from './types';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function buildUploadUrl(
  baseUrl: string,
  projectId: string,
  takeId: string,
): string {
  return `${normalizeBaseUrl(baseUrl)}/v1/projects/${encodeURIComponent(projectId)}/takes/${encodeURIComponent(takeId)}`;
}

async function parseResponseBody(response: Pick<Response, 'text'>): Promise<{
  body: unknown | null;
  rawText: string;
}> {
  const rawText = await response.text();
  if (!rawText) {
    return { body: null, rawText: '' };
  }

  try {
    return { body: JSON.parse(rawText) as unknown, rawText };
  } catch {
    return { body: null, rawText };
  }
}

/**
 * Uploads a take to the backend contract from docs/api.md:
 * PUT /v1/projects/{project_id}/takes/{take_id}
 *
 * Use a file-backed multipart part that Expo can serialize.
 */
export async function uploadTake(
  request: UploadTakeRequest,
): Promise<UploadTakeResponse> {
  const baseUrl = normalizeBaseUrl(request.baseUrl);
  if (!baseUrl) {
    return {
      ok: false,
      status: null,
      body: null,
      rawText: null,
      message: 'Backend base URL is required.',
    };
  }

  if (!request.projectId || !request.takeId) {
    return {
      ok: false,
      status: null,
      body: null,
      rawText: null,
      message: 'project_id and take_id are required.',
    };
  }

  if (!request.audio.uri) {
    return {
      ok: false,
      status: null,
      body: null,
      rawText: null,
      message: 'An audio file is required.',
    };
  }

  const url = buildUploadUrl(baseUrl, request.projectId, request.takeId);

  try {
    const formData = new FormData();
    formData.append('recording_mode', request.recordingMode);
    formData.append('audio', new File(request.audio.uri), request.audio.name || 'recording.wav');
    const response = await fetch(url, {
      method: 'PUT',
      body: formData,
    });

    const { body, rawText } = await parseResponseBody(response);

    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        body,
        rawText,
      };
    }

    return {
      ok: false,
      status: response.status,
      body,
      rawText,
      message:
        response.status === 413
          ? `Upload exceeds the ${MAX_AUDIO_BYTES} byte limit.`
          : `Upload failed with HTTP ${response.status}.`,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Network request failed. Check the base URL and that the phone can reach the backend.';

    return {
      ok: false,
      status: null,
      body: null,
      rawText: null,
      message,
    };
  }
}

export { buildUploadUrl, MAX_AUDIO_BYTES };
