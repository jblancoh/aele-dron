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
graphite=mat('Graphite ceramic',(.085,.10,.115),.65,.3)
dark=mat('Soft black polymer',(.017,.022,.028),.15,.38)
light=mat('Warm silver markings',(.72,.77,.78),.55,.27)
metal=mat('Machined titanium',(.25,.29,.32),.85,.22)
glass=mat('Optical blue coated glass',(.014,.11,.19),.85,.12)
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
shell('Lower fuselage',[(.12,.35,.64,.04),(.17,.48,.79,0),(.31,.50,.80,0),(.37,.49,.78,0)],dark)
shell('Aerodynamic upper shell',[(.38,.49,.78,0),(.48,.48,.77,.015),(.62,.38,.63,.06),(.67,.26,.45,.1)],graphite)
box('Battery inset',(0,.18,.67),(.40,.72,.026),dark,.04)
box('Battery spine',(0,.20,.69),(.31,.57,.018),graphite,.025)
for i in range(4):box('Battery indicator '+str(i),(-.08+i*.055,.42,.707),(.03,.015,.007),led,.004)
for side in [-1,1]:
    for i in range(6):
        o=box('Cooling louver', (side*.455,.13+i*.065,.40),(.02,.035,.07),dark,.006);o.rotation_euler.y=side*-.2
    # Nose collision optical sensors.
    cyl('Obstacle sensor bezel',(side*.27,-.686,.47),.085,.04,dark,axis=(0,-1,.2))
    cyl('Obstacle sensor optic',(side*.27,-.71,.475),.054,.008,glass,axis=(0,-1,.2))
# Four articulated rotor assemblies with swept blades.
for side,sx in [('L',-1),('R',1)]:
  for end,sy in [('F',-1),('R',1)]:
    name=end+side; x=sx*1.07; y=sy*.99
    beam('Arm_'+name,(sx*.34,sy*.42,.28),(x,y,.32),.22,.18)
    beam('Arm inset_'+name,(sx*.57,sy*.58,.385),(x*.94,y*.94,.415),.085,.018,dark)
    cyl('Arm hinge_'+name,(sx*.43,sy*.48,.34),.13,.24,metal)
    cyl('Motor housing_'+name,(x,y,.39),.16,.22,graphite)
    cyl('Motor stator_'+name,(x,y,.515),.132,.038,dark)
    for k in range(12):
        t=k*math.tau/12;cyl('Motor detail_'+name,(x+.14*math.cos(t),y+.14*math.sin(t),.40),.014,.115,metal,vertices=8)
    rotor=empty('Rotor_'+name,(x,y,.56),root)
    cyl('Rotor hub_'+name,(0,0,0),.094,.075,metal,rotor)
    cyl('Hub screw_'+name,(0,0,.044),.029,.013,dark,rotor,vertices=12)
    for sign in [-1,1]:
        verts=[];faces=[];stations=[(.055,.035,0),(.15,.07,.00),(.34,.095,.025),(.56,.08,.07),(.72,.045,.10),(.78,.006,.11)]
        for r,w,sweep in stations:
            for z in [-.012,.012]:
                for edge in [-1,1]:verts.append((sign*r,sign*(sweep+edge*w),z+edge*w*.10))
        for j in range(len(stations)-1):
            a=j*4;b=a+4;faces.extend([(a,b,b+1,a+1),(a+2,a+3,b+3,b+2),(a,a+2,b+2,b),(a+1,b+1,b+3,a+3)])
        faces.extend([(0,1,3,2),(20,22,23,21)])
        mesh=bpy.data.meshes.new('Swept blade');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Blade_'+name,mesh);bpy.context.collection.objects.link(o);finish(o,o.name,dark,rotor,.009)
    rotor.rotation_euler.z=(.22 if sy<0 else -.4)*sx
    box('Landing strut_'+name,(x,y,.11),(.105,.11,.34),graphite,.035)
    box('Rubber foot_'+name,(x,y,-.075),(.15,.19,.065),dark,.025)
    box('Navigation strip_'+name,(x, y+sy*.13,.36),(.10,.014,.04),led,.008)
# Camera articulation, parenting uses local-space coordinates.
yaw=empty('GimbalYaw',(0,-.63,.18),root)
cyl('Yaw bearing',(0,0,0),.14,.11,metal,yaw)
box('Gimbal cradle',(0,-.035,-.12),(.39,.19,.075),metal,.035,yaw)
pitch=empty('GimbalPitch',(0,-.055,-.15),yaw)
box('Camera housing',(0,-.045,0),(.30,.27,.22),graphite,.055,pitch)
cyl('Lens titanium ring',(0,-.205,0),.105,.07,metal,pitch,axis=(0,-1,0))
cyl('Lens rubber seal',(0,-.248,0),.088,.022,dark,pitch,axis=(0,-1,0))
cyl('Optical front element',(0,-.263,0),.073,.009,glass,pitch,axis=(0,-1,0))
cyl('Inner lens pupil',(0,-.270,0),.035,.003,dark,pitch,axis=(0,-1,0))
for sx in [-1,1]:cyl('Pitch bearing',(sx*.172,-.025,0),.055,.03,metal,pitch,axis=(1,0,0))
# Restrained original branding.
bpy.ops.object.text_add(location=(-.14,-.17,.69));o=bpy.context.object;o.name='AELE insignia';o.data.body='AELE';o.data.size=.11;o.data.extrude=.0008;o.data.space_character=1.2;o.data.materials.append(light);o.parent=root
bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
model_objects=[o for o in bpy.context.scene.objects]
# Export selection without stage, preserving pivot nodes.
bpy.ops.object.select_all(action='DESELECT')
for o in model_objects:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(OUT/'aele-graphite-drone.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_yup=True)
# Studio scene.
floor=mat('Studio background',(.14,.17,.20),.05,.65)
box('Studio plinth',(0,0,-.24),(200,200,.2),floor,.02,parent=None)
def aim(o,at):o.rotation_euler=(Vector(at)-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3.35,-4.7,3.0));cam=bpy.context.object;cam.name='Studio camera';aim(cam,(0,0,.22));cam.data.type='ORTHO';cam.data.ortho_scale=4.9;bpy.context.scene.camera=cam
for name,loc,power,size,col in [('Key',(-3,-4,6),1200,5,(.85,.93,1)),('Rim',(2,3,4),1600,3,(.6,.8,1)),('Fill',(4,-1,2),800,4,(1,.88,.7))]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=col;aim(o,(0,0,0))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.world.color=(.22,.22,.22);scene.render.resolution_x=1600;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
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
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
triangles=0
for o in meshes:o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
report={'name':'AELE Graphite Drone','original_design':True,'format':'glTF 2.0 binary','units':'meters','blender_forward':'-Y','blender_up':'+Z','gltf_forward':'+Z','gltf_up':'+Y','pivots':required,'rotor_spin_axis_gltf':'local Y','gimbal_yaw_axis_gltf':'local Y','gimbal_pitch_axis_gltf':'local X','mesh_count':len(meshes),'triangles':triangles,'glb_bytes':(OUT/'aele-graphite-drone.glb').stat().st_size,'validation':'GLB reimport passed; required pivots and gimbal hierarchy verified','animations':'No baked clips. Rotate named pivots and DroneRoot at runtime.','studio':'Included in .blend only; excluded from GLB.','generator':'scripts/drone/generate_drone.py'}
(OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('DRONE_VALIDATION',json.dumps(report))
