import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
import wave
from wsgiref.util import setup_testing_defaults
from wsgiref.validate import validator

from backend.server import make_app


PROJECT = "9283e2a3-d871-4ceb-a0b9-91f3c1d7a578"
TAKE = "b22f04a0-e9df-4a81-92ab-40697ab16f91"
ROUTE = f"/v1/projects/{PROJECT}/takes/{TAKE}"
BOUNDARY = "test-wav-boundary"


def fixture(sample=b"\x00\x00"):
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setparams((1, 2, 8000, 0, "NONE", "not compressed"))
        wav.writeframes(sample * 800)
    return output.getvalue()


class UploadTests(unittest.TestCase):
    def setUp(self):
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.app = validator(make_app(self.root, max_audio_bytes=4096))

    def request(self, method, path, data=b"", content_type=""):
        env = {}
        setup_testing_defaults(env)
        env.update(REQUEST_METHOD=method, PATH_INFO=path, CONTENT_TYPE=content_type, QUERY_STRING="",
                   CONTENT_LENGTH=str(len(data)))
        env["wsgi.input"] = io.BytesIO(data)
        result = []
        response = self.app(env, lambda status, headers, exc_info=None: result.append(status))
        try:
            return int(result[0].split()[0]), json.loads(b"".join(response))
        finally:
            response.close()

    def upload(self, audio, mode="separate_take", path=ROUTE):
        data = (
            f'--{BOUNDARY}\r\nContent-Disposition: form-data; name="recording_mode"\r\n'
            f'\r\n{mode}\r\n--{BOUNDARY}\r\nContent-Disposition: form-data; '
            'name="audio"; filename="demo.wav"\r\nContent-Type: audio/wav\r\n\r\n'
        ).encode() + audio + f"\r\n--{BOUNDARY}--\r\n".encode()
        return self.request("PUT", path, data, f"multipart/form-data; boundary={BOUNDARY}")

    def test_save_retry_after_restart_and_conflict(self):
        self.assertEqual(self.request("GET", "/health"), (200, {"status": "ok"}))
        wav = fixture()
        status, saved = self.upload(wav)
        self.assertEqual(status, 201)
        self.assertEqual((saved["project_id"], saved["take_id"]), (PROJECT, TAKE))
        self.assertEqual(saved["result"]["kind"], "placeholder")
        self.app = validator(make_app(self.root))
        self.assertEqual(self.upload(wav), (200, saved))
        for conflicting_upload in [(fixture(b"\x01\x00"), "separate_take"),
                                   (wav, "continuous_recording")]:
            status, body = self.upload(*conflicting_upload)
            self.assertEqual((status, body["error"]["code"]), (409, "take_conflict"))
        self.assertEqual(list((self.root / PROJECT).iterdir()), [self.root / PROJECT / TAKE])
        self.assertEqual((self.root / PROJECT / TAKE / "original.wav").read_bytes(), wav)

    def test_reject_invalid_or_oversized_uploads(self):
        cases = [(b"not a WAV", "separate_take", ROUTE, 415, "unsupported_audio"),
                 (fixture()[:-1], "separate_take", ROUTE, 415, "unsupported_audio"),
                 (b"", "separate_take", ROUTE, 400, "invalid_request"),
                 (fixture(), "invalid", ROUTE, 400, "invalid_request"),
                 (fixture(), "separate_take", ROUTE.replace(TAKE, "wrong"), 400, "invalid_request"),
                 (b"a" * 4097, "separate_take", ROUTE, 413, "upload_too_large")]
        for audio, mode, path, expected_status, code in cases:
            with self.subTest(expected_status=expected_status, mode=mode, path=path):
                status, body = self.upload(audio, mode, path)
                self.assertEqual((status, body["error"]["code"]), (expected_status, code))
        self.assertEqual(list(self.root.iterdir()), [])

    def test_failed_result_write_allows_a_clean_retry(self):
        wav = fixture()
        with patch.object(Path, "write_text", side_effect=OSError("disk unavailable")):
            status, result = self.upload(wav)
        self.assertEqual((status, result["error"]["code"]), (500, "processing_failed"))
        self.assertEqual(list((self.root / PROJECT).iterdir()), [])
        self.assertEqual(self.upload(wav)[0], 201)


if __name__ == "__main__":
    unittest.main()
