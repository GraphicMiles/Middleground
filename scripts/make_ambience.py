import wave, numpy as np, os
SR=22050; LOOP=30.0; XF=8.0; TARGET_DBFS=-28.0
def read(p):
    w=wave.open(p,'rb'); n=w.getnframes(); d=np.frombuffer(w.readframes(n),dtype=np.int16).astype(np.float32)/32768.0
    w.close(); return d
def write(p,x):
    x=np.clip(x,-0.985,0.985); w=wave.open(p,'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((x*32767).astype(np.int16).tobytes()); w.close()
def rms(x): return float(np.sqrt(np.mean(x*x))+1e-12)
def steadiest(x,need):
    """Choose the window whose RMS is closest to the file's median, so the loop
    avoids transients rather than locking a loud burst into the repeat."""
    win=int(1.0*SR); hop=int(0.5*SR); vals=[]
    for s in range(0,max(1,len(x)-win),hop): vals.append(rms(x[s:s+win]))
    med=float(np.median(vals))
    # After the crossfade the seam is exactly the sample-to-sample delta at
    # position (need-X) inside the window, because the smoothstep fade is 0 at
    # index 0 and 1 at index X-1. Score it directly so the chosen window does
    # not loop through a click.
    X=int(XF*SR); md=float(np.mean(np.abs(np.diff(x)))+1e-9)
    best,bs=None,0
    for s in range(0,max(1,len(x)-need),hop):
        seg=x[s:s+need]; w=rms(seg); d=abs(np.log(w/med))
        bd=abs(float(seg[len(seg)-X-1]-seg[len(seg)-X]))/md
        sc=d+.12*bd
        if best is None or sc<best: best,bs=sc,s
    return bs,med
def make(src,dst):
    x=read(src); need=int((LOOP+XF)*SR)
    if len(x)<need: need=len(x); print(f"  ! {src} shorter than target, using {need/SR:.1f}s")
    s,med=steadiest(x,need); seg=x[s:s+need]
    L=len(seg); X=int(XF*SR); out=np.array(seg[:L-X],dtype=np.float32)
    fade=np.linspace(0,1,X,dtype=np.float32); fade=fade*fade*(3-2*fade)   # smoothstep
    out[:X]=seg[:X]*fade+seg[L-X:L]*(1-fade)
    g=10**((TARGET_DBFS-20*np.log10(rms(out)))/20)
    peak=float(np.max(np.abs(out)))*g
    if peak>0.985: g*=0.985/peak
    write(dst,out*g)
    print(f"  {os.path.basename(src)}: offset {s/SR:.1f}s (file median RMS {20*np.log10(med):.1f}dB) "
          f"-> {len(out)/SR:.1f}s loop, gain {g:.2f}x, RMS {20*np.log10(rms(out*g)):.1f}dBFS, peak {20*np.log10(np.max(np.abs(out*g))):.1f}dBFS")
for n in ["bay","brook","park","night"]:
    make(f"work/{n}.wav",f"out/{n}_loop.wav")
