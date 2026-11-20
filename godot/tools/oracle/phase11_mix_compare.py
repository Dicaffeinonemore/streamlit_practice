"""Phase 11: compares the browser render and Godot's Movie Maker render of mix_scenario.json.

    python phase11_mix_compare.py <browser.wav> <godot.wav> [report.json]

Both files are reduced to 5 ms RMS envelopes (sample rates may differ), aligned by the lag that
best correlates the effect-only part, then compared window by window: every effect for 0.35 s
from its start, and the music on its own (fade-in, stage, boss, victory).
"""
import json, sys, wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
scenario = json.loads((ROOT / 'phase11/fixtures/mix_scenario.json').read_text(encoding='utf-8'))

def read(path):
    with wave.open(str(path), 'rb') as w:
        rate, channels, width, frames = w.getframerate(), w.getnchannels(), w.getsampwidth(), w.getnframes()
        raw = w.readframes(frames)
    dtype = {2: np.int16, 4: np.int32}[width]
    data = np.frombuffer(raw, dtype=dtype).astype(np.float64) / float(np.iinfo(dtype).max)
    return rate, data.reshape(-1, channels)

def envelope(rate, data, step=0.005):
    n = int(rate * step); count = len(data) // n
    frames = data[:count * n].reshape(count, n, -1)
    return np.sqrt(np.mean(frames ** 2, axis=(1, 2)) + 1e-12)

def db(x):
    return 20 * np.log10(max(x, 1e-9))

def window_rms(rate, data, start, length):
    a, b = int(max(0, start) * rate), int((start + length) * rate)
    seg = data[a:b]
    return float(np.sqrt(np.mean(seg ** 2))) if len(seg) else 0.0

def main():
    br, bd = read(sys.argv[1]); gr, gd = read(sys.argv[2])
    eb, eg = envelope(br, bd), envelope(gr, gd)
    # Effects-only span (music is identical and steady): 1.0 s .. 6.4 s.
    lo, hi = int(1.0 / .005), int(6.4 / .005)
    best = max(range(-40, 41), key=lambda lag: float(np.corrcoef(np.log(eb[lo:hi]), np.log(eg[lo + lag:hi + lag]))[0, 1]))
    lag = best * .005
    events = []
    for ev in scenario['events']:
        if 'sfx' not in ev: continue
        b = window_rms(br, bd, ev['t'], .35); g = window_rms(gr, gd, ev['t'] + lag, .35)
        events.append({'t': ev['t'], 'sound': ev['sfx'], 'browserDb': round(db(b), 2), 'godotDb': round(db(g), 2), 'deltaDb': round(db(g) - db(b), 2)})
    sections = []
    for name, start, length in [('stage fade-in (0.2-0.5 s)', .2, .3), ('stage music (0.85-0.98 s)', .85, .13),
                                ('stage music under fade-out (6.6-6.9 s)', 6.6, .3), ('boss music (7.5-8.9 s)', 7.5, 1.4),
                                ('victory fanfare (9.1-10.5 s)', 9.1, 1.4), ('victory loop (11.0-11.9 s)', 11.0, .9)]:
        b = window_rms(br, bd, start, length); g = window_rms(gr, gd, start + lag, length)
        sections.append({'section': name, 'browserDb': round(db(b), 2), 'godotDb': round(db(g), 2), 'deltaDb': round(db(g) - db(b), 2)})
    n = min(len(eb), len(eg) - max(0, best))
    corr = float(np.corrcoef(eb[:n - 1], eg[best:best + n - 1] if best >= 0 else eg[:n - 1])[0, 1])
    report = {'browserRate': br, 'godotRate': gr, 'alignmentLagMs': round(lag * 1000, 1), 'envelopeCorrelation': round(corr, 4),
              'peakDb': {'browser': round(db(float(np.abs(bd).max())), 2), 'godot': round(db(float(np.abs(gd).max())), 2)},
              'maxEffectDeltaDb': max(abs(e['deltaDb']) for e in events), 'maxMusicDeltaDb': max(abs(s['deltaDb']) for s in sections),
              'effects': events, 'music': sections}
    text = json.dumps(report, ensure_ascii=False, indent=1)
    if len(sys.argv) > 3: Path(sys.argv[3]).write_text(text + '\n', encoding='utf-8')
    print(text)

main()
