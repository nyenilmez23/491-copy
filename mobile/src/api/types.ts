export type RecordingMode = 'separate_take' | 'continuous_recording';

export type SelectedAudio = {
  uri: string;
  name: string;
  size: number | null;
  mimeType: string | null;
  projectId: string;
  takeId: string;
};

export type UploadTakeRequest = {
  baseUrl: string;
  projectId: string;
  takeId: string;
  recordingMode: RecordingMode;
  audio: {
    uri: string;
    name: string;
    mimeType: string | null;
  };
};

export type PlaceholderResult = {
  kind: string;
  message: string;
};

export type UploadTakeSuccessBody = {
  project_id: string;
  take_id: string;
  recording_mode: RecordingMode;
  status: string;
  result: PlaceholderResult;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

export type UploadTakeSuccess = {
  ok: true;
  status: number;
  body: UploadTakeSuccessBody | unknown;
  rawText: string;
};

export type UploadTakeFailure = {
  ok: false;
  status: number | null;
  body: ApiErrorBody | unknown | null;
  rawText: string | null;
  message: string;
};

export type UploadTakeResponse = UploadTakeSuccess | UploadTakeFailure;

export const MAX_AUDIO_BYTES = 32 * 1024 * 1024;
