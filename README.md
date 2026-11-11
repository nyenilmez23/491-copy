# Intelligent Music Recorder

A COMP491 iPhone app for capturing and reviewing musical takes. The `emir-recorder` branch in this private prototype repo supports recording a short take on an iPhone, saving it locally, and uploading it to the Python backend.

The PM2 backend saves the uploaded take and returns a placeholder result. Audio alignment, scoring, and composite generation are outside this demo.

## Requirements

- A Mac with Python 3.9 or later, Node.js, and npm.
- A physical iPhone on the same Wi-Fi as the Mac, with an Expo Go client compatible with the SDK in [mobile/package.json](mobile/package.json).
- The same Expo account signed into Expo Go on the iPhone and Expo CLI on the Mac.

## Run the demo

### Get the code

Run this once. If you already have a checkout, use that folder and switch to `emir-recorder` instead.

```sh
git clone --branch emir-recorder https://github.com/nyenilmez23/491-copy.git
cd 491-copy
```

### Terminal 1: Start the backend

Find your Mac's Wi-Fi IP address in **System Settings → Wi-Fi → Details**, or run `ipconfig getifaddr en0`. From the repo root, replace `YOUR_MAC_IP` with that address:

```sh
python3 -m backend.server --host YOUR_MAC_IP --port 8000
```

Leave the terminal running. On the iPhone, open `http://YOUR_MAC_IP:8000/health` in Safari. Continue once it shows `{"status":"ok"}`.

### Terminal 2: Start Expo

In a separate terminal, go to the same checkout and run:

```sh
cd mobile
npm ci
npx expo start --go --lan
```

Run `npm ci` on first setup or when the lockfile changes. Scan the new QR code with the iPhone Camera. If Expo Go asks you to sign in, run `npx expo login` from `mobile/`, use the same account as the phone, and restart Expo.

### On the iPhone

1. Open **Developer Settings → Show**. Set **Backend base URL** to `http://YOUR_MAC_IP:8000`. Use `/health` only in Safari; leave it out of the app URL.
2. Keep **Separate take** selected for the simplest demo. Tap **Record**, allow microphone access, record for 3–5 seconds, then tap **Stop**. The saved take is selected automatically. Check that it is a mono, 16-bit integer PCM WAV. To test with an existing WAV instead, use **Select audio file**.
3. Tap **Upload Recording**. Expect **HTTP 201** and `"kind": "placeholder"` under **Backend response**.
4. Tap **Upload Recording** again without changing the take or recording mode. Expect **HTTP 200** with the same project ID, take ID, and result.

## Troubleshooting

| What you see | What to check |
| --- | --- |
| Safari can't open `/health` | Confirm both devices are on the same Wi-Fi, the backend terminal is running, and the IP hasn't changed. If the network blocks traffic between devices, try a different Wi-Fi network. |
| QR code doesn't open the app | Keep Metro running, scan the fresh QR code, and check that Expo Go is installed and signed into the same account. If Expo Go reports an SDK mismatch, use a compatible client or development build. |
| Upload returns 404 | If the backend log shows `PUT /health/v1/projects/...`, remove `/health` from **Backend base URL**. |
| Upload returns 415 | Check that the file is a nonempty PCM WAV. Renaming an M4A file to `.wav` does not convert it. |
| Upload returns 409 | The same IDs were used for different audio or a different recording mode. Retry with the original file and mode, or select a new take. |
| Microphone access denied | Enable access for the app in iPhone Settings, then tap Record again. |

## Project docs

- [Backend setup, WAV fixture, and tests](backend/README.md)
- [System architecture](docs/architecture.md) and [PM2 API contract](docs/api.md)
- [GitHub Usage Rules](GITHUB_USAGE_RULES.md) for issues, branches, commits, and reviews
