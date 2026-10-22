"""Mix a cinematic sound bed and deliver an H.264/AAC trailer."""
from pathlib import Path
import json, subprocess, wave
import numpy as np
import imageio_ffmpeg
from PIL import Image, ImageOps, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/trailer'
FF=imageio_ffmpeg.get_ffmpeg_exe()
RATE=48000
rng=np.random.default_rng(42)
audio=np.zeros((RATE*42,2),dtype=np.float64)
cuts=[3,6,9.5,13,16.5,20.5,25,27,29,31,34]
for at in cuts:
    duration=1.8 if at in [20.5,31,34] else .85
    t=np.arange(int(duration*RATE))/RATE
    phase=2*np.pi*(48*t+70*.075*(1-np.exp(-t/.075)))
    boom=np.sin(phase)*np.exp(-t*4)*.52
    noise=rng.normal(0,1,len(t))
    noise=np.convolve(noise,np.ones(12)/12,mode='same')
    hit=boom+noise*np.exp(-t*12)*.27
    start=int(at*RATE)
    for ch in range(2): audio[start:start+len(t),ch]+=hit
    # Reverse swell before each cut, widening across the stereo field.
    d=.55;t2=np.arange(int(d*RATE))/RATE
    whoosh=rng.normal(0,1,len(t2))*np.sin(np.pi*t2/d)**2*(t2/d)**2*.09
    j=int((at-d)*RATE)
    audio[j:j+len(t2),0]+=whoosh
    audio[j:j+len(t2),1]+=np.roll(whoosh,240)
t=np.arange(RATE*42)/RATE
audio+=((np.sin(2*np.pi*36.7*t)+.3*np.sin(2*np.pi*55*t))*.018*np.minimum(t/3,1)*np.clip((42-t)/3,0,1))[:,None]
audio=np.tanh(audio)
with wave.open(str(OUT/'trailer-sound-design.wav'),'wb') as w:
    w.setnchannels(2);w.setsampwidth(2);w.setframerate(RATE);w.writeframes((audio*32767).astype('<i2').tobytes())

command=[FF,'-y','-hide_banner','-loglevel','warning',
 '-i',str(OUT/'trailer-master.webm'),'-stream_loop','-1','-i',str(ROOT/'assets/bgm/boss.mp3'),'-i',str(OUT/'trailer-sound-design.wav'),
 '-filter_complex',
 '[0:v]fps=30,scale=1920:1080:flags=lanczos,setsar=1[v];'
 '[1:a]atrim=0:42,asetpts=PTS-STARTPTS,volume=0.60,afade=t=in:st=0:d=2,afade=t=out:st=38:d=4[m];'
 '[m][2:a]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.92,afade=t=out:st=41:d=1[a]',
 '-map','[v]','-map','[a]','-t','42','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p',
 '-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(OUT/'black-moon-knight-trailer.mp4')]
subprocess.run(command,check=True)

frames=sorted(OUT.glob('frame-*.jpg'),key=lambda p:int(p.stem.split('-')[1]))
sheet=Image.new('RGB',(960,3*205),(9,7,14))
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',16)
for i,p in enumerate(frames[:6]):
    im=Image.open(p).resize((480,270))
    # Preserve full composition in the review contact sheet.
    im=ImageOps.contain(im,(480,180))
    x=(i%2)*480;y=(i//2)*205;sheet.paste(im,(x+(480-im.width)//2,y))
    ImageDraw.Draw(sheet).text((x+15,y+182),f'{int(p.stem.split("-")[1])/30:.1f}s',font=font,fill='#d4baa7')
sheet.save(OUT/'review-contact-sheet.jpg',quality=92)
Image.open(OUT/'frame-1110.jpg').save(OUT/'poster.jpg',quality=95)
info={'title':'흑월의 기사 — 다섯 개의 왕좌, 단 하나의 검', 'duration_seconds':42,'size':[1920,1080], 'fps':30,
      'video':'H.264','audio':'AAC stereo 48kHz','footage':'Staged current-engine footage, cinematic overlays; 720p source upscaled to 1080p',
      'music':'Repository assets/bgm/boss.mp3','sound_design':'Original synthesized impacts, transitions and low drone',
      'file_bytes':(OUT/'black-moon-knight-trailer.mp4').stat().st_size}
(OUT/'delivery.json').write_text(json.dumps(info,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(info,ensure_ascii=True))
