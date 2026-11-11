# PM2 backend

This is the backend half of [T6.1](https://github.com/nyenilmez23/intelligent_music_recorder/issues/10). It implements the [PM2 API contract](../docs/api.md) using Python 3.9 or later with no extra packages. It stores the uploaded WAV and returns a placeholder result; it does not analyze the recording.

From the repository root, start the local server:

```sh
python3 -m backend.server
```

In another terminal, check health and make a short synthetic fixture:

```sh
curl --fail http://127.0.0.1:8000/health
cd "$(mktemp -d)"
python3 - <<'PY'
import wave
with wave.open("demo-take.wav", "wb") as wav:
    wav.setparams((1, 2, 8000, 0, "NONE", "not compressed"))
    wav.writeframes(b"\x00\x00" * 8000)
PY
```

Send the fixture with the curl example in [the API draft](../docs/api.md#upload-request). The first request returns `201`; repeating it returns `200` with the same result. The default storage directory, `backend/.data/`, is ignored by Git. For the demo, use a standard mono, 16-bit integer PCM WAV. The prototype limits the audio file to 32 MiB and requires a multipart request with a valid `Content-Length`. The default limit is for this prototype, not a final device or recording limit.

For a test on the demo iPhone, bind to the backend machine's development network address using `--host`, and use that address from the app. Use synthetic or consented demo audio. The server is for local development; use an authenticated, HTTPS deployment before accepting personal recordings outside the demo setup. Once Emir confirms the iPhone capture format, verify a real recorded take against the contract and add format support if needed.

Run the backend checks:

```sh
python3 -m unittest backend.test_server -v
```
