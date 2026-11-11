import { File, FileMode } from 'expo-file-system';

export type WavInfo = {
  /** WAVE format tag: 1 is integer PCM, 3 is float, 0xFFFE is extensible. */
  formatTag: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataBytes: number;
  /** True for the format the backend accepts: mono, 16-bit integer PCM. */
  backendCompatible: boolean;
};

export type WavInspection =
  | { ok: true; info: WavInfo }
  | { ok: false; reason: string };

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function readExact(
  handle: ReturnType<File['open']>,
  offset: number,
  length: number,
): Uint8Array {
  handle.offset = offset;
  const bytes = handle.readBytesSync(length);
  if (bytes.length !== length) {
    throw new Error('Unexpected end of file.');
  }
  return bytes;
}

/**
 * Reads the RIFF/WAVE header of a file on disk without loading the audio,
 * so the app can show the format the iPhone actually wrote.
 */
export function inspectWav(uri: string): WavInspection {
  const file = new File(uri);
  if (!file.exists) {
    return { ok: false, reason: 'Recording file was not found.' };
  }

  const fileSize = file.size;
  let handle: ReturnType<File['open']> | null = null;

  try {
    handle = file.open(FileMode.ReadOnly);
    const riff = readExact(handle, 0, 12);
    if (ascii(riff, 0, 4) !== 'RIFF' || ascii(riff, 8, 4) !== 'WAVE') {
      return { ok: false, reason: 'File is not a RIFF/WAVE file.' };
    }

    let offset = 12;
    let fmt: Omit<WavInfo, 'dataBytes' | 'backendCompatible'> | null = null;

    for (let i = 0; i < 64 && offset + 8 <= fileSize; i += 1) {
      const header = readExact(handle, offset, 8);
      const id = ascii(header, 0, 4);
      const size = new DataView(header.buffer, header.byteOffset, 8).getUint32(
        4,
        true,
      );

      if (id === 'fmt ') {
        if (size < 16) {
          return { ok: false, reason: 'WAV fmt chunk is too short.' };
        }
        const body = readExact(handle, offset + 8, 16);
        const view = new DataView(body.buffer, body.byteOffset, 16);
        fmt = {
          formatTag: view.getUint16(0, true),
          channels: view.getUint16(2, true),
          sampleRate: view.getUint32(4, true),
          bitsPerSample: view.getUint16(14, true),
        };
      } else if (id === 'data') {
        if (!fmt) {
          return { ok: false, reason: 'WAV data chunk appears before fmt.' };
        }
        const dataBytes = Math.min(size, Math.max(fileSize - offset - 8, 0));
        return {
          ok: true,
          info: {
            ...fmt,
            dataBytes,
            backendCompatible:
              fmt.formatTag === 1 &&
              fmt.channels === 1 &&
              fmt.bitsPerSample === 16 &&
              dataBytes > 0,
          },
        };
      }

      offset += 8 + size + (size % 2);
    }

    return { ok: false, reason: 'WAV data chunk was not found.' };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'Could not read WAV header.',
    };
  } finally {
    handle?.close();
  }
}

export function describeWav(info: WavInfo): string {
  const encoding =
    info.formatTag === 1
      ? `${info.bitsPerSample}-bit integer PCM`
      : info.formatTag === 3
        ? `${info.bitsPerSample}-bit float PCM`
        : info.formatTag === 0xfffe
          ? `extensible WAV, ${info.bitsPerSample}-bit`
          : `format tag ${info.formatTag}, ${info.bitsPerSample}-bit`;
  const channels =
    info.channels === 1 ? 'mono' : info.channels === 2 ? 'stereo' : `${info.channels} channels`;
  return `${encoding}, ${channels}, ${info.sampleRate} Hz`;
}
