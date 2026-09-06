"""Blender 5.x: original low-poly assets, metres, Z-up; glTF exports Y-up."""
import bpy, math, os
from mathutils import Vector

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets')

def mat(name, color, metal=0, rough=.45, emission=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    if emission:
        p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=emission
    return m
WHITE=mat('Ceramic ivory',(.78,.85,.86),.25)
STEEL=mat('Brushed titanium',(.22,.32,.38),.7)
DARK=mat('Graphite',(.035,.065,.085),.4)
ORANGE=mat('Mission orange',(.95,.22,.045),.2)
GOLD=mat('Separation gold',(.94,.62,.13),.6)
GLASS=mat('Teal glazing',(.035,.32,.42),.7,.15)
LIGHT=mat('Navigation lights',(.25,.9,1),.2,.2,2)
CONCRETE=mat('Concrete',(.32,.39,.42),0,.85)
parts=[]

def finish(o,m):
    o.data.materials.append(m); parts.append(o); return o
def box(loc,scale,m,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object
    o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Machined edges','BEVEL'); mod.width=bevel; mod.segments=2
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,m)
def cone(loc,r1,r2,h,m,n=32):
    bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r1,radius2=r2,depth=h,location=loc)
    o=finish(bpy.context.object,m)
    for p in o.data.polygons: p.use_smooth=len(p.vertices)==4
    return o
def cyl(loc,r,h,m,n=32): return cone(loc,r,r,h,m,n)
def beam(a,b,r=.035,m=STEEL):
    v=Vector(b)-Vector(a); o=cyl((Vector(a)+Vector(b))/2,r,v.length,m,12)
    o.rotation_euler=v.to_track_quat('Z','Y').to_euler(); return o
def ring(z,r,h,m): return cyl((0,0,z),r,h,m)
def collect(name):
    global parts
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.join()
    o=bpy.context.object; o.name=name
    bpy.context.scene.cursor.location=(0,0,0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    parts=[]; return o

# Matching original w/h ratios; component origins are at bottom centre.
for size,w,h in [('large',56,44),('medium',48,36),('small',40,28)]:
    r=w/40; H=h/20
    cone((0,0,H*.29),r*.88,r*.4,H*.58,DARK)
    ring(.055,r*.91,.11,STEEL)
    cyl((0,0,H*.76),r*.78,H*.48,STEEL)
    ring(H*.96,r,.08,WHITE); ring(H*.62,r*.8,.12,ORANGE)
    for i in range(12):
        a=i*math.tau/12
        beam((math.cos(a)*r*.88,math.sin(a)*r*.88,.08),(math.cos(a)*r*.41,math.sin(a)*r*.41,H*.55),.018,STEEL)
    for i in range(6):
        a=i*math.tau/6
        cyl((math.cos(a)*r*.8,math.sin(a)*r*.8,H*.8),.065,H*.28,GOLD,12)
    collect('engine_'+size)

for size,w,h in [('large',56,120),('medium',48,76),('small',40,32)]:
    r=w/40; H=h/20
    cyl((0,0,H/2),r*.98,H,WHITE)
    for z in [.055,H-.055]: ring(z,r*1.015,.11,STEEL)
    ring(H*.20,r*.987,H*.11,ORANGE)
    ring(H*.82,r*.988,.065,DARK)
    for a in [i*math.tau/12 for i in range(12)]:
        beam((r*math.cos(a),r*math.sin(a),H*.29),(r*math.cos(a),r*math.sin(a),H*.79),.009,STEEL)
    box((0,-r,H*.54),(.45,.04,min(.95,H*.25)),DARK)
    for z in [.45,.55,.65]: box((0,-r-.024,H*z),(.24,.012,.045),LIGHT,0)
    collect('fuel_'+size)

ring(.4,1.3,.8,GOLD)
ring(.06,1.32,.12,DARK); ring(.74,1.32,.12,DARK)
for i in range(12):
    a=i*math.tau/12
    box((1.30*math.cos(a),1.30*math.sin(a),.4),(.13,.13,.3),STEEL)
collect('decoupler')

cone((0,0,1.16),1.2,.46,2.32,WHITE)
ring(.10,1.23,.2,DARK); ring(.25,1.18,.1,ORANGE)
ring(2.38,.45,.24,STEEL)
for a in [-math.pi/2,0,math.pi/2,math.pi]:
    o=box((.88*math.cos(a),.88*math.sin(a),1.22),(.5,.06,.43),GLASS,.07)
    o.rotation_euler[2]=a+math.pi/2
collect('capsule')

# Vertical assembly building; front is -Y. Foundation sits on the ground.
box((0,0,.20),(12,10,.4),CONCRETE)
box((0,0,6),(10,8,11.6),WHITE,.1)
box((0,0,11.9),(10.6,8.6,.35),STEEL)
box((0,-4.06,5.2),(5.6,.14,9.6),DARK)
for z in range(1,10): box((0,-4.15,z), (5.5,.1,.055),STEEL,0)
box((0,-4.18,10.5),(7.8,.15,.6),ORANGE)
for x in [-4.2,4.2]:
    box((x,-4.12,6),(.3,.25,10.5),STEEL)
    for z in [2,4,6,8,10]: box((x,-4.28,z),(.38,.08,.5),LIGHT)
for side in [-1,1]:
    for y in [-2.8,-1.4,0,1.4,2.8]:
        box((side*5.04,y,8.5),(.06,.9,1.8),GLASS)
        box((side*5.03,y,3),(.06,.95,.08),ORANGE)
for x in [-3,0,3]: box((x,1,12.4),(1.5,2,.7),DARK)
box((5.9,1,1.8),(2,5,3.2),STEEL)
collect('vab')

# Radar dish, actual concave mesh with radial ribs and receiver supports.
box((0,0,.18),(8,7,.36),CONCRETE)
box((0,0,1.5),(6,5,2.65),WHITE)
box((0,0,2.95),(6.3,5.3,.2),STEEL)
for x in [-2,0,2]: box((x,-2.52,1.7),(1.4,.06,.65),GLASS)
cyl((0,0,4),.55,2.2,STEEL)
verts=[]; faces=[]; R=3.8; rings=10; N=48
for j in range(rings+1):
    r=R*j/rings
    for i in range(N):
        a=i*math.tau/N; verts.append((r*math.cos(a),r*math.sin(a),5+r*r*.095))
for j in range(rings):
    for i in range(N):
        a=j*N+i; b=j*N+(i+1)%N; faces.append((a,b,b+N,a+N))
mesh=bpy.data.meshes.new('parabola'); mesh.from_pydata(verts,[],faces); mesh.update()
o=bpy.data.objects.new('dish',mesh); bpy.context.collection.objects.link(o); finish(o,WHITE)
for i in range(12):
    a=i*math.tau/12
    for j in range(8):
        r=R*j/8; q=R*(j+1)/8
        beam((r*math.cos(a),r*math.sin(a),5+r*r*.095+.035),(q*math.cos(a),q*math.sin(a),5+q*q*.095+.035),.025,STEEL)
for a in [0,math.tau/3,2*math.tau/3]: beam((3.3*math.cos(a),3.3*math.sin(a),6.05),(0,0,8),.045,STEEL)
cyl((0,0,8),.25,.65,ORANGE)
collect('radar')

# Launch platform plus gantry; clickable mesh excludes terrain entirely.
box((0,0,.3),(10,9,.6),CONCRETE,.12)
box((0,0,.64),(6,6,.08),DARK)
for x in [-4,4]:
    for y in [-3,-1,1,3]: box((x,y,.63),(.28,1,.08),GOLD,0)
for x in [-5.7,-4.3]:
    for y in [1.5,2.9]: beam((x,y,.6),(x,y,19),.1)
for z in range(1,19,2):
    for y in [1.5,2.9]:
        beam((-5.7,y,z),(-4.3,y,z+2),.055)
        beam((-4.3,y,z),(-5.7,y,z+2),.055)
    box((-5,2.2,z),(1.7,1.7,.10),STEEL)
for z in [5,11,17]:
    box((-3.2,2.2,z),(3.8,.65,.2),ORANGE)
    beam((-5,2.2,z-1.8),(-1.3,2.2,z),.06)
box((-5,2.2,19.3),(2,2,.45),ORANGE)
for y in [-4.4,4.4]:
    for x in [-4,-2,0,2,4]: beam((x,y,.6),(x,y,1.4),.035)
    beam((-4.7,y,1.4),(4.7,y,1.4),.035)
collect('pad')

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'rocket-models.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'rocket-models.glb'),export_format='GLB',export_yup=True)
print('Exported models to',OUT)
