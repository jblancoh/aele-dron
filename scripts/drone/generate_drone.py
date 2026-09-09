"""Generate an original articulated graphite quadcopter and web export with Blender."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
OUT = Path(__file__).resolve().parents[2] / 'assets/drone'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.materials): bpy.data.materials.remove(block)

def mat(name, color, metal=0, rough=.4):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    return m
graphite=mat('Graphite ceramic',(.048,.053,.061),.12,.39)
dark=mat('Soft black polymer',(.012,.014,.018),.03,.48)
light=mat('Warm silver markings',(.72,.77,.78),.55,.27)
metal=mat('Machined titanium',(.12,.135,.15),.78,.31)
glass=mat('Optical blue coated glass',(.009,.026,.04),.62,.13)
led=mat('Cool status light',(.15,.75,.83),.2,.22)
p=led.node_tree.nodes.get('Principled BSDF'); p.inputs['Emission Color'].default_value=(.1,.7,.8,1); p.inputs['Emission Strength'].default_value=2

def empty(name, loc, parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc; o.parent=parent; return o
root=empty('DroneRoot',(0,0,0))
def finish(o,name,material,parent=root,bevel=0):
    o.name=name; o.data.materials.append(material); o.parent=parent
    if bevel:
        mod=o.modifiers.new('Manufactured edge radii','BEVEL'); mod.width=bevel; mod.segments=3
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons:f.use_smooth=True
    if bevel:
        mod=o.modifiers.new('Area weighted production normals','WEIGHTED_NORMAL'); mod.keep_sharp=True; mod.weight=50
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def box(name,loc,scale,material=graphite,bevel=.06,parent=root):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,material,parent,bevel)
def cyl(name,loc,r,depth,material=metal,parent=root,axis=None,vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc); o=bpy.context.object
    if axis: o.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler()
    return finish(o,name,material,parent,.009)
def beam(name,a,b,width,height,material=graphite):
    center=(Vector(a)+Vector(b))/2; o=box(name,center,(width,(Vector(b)-Vector(a)).length,height),material,.055); o.rotation_euler=(Vector(b)-Vector(a)).to_track_quat('Y','Z').to_euler();return o
# Elliptical lofted shells, front points towards negative Y.
def shell(name,rings,material):
    verts=[]; faces=[]; n=48
    for z,rx,ry,cy in rings:
        for i in range(n):
            t=i*math.tau/n; verts.append((rx*math.cos(t),cy+ry*math.sin(t),z))
    for j in range(len(rings)-1):
        for i in range(n): faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    faces.extend([tuple(reversed(range(n))),tuple((len(rings)-1)*n+i for i in range(n))])
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);finish(o,name,material);return o
# Purpose-shaped loft: broad shoulder, tapered rear, low wedge nose.
def fuselage(name, sections, material):
    n=32; verts=[]; faces=[]
    for y,w,z,h in sections:
        for i in range(n):
            t=math.tau*i/n; c=math.cos(t); si=math.sin(t)
            verts.append((w*math.copysign(abs(c)**.5,c),y,z+h*math.copysign(abs(si)**.5,si)))
    for j in range(len(sections)-1):
        for i in range(n):faces.append((j*n+i,(j+1)*n+i,(j+1)*n+(i+1)%n,j*n+(i+1)%n))
    faces += [tuple(range(n)),tuple((len(sections)-1)*n+i for i in reversed(range(n)))]
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);finish(o,name,material)
    mod=o.modifiers.new('Continuous molded shell','SUBSURF');mod.levels=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return o
fuselage('Lower structural chassis',[(-.85,.28,.29,.07),(-.82,.33,.29,.095),(-.61,.435,.27,.10),(.42,.385,.28,.105),(.79,.255,.30,.07),(.83,.22,.30,.035)],dark)
fuselage('Aerodynamic upper shell',[(-.85,.28,.39,.035),(-.81,.33,.40,.045),(-.57,.435,.46,.115),(.30,.39,.48,.13),(.73,.28,.43,.08),(.81,.22,.40,.035)],graphite)
box('Battery parting line',(0,.27,.602),(.50,.69,.018),dark,.045)
box('Battery cover',(0,.27,.613),(.477,.667,.02),graphite,.042)
box('Battery latch',(0,.60,.624),(.14,.045,.015),dark,.012)
for i in range(4):box('Battery indicator '+str(i),(-.043+i*.029,.49,.628),(.016,.009,.003),led,.002)
for side in [-1,1]:
    for i in range(8):
        box('Cooling port', (side*.39,.02+i*.049,.375),(.014,.021,.055),dark,.004)
    cyl('Recessed fastener',(side*.315,-.49,.552),.018,.005,metal,vertices=12)
    cyl('Fastener socket',(side*.315,-.49,.556),.008,.003,dark,vertices=6)
# A single recessed front fascia keeps the nose functional without face-like details.
box('Forward sensor fascia',(0,-.827,.394),(.46,.022,.068),dark,.018)
# Four articulated rotor assemblies with swept blades.
for side,sx in [('L',-1),('R',1)]:
  for end,sy in [('F',-1),('R',1)]:
    name=end+side; x=sx*1.07; y=sy*.99
    beam('Arm_'+name,(sx*.34,sy*.42,.28),(x,y,.32),.16,.12)
    beam('Arm inset_'+name,(sx*.57,sy*.58,.385),(x*.94,y*.94,.415),.060,.012,dark)
    cyl('Arm hinge_'+name,(sx*.43,sy*.48,.34),.10,.15,graphite)
    cyl('Motor housing_'+name,(x,y,.39),.14,.14,graphite)
    cyl('Motor stator_'+name,(x,y,.475),.128,.024,dark)
    for k in range(12):
        t=k*math.tau/12;cyl('Motor detail_'+name,(x+.132*math.cos(t),y+.132*math.sin(t),.41),.008,.057,dark,vertices=8)
    rotor=empty('Rotor_'+name,(x,y,.505),root)
    cyl('Rotor hub_'+name,(0,0,0),.075,.043,dark,rotor)
    cyl('Hub screw_'+name,(0,0,.027),.021,.006,dark,rotor,vertices=12)
    for sign in [-1,1]:
        verts=[];faces=[];stations=[(.055,.026,0),(.15,.050,.00),(.34,.060,.025),(.56,.047,.060),(.72,.025,.085),(.78,.004,.090)]
        for r,w,sweep in stations:
            for z in [-.006,.006]:
                for edge in [-1,1]:verts.append((sign*r,sign*(sweep+edge*w),z+edge*w*.10))
        for j in range(len(stations)-1):
            a=j*4;b=a+4;faces.extend([(a,b,b+1,a+1),(a+2,a+3,b+3,b+2),(a,a+2,b+2,b),(a+1,b+1,b+3,a+3)])
        faces.extend([(0,1,3,2),(20,22,23,21)])
        mesh=bpy.data.meshes.new('Swept blade');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Blade_'+name,mesh);bpy.context.collection.objects.link(o);finish(o,o.name,dark,rotor,.004)
    rotor.rotation_euler.z=(.22 if sy<0 else -.4)*sx
    box('Landing strut_'+name,(x,y,.11),(.068,.085,.30),graphite,.018)
    box('Rubber foot_'+name,(x,y,-.075),(.09,.15,.035),dark,.013)
    box('Navigation strip_'+name,(x, y+sy*.13,.36),(.10,.014,.04),led,.008)
# Camera articulation, parenting uses local-space coordinates.
yaw=empty('GimbalYaw',(0,-.63,.18),root)
cyl('Yaw bearing',(0,0,0),.095,.065,dark,yaw)
box('Gimbal cradle',(0,-.035,-.12),(.33,.12,.045),metal,.018,yaw)
pitch=empty('GimbalPitch',(0,-.055,-.15),yaw)
box('Camera housing',(0,-.045,0),(.28,.23,.20),graphite,.018,pitch)
cyl('Lens titanium ring',(0,-.205,0),.096,.033,dark,pitch,axis=(0,-1,0))
cyl('Lens rubber seal',(0,-.228,0),.085,.011,dark,pitch,axis=(0,-1,0))
cyl('Optical front element',(0,-.238,0),.073,.007,glass,pitch,axis=(0,-1,0))
cyl('Inner lens pupil',(0,-.243,0),.027,.002,dark,pitch,axis=(0,-1,0))
for sx in [-1,1]:cyl('Pitch bearing',(sx*.172,-.025,0),.047,.018,dark,pitch,axis=(1,0,0))
# Restrained original branding.
bpy.ops.object.text_add(location=(-.105,.13,.627));o=bpy.context.object;o.name='AELE insignia';o.data.body='AELE';o.data.size=.065;o.data.extrude=.0008;o.data.space_character=1.2;o.data.materials.append(light);o.parent=root
bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
model_objects=[o for o in bpy.context.scene.objects]
# Export selection without stage, preserving pivot nodes.
bpy.ops.object.select_all(action='DESELECT')
for o in model_objects:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(OUT/'aele-graphite-drone.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_yup=True)
# Studio scene.
floor=mat('Studio background',(.027,.031,.04),0,.75)
box('Studio plinth',(0,0,-.24),(200,200,.2),floor,.02,parent=None)
def aim(o,at):o.rotation_euler=(Vector(at)-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3.5,-5.8,3.8));cam=bpy.context.object;cam.name='Studio camera';aim(cam,(0,0,.22));cam.data.type='ORTHO';cam.data.ortho_scale=4.9;bpy.context.scene.camera=cam
for name,loc,power,size,col in [('Key',(-3,-4,6),1000,4,(.95,.97,1)),('Rim',(2,3,4),1700,3,(.72,.84,1)),('Fill',(4,-1,2),350,3,(1,.95,.87))]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=col;aim(o,(0,0,0))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=80;scene.cycles.use_denoising=True
scene.world.color=(.08,.08,.08);scene.render.resolution_x=1600;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'aele-graphite-drone-preview.png')
scene.view_settings.view_transform='AgX'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'aele-graphite-drone.blend'))
bpy.ops.render.render(write_still=True)
# Validate actual export in clean scene.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(OUT/'aele-graphite-drone.glb'))
required=['DroneRoot','Rotor_FL','Rotor_FR','Rotor_RL','Rotor_RR','GimbalYaw','GimbalPitch']
assert all(n in bpy.data.objects for n in required)
assert bpy.data.objects['GimbalPitch'].parent.name=='GimbalYaw'
assert (OUT/'aele-graphite-drone.glb').stat().st_size < 3_000_000
for name in ['Rotor_FL','Rotor_FR','Rotor_RL','Rotor_RR','GimbalYaw']:
    assert bpy.data.objects[name].parent.name == 'DroneRoot'
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
triangles=0
for o in meshes:o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
report={'name':'AELE Graphite Drone','original_design':True,'format':'glTF 2.0 binary','units':'meters','blender_forward':'-Y','blender_up':'+Z','gltf_forward':'+Z','gltf_up':'+Y','pivots':required,'rotor_spin_axis_gltf':'local Y','gimbal_yaw_axis_gltf':'local Y','gimbal_pitch_axis_gltf':'local X','mesh_count':len(meshes),'triangles':triangles,'glb_bytes':(OUT/'aele-graphite-drone.glb').stat().st_size,'validation':'GLB reimport passed; required pivots and gimbal hierarchy verified','animations':'No baked clips. Rotate named pivots and DroneRoot at runtime.','studio':'Included in .blend only; excluded from GLB.','generator':'scripts/drone/generate_drone.py'}
(OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('DRONE_VALIDATION',json.dumps(report))
