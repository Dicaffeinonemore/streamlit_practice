"""Encode exact PCM periods with pinned libsndfile; normalize Ogg serial/CRC."""
import hashlib
import json
import pathlib
import sys

PROJECT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT / 'tools' / '.deps'))
import soundfile as sf


def normalize_serial(blob: bytes, serial: int) -> bytes:
    data = bytearray(blob)
    offset = 0
    while offset < len(data):
        if data[offset:offset + 4] != b'OggS':
            raise ValueError('Invalid Ogg page')
        count = data[offset + 26]
        length = 27 + count + sum(data[offset + 27:offset + 27 + count])
        data[offset + 14:offset + 18] = serial.to_bytes(4, 'little')
        data[offset + 22:offset + 26] = bytes(4)
        crc = 0
        for value in data[offset:offset + length]:
            crc ^= value << 24
            for _ in range(8):
                crc = ((crc << 1) ^ (0x04C11DB7 if crc & 0x80000000 else 0)) & 0xFFFFFFFF
        data[offset + 22:offset + 26] = crc.to_bytes(4, 'little')
        offset += length
    return bytes(data)


manifest_path = PROJECT / 'port_assets/catalogs/audio.json'
manifest = json.loads(manifest_path.read_text('utf-8'))
for track in manifest['music']:
    print(f"Encoding {track['id']}", flush=True)
    samples, rate = sf.read(PROJECT / track['pcm'], dtype='int16', always_2d=True)
    target = PROJECT / track['file']
    target.parent.mkdir(parents=True, exist_ok=True)
    # The Windows Vorbis converter uses stack scratch space: stream bounded blocks.
    with sf.SoundFile(str(target), 'w', samplerate=rate, channels=samples.shape[1],
                      format='OGG', subtype='VORBIS', compression_level=0.5) as encoder:
        for offset in range(0, len(samples), 4096):
            encoder.write(samples[offset:offset + 4096])
    serial = int.from_bytes(hashlib.sha256(track['id'].encode()).digest()[:4], 'little')
    target.write_bytes(normalize_serial(target.read_bytes(), serial))
    info = sf.info(target)
    if info.frames != len(samples):
        raise ValueError(f"Encoded length mismatch: {track['id']}")
    track['ogg_sha256'] = hashlib.sha256(target.read_bytes()).hexdigest()
    track['encoded_samples'] = info.frames
manifest['encoder'] = {'soundfile': sf.__version__, 'libsndfile': sf.__libsndfile_version__, 'format': 'Vorbis', 'compression_level': 0.5, 'stable_ogg_serial': True}
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=2) + '\n', encoding='utf-8')
print(f"Encoded and decoded {len(manifest['music'])} OGG loops with exact sample lengths")
