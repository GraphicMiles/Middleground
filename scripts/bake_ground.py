"""Original, seamless material maps. Reference photographs are NOT embedded."""
import math
from PIL import Image
from pathlib import Path
S=256
r=Path(__file__).resolve().parent.parent

def hash2(x,y,seed=0):
 n=((x*374761393+y*668265263+(1971+seed)*1442695041)&0xffffffff)
 n=((n^(n>>13))*1274126177)&0xffffffff
 return ((n^(n>>16))&0xffffffff)/4294967296

def noise(x,y,period,seed):
 i,j=math.floor(x),math.floor(y);a=x-i;b=y-j;a=a*a*(3-2*a);b=b*b*(3-2*b)
 h=lambda u,v:hash2(u%period,v%period,seed)
 return (h(i,j)*(1-a)+h(i+1,j)*a)*(1-b)+(h(i,j+1)*(1-a)+h(i+1,j+1)*a)*b

def sm(a,b,x):
 x=min(1,max(0,(x-a)/(b-a)));return x*x*(3-2*x)

tile=Image.new('RGBA',(S,S));height=[];pix=[]
for y in range(S):
 for x in range(S):
  u=(x+.5)/S;v=(y+.5)/S;cx=u*32;cy=v*32;ix=math.floor(cx);iy=math.floor(cy);fx=cx-ix;fy=cy-iy
  near=[]
  for j in range(-1,2):
   for i in range(-1,2):
    sx=(ix+i)%32;sy=(iy+j)%32
    ox=.12+.76*hash2(sx,sy,4);oy=.12+.76*hash2(sx,sy,7)
    near.append((i+ox-fx)**2+(j+oy-fy)**2)
  near.sort();gap=math.sqrt(near[1])-math.sqrt(near[0]);crack=sm(.006,.07,gap)
  broad=noise(u*16,v*16,16,21);fine=noise(u*64,v*64,64,22)
  pebble=0.;gx=u*64;gy=v*64;px=math.floor(gx);py=math.floor(gy)
  if hash2(px%64,py%64,37)<.055:
   qx=gx-px-.5;qy=gy-py-.5;pebble=math.exp(-(qx*qx+qy*qy)*29.)
  ribs=math.sin(u*math.tau*28+.35*math.sin(v*math.tau*2))
  height.append(.55*broad+.20*fine+.10*pebble+.012*ribs)
  grey=min(1,max(.91,.966+.027*(broad-.5)+.012*(fine-.5)-.010*pebble))
  pix.append((round(grey*255),round(pebble*255),round((.55+.35*broad)*255),round(crack*255)))
tile.putdata(pix);norm=Image.new('RGB',(S,S));ns=[]
for y in range(S):
 for x in range(S):
  dx=(height[y*S+(x-1)%S]-height[y*S+(x+1)%S])*1.4
  dy=(height[((y-1)%S)*S+x]-height[((y+1)%S)*S+x])*1.4
  l=math.sqrt(dx*dx+dy*dy+1)
  ns.append((round((dx/l*.5+.5)*255),round((dy/l*.5+.5)*255),round((1/l*.5+.5)*255)))
norm.putdata(ns)
assets=r/'assets';tile.save(assets/'ground-detail.png',optimize=True);norm.save(assets/'ground-normal.png',optimize=True)
print('Baked original 256px ground maps:', sum((assets/n).stat().st_size for n in ['ground-detail.png','ground-normal.png']),'bytes')
