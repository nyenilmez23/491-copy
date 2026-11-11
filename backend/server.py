"""Local PM2 backend: receive a saved take and return a placeholder result."""

import argparse
from email import policy
from email.parser import BytesParser
import hashlib
import io
import json
from pathlib import Path
import re
from tempfile import TemporaryDirectory
from uuid import UUID
import wave
from wsgiref.simple_server import make_server


MAX_AUDIO_BYTES = 32 * 1024 * 1024
MODES = {"separate_take", "continuous_recording"}
ROUTE = re.compile(r"/v1/projects/([^/]+)/takes/([^/]+)")


class RequestError(Exception):
    def __init__(self, status, code, message):
        super().__init__(message)
        self.status = status
        self.code = code


def invalid(message):
    return RequestError("400 Bad Request", "invalid_request", message)


def too_large():
    return RequestError("413 Payload Too Large", "upload_too_large",
                        "The upload exceeds the server limit.")


def read_upload(env, max_audio_bytes):
    content_type = env.get("CONTENT_TYPE", "")
    if content_type.split(";", 1)[0].strip().lower() != "multipart/form-data":
        raise invalid("Send audio and recording_mode as multipart/form-data.")
    if not content_type.isascii() or "\r" in content_type or "\n" in content_type:
        raise invalid("Invalid Content-Type.")
    try:
        size = int(env.get("CONTENT_LENGTH", ""))
    except ValueError:
        raise invalid("A valid Content-Length is required.") from None
    if size <= 0:
        raise invalid("The request body is empty.")
    if size > max_audio_bytes + 64 * 1024:
        raise too_large()
    raw = env["wsgi.input"].read(size)
    if len(raw) != size:
        raise invalid("The request body is incomplete.")
    header = f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n"
    message = BytesParser(policy=policy.default).parsebytes(header.encode("ascii") + raw)
    if not message.is_multipart() or message.defects:
        raise invalid("Invalid multipart body.")
    fields = {}
    for part in message.iter_parts():
        name = part.get_param("name", header="content-disposition")
        if part.is_multipart() or part.get_content_disposition() != "form-data":
            raise invalid("Invalid multipart field.")
        if name not in ("audio", "recording_mode") or name in fields:
            raise invalid("Provide exactly one audio and one recording_mode field.")
        fields[name] = part.get_payload(decode=True)
    audio = fields.get("audio")
    mode = fields.get("recording_mode")
    if not audio or mode not in {value.encode() for value in MODES}:
        raise invalid("Provide nonempty audio and a supported recording_mode.")
    if len(audio) > max_audio_bytes:
        raise too_large()
    try:
        with wave.open(io.BytesIO(audio), "rb") as wav:
            frames = wav.getnframes()
            frame_size = wav.getnchannels() * wav.getsampwidth()
            if frames <= 0 or len(wav.readframes(frames)) != frames * frame_size:
                raise wave.Error("Empty or incomplete PCM data")
    except (wave.Error, EOFError, ValueError):
        raise RequestError("415 Unsupported Media Type", "unsupported_audio",
                           "This prototype accepts nonempty PCM WAV audio.") from None
    return audio, mode.decode("ascii")


def save_take(root, project_id, take_id, audio, mode):
    project = root / project_id
    target = project / take_id
    digest = hashlib.sha256(audio).hexdigest()
    if target.exists():
        saved = json.loads((target / "result.json").read_text(encoding="utf-8"))
        if saved["sha256"] != digest or saved["response"]["recording_mode"] != mode:
            raise RequestError("409 Conflict", "take_conflict",
                               "These IDs already identify a different recording or mode.")
        return "200 OK", saved["response"]

    response = {
        "project_id": project_id,
        "take_id": take_id,
        "recording_mode": mode,
        "status": "completed",
        "result": {
            "kind": "placeholder",
            "message": "Recording received; placeholder processing completed.",
        },
    }
    project.mkdir(parents=True, exist_ok=True)
    # Publish the original and its result together. A failed write leaves no
    # completed take at the target path, so the same upload can be retried.
    with TemporaryDirectory(prefix=".upload-", dir=project) as directory:
        staging = Path(directory) / "take"
        staging.mkdir()
        (staging / "original.wav").write_bytes(audio)
        (staging / "result.json").write_text(
            json.dumps({"sha256": digest, "response": response}), encoding="utf-8"
        )
        staging.rename(target)
    return "201 Created", response


def make_app(storage, max_audio_bytes=MAX_AUDIO_BYTES):
    root = Path(storage).resolve()

    def application(env, start_response):
        method, path = env["REQUEST_METHOD"], env["PATH_INFO"]
        try:
            match = ROUTE.fullmatch(path)
            if method == "GET" and path == "/health":
                status, result = "200 OK", {"status": "ok"}
            elif method == "PUT" and match:
                try:
                    project_id, take_id = (str(UUID(value)) for value in match.groups())
                except ValueError:
                    raise invalid("Project and take IDs must be UUIDs.") from None
                audio, mode = read_upload(env, max_audio_bytes)
                status, result = save_take(root, project_id, take_id, audio, mode)
            else:
                raise RequestError("404 Not Found", "not_found", "Route not found.")
        except RequestError as exc:
            status, result = exc.status, {"error": {"code": exc.code, "message": str(exc)}}
        except (OSError, ValueError, KeyError):
            status = "500 Internal Server Error"
            result = {"error": {"code": "processing_failed",
                                "message": "Could not save the take or return its result."}}
        body = json.dumps(result).encode("utf-8")
        start_response(status, [("Content-Type", "application/json"),
                                ("Content-Length", str(len(body)))])
        return [body]

    return application


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--storage", type=Path, default=Path(__file__).parent / ".data")
    args = parser.parse_args()
    with make_server(args.host, args.port, make_app(args.storage)) as server:
        print(f"PM2 backend listening on http://{args.host}:{args.port}", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
