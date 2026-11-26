"""Word timestamps for a spoken audio file (faster-whisper ASR), printed to stdout as JSON.

Usage: <python with faster-whisper> -I scripts/align_words.py <audio> [model]
Output: [{"word": str, "start_ms": int, "end_ms": int}, ...]
Called by src/align.ts (the word-alignment tool); set ALIGN_PYTHON to the interpreter.
"""
import json
import subprocess
import sys

import numpy as np
from faster_whisper import WhisperModel

audio = sys.argv[1]
model = sys.argv[2] if len(sys.argv) > 2 else 'small.en'
pcm = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', audio, '-ar', '16000', '-ac', '1', '-f', 's16le', '-'], capture_output=True, check=True).stdout
segments, _ = WhisperModel(model, device='cpu', compute_type='int8').transcribe(np.frombuffer(pcm, np.int16).astype(np.float32) / 32768, word_timestamps=True, language='en')
json.dump([{'word': w.word.strip(), 'start_ms': int(w.start * 1000), 'end_ms': int(w.end * 1000)} for s in segments for w in s.words], sys.stdout)
