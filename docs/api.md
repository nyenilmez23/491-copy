# PM2 mobile-to-backend API

**Draft for D1.1 ([#11](https://github.com/nyenilmez23/intelligent_music_recorder/issues/11)).** See the [architecture draft](architecture.md) for the proposal scope and owner handoffs.

## Routes

| Method and route | Behavior |
| --- | --- |
| `GET /health` | Returns `200` with `{"status":"ok"}` when the API is reachable. |
| `PUT /v1/projects/{project_id}/takes/{take_id}` | Accepts a saved recording and returns a placeholder processing result synchronously. Returns `201` for a new take, or `200` with the existing result when the same upload is retried. |

The phone generates UUIDs for the project and take and saves them with the original audio. Reuse those IDs on a network retry. A different recording gets a new take ID; if the backend receives different bytes or recording mode for an existing take ID, it returns `409` instead of overwriting the take.

The backend accepts uppercase or lowercase UUIDs and returns them in lowercase, hyphenated form. Compare the UUID values in the app rather than comparing the original strings.

### Upload request

Send `multipart/form-data` with the following fields:

| Field | Required value |
| --- | --- |
| `audio` | A nonempty audio file. Use a standard WAV with mono, 16-bit integer PCM for the fixture and target the same format for the iPhone demo. Float PCM is unsupported, and extensible WAV headers aren't supported on Python 3.9. Emir should verify what the iPhone actually writes before integration. |
| `recording_mode` | `separate_take` or `continuous_recording`. Both use the same upload route; the placeholder does not split a continuous recording. |

Send the complete multipart body as a file or in-memory data with a valid `Content-Length`. The length covers the full multipart body, including its fields and boundaries. This prototype does not accept chunked uploads.

Example with a short synthetic WAV fixture:

```bash
curl --request PUT \
  --form 'audio=@demo-take.wav;type=audio/wav' \
  --form 'recording_mode=separate_take' \
  http://127.0.0.1:8000/v1/projects/9283e2a3-d871-4ceb-a0b9-91f3c1d7a578/takes/b22f04a0-e9df-4a81-92ab-40697ab16f91
```

Use the backend host's reachable address in the iOS app on the demo iPhone. The localhost address above is for testing from the backend machine.

### Success response

```json
{
  "project_id": "9283e2a3-d871-4ceb-a0b9-91f3c1d7a578",
  "take_id": "b22f04a0-e9df-4a81-92ab-40697ab16f91",
  "recording_mode": "separate_take",
  "status": "completed",
  "result": {
    "kind": "placeholder",
    "message": "Recording received; placeholder processing completed."
  }
}
```

The app displays this result for the submitted take. Here, `completed` refers only to the placeholder step. The response makes no claim about detected repeats, alignment, scoring, or a rendered composite.

### Errors

All API errors use the same shape, for example:

```json
{
  "error": {
    "code": "unsupported_audio",
    "message": "The uploaded recording format is not supported."
  }
}
```

| HTTP status | Error code | Meaning |
| --- | --- | --- |
| `400` | `invalid_request` | Missing or empty recording, invalid IDs, or invalid recording mode. |
| `409` | `take_conflict` | The same project and take IDs already refer to a different recording or mode. |
| `413` | `upload_too_large` | Upload exceeds the configured server limit. |
| `415` | `unsupported_audio` | File format is not supported. |
| `500` | `processing_failed` | The server could not save the upload or produce the placeholder result. |

If the API cannot be reached, the app keeps the local recording and lets the user retry with the same IDs. Validate the upload before committing it to storage and use server-controlled paths, not the uploaded filename. Use short test takes for PM2; set the upload limit once the supported capture formats and recording duration are confirmed.

## First integration check

1. Check backend health from the development machine, then send the fixture and verify the returned IDs and `result.kind`.
2. Record and save a short take on a physical iPhone, upload it, and show the placeholder response in the iOS app.
3. Retry the same take and verify that the backend returns the same result without storing a duplicate. Try an unavailable backend and verify that the original remains playable.
4. Record the device, capture format, and what worked for PM2. Keep real analysis, async job polling, and edit requests in their later work packages.
