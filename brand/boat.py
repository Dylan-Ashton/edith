from PIL import Image, ImageDraw, ImageFilter
import math
def render(S=1024):
    Z=S*2; g=lambda v:v*Z/256
    im=Image.new('RGBA',(Z,Z),(0,0,0,0)); d=ImageDraw.Draw(im)
    # tile: soft green gradient, slightly deeper at the bottom (water side)
    top=(154,187,158); bot=(104,146,113)
    grad=Image.new('RGBA',(Z,Z)); gd=ImageDraw.Draw(grad)
    for y in range(Z):
        t=y/Z; gd.line([(0,y),(Z,y)],fill=tuple(int(top[i]+(bot[i]-top[i])*t) for i in range(3))+(255,))
    mask=Image.new('L',(Z,Z),0); ImageDraw.Draw(mask).rounded_rectangle((0,0,Z-1,Z-1),radius=int(Z*0.225),fill=255)
    im.paste(grad,(0,0),mask); d=ImageDraw.Draw(im)
    cream=(252,248,238); cream2=(238,230,210); cream3=(222,211,186)
    # soft shadow under the boat so it sits on the water
    sh=Image.new('RGBA',(Z,Z),(0,0,0,0)); ImageDraw.Draw(sh).ellipse((g(56),g(190),g(200),g(220)),fill=(40,70,50,80)); sh=sh.filter(ImageFilter.GaussianBlur(g(6))); im.alpha_composite(sh); d=ImageDraw.Draw(im)
    # water: two gentle waves in a lighter green, drawn under the hull line
    for k,(yy,alpha) in enumerate([(212,235),(228,170)]):
        pts=[(g(x),g(yy+3*math.sin((x-40)/14))) for x in range(40,218,2)]
        d.line(pts,fill=(232,242,232,alpha),width=int(g(6)),joint='curve')
    # hull: classic origami boat — upturned tips, long flat bottom
    hull=[(g(22),g(172)),(g(34),g(142)),(g(52),g(150)),(g(204),g(150)),(g(222),g(142)),(g(234),g(172)),(g(186),g(206)),(g(70),g(206))]
    d.polygon(hull,fill=cream3)
    d.polygon([(g(22),g(172)),(g(34),g(142)),(g(52),g(150)),(g(128),g(150)),(g(128),g(206)),(g(70),g(206))],fill=cream)
    # inner band (the second layer of the fold) peeking above the hull
    d.polygon([(g(52),g(150)),(g(204),g(150)),(g(198),g(138)),(g(58),g(138))],fill=(206,194,166))
    # central peak with a light and a shaded facet
    d.polygon([(g(128),g(64)),(g(74),g(138)),(g(128),g(138))],fill=cream)
    d.polygon([(g(128),g(64)),(g(128),g(138)),(g(182),g(138))],fill=cream3)
    # one tiny ink detail: a short line of 'text' on the peak, so it's a draft, not a napkin
    for i,(x0,L) in enumerate([(100,24),(104,18)]):
        y=92+i*8; d.rounded_rectangle((g(x0),g(y),g(x0+L),g(y+3.5)),radius=int(g(2)),fill=(128,116,98,130))
    return im.resize((S,S),Image.LANCZOS)
icon=render(1024); icon.save('boat-icon.png')
for s in [16,32,64,128,256,512,1024]: render(max(s,64)).resize((s,s),Image.LANCZOS).save(f'boat_{s}.png')
# preview sheet
sheet=Image.new('RGB',(900,360),(236,236,232)); 
for i,(s,x) in enumerate([(256,20),(128,300),(64,450),(32,540),(16,600)]):
    im=Image.open(f'boat_{s}.png'); sheet.paste(im,(x,40),im)
# in a fake dock row with neighbours
dock=Image.new('RGBA',(900,100),(0,0,0,0)); ImageDraw.Draw(dock).rounded_rectangle((20,10,880,90),radius=20,fill=(235,235,235,255))
for i,c in enumerate([(70,120,230),(240,240,240),(255,205,70),(80,180,90)]):
    ImageDraw.Draw(dock).rounded_rectangle((40+i*74,20,100+i*74,80),radius=14,fill=c)
b=Image.open('boat_64.png').resize((60,60),Image.LANCZOS); dock.paste(b,(40+4*74,20),b)
sheet.paste(dock,(0,250),dock); sheet.save('boat-preview.png'); print('ok')
