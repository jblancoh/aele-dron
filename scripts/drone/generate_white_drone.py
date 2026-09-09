"""Build the approved white folding drone using existing geometry helpers safely.
Run: Blender -b --python generate_white_drone.py -- --helpers PATH --output DIR
"""
import bpy, ast, math, json, argparse, sys, struct
from pathlib import Path
from mathutils import Vector
args=argparse.ArgumentParser(); args.add_argument('--helpers',type=Path,required=True); args.add_argument('--output',type=Path,required=True)
a=args.parse_args(sys.argv[sys.argv.index('--')+1:]); out=a.output;out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
# Load definitions only: importing the legacy generator would generate unwanted assets.
tree=ast.parse(a.helpers.read_text()); funcs={n.name:n for n in tree.body if isinstance(n,ast.FunctionDef)}
def load(name):exec(compile(ast.Module(body=[funcs[name]],type_ignores=[]),str(a.helpers),'exec'),globals())
load('mat');load('empty')
root=empty('DroneRoot',(0,0,0));graphite=mat('Pearl white polymer',(.83,.845,.86),.04,.3)
dark=mat('Graphite propeller polymer',(.022,.026,.031),.05,.4)
metal=mat('Brushed motor aluminum',(.38,.41,.44),.85,.24)
glass=mat('Coated optical glass',(.008,.025,.029),.65,.1)
rubber=mat('Black elastomer',(.012,.014,.017),0,.55)
seam=mat('Panel seam shadow',(.13,.15,.17),.12,.42)
for name in ['finish','box','cyl','beam','fuselage','aim']:load(name)
# Fuller longitudinal shell and sloped nose match the approved folding-drone silhouette.
fuselage('White upper monocoque',[(-.86,.27,.45,.065),(-.81,.39,.46,.105),(-.48,.44,.57,.16),(.37,.35,.65,.15),(.74,.29,.62,.13),(.82,.24,.59,.085)],graphite)
fuselage('Lower white chassis',[(-.84,.27,.35,.055),(-.78,.37,.34,.065),(-.40,.40,.34,.09),(.46,.33,.36,.10),(.80,.23,.43,.075)],graphite)
box('Top hatch perimeter seam',(0,.47,.704),(.235,.010,.006),seam,.003)
box('Top hatch left seam',(-.285,.16,.730),(.008,.285,.005),seam,.003)
box('Top hatch right seam',(.285,.16,.730),(.008,.285,.005),seam,.003)
box('Top hatch forward seam',(0,-.125,.747),(.225,.008,.005),seam,.003)
box('Rear cooling outlet',(0,.515,.668),(.145,.050,.028),dark,.010)
for sx in [-1,1]:
    for j in range(9):box('Vent grille',(sx*.35,.18+j*.043,.59),(.019,.023,.105),dark,.008)
box('Forward stereo sensor fascia',(0,-.838,.424),(.345,.018,.055),seam,.015)
box('Forward rangefinder window',(0,-.860,.425),(.075,.007,.018),glass,.006)
for sx,side in [(-1,'L'),(1,'R')]:
    cyl('Forward optical recess '+side,(sx*.245,-.858,.424),.039,.009,rubber,axis=(0,-1,0))
    cyl('Forward optical glass '+side,(sx*.245,-.865,.424),.028,.006,glass,axis=(0,-1,0))
for side,sx in [('L',-1),('R',1)]:
  for end,sy in [('F',-1),('R',1)]:
    name=end+side;x=sx*1.14;y=sy*.80;z=.43 if sy<0 else .48
    hinge=(sx*.405,sy*.46,z)
    cyl('Folding hinge '+name,hinge,.115,.17,graphite)
    cyl('Hinge recessed pin '+name,(hinge[0],hinge[1],z+.089),.036,.012,metal,vertices=16)
    arm_end=Vector((x,y,z));arm_start=Vector(hinge)
    arm=box('Articulated white arm '+name,(arm_start+arm_end)/2,(.185,(arm_end-arm_start).length,.14),graphite,.018)
    arm.rotation_euler=(arm_end-arm_start).to_track_quat('Y','Z').to_euler()
    beam('Hinge seam '+name,(sx*.51,sy*.50,z+.077),(sx*.535,sy*.51,z+.077),.18,.008,dark)
    cyl('White motor mount '+name,(x,y,z),.143,.20,graphite)
    cyl('Motor cooling collar '+name,(x,y,z+.106),.136,.027,dark)
    cyl('Aluminum motor bell '+name,(x,y,z+.155),.126,.12,metal)
    cyl('Motor black cap '+name,(x,y,z+.222),.118,.02,dark)
    rotor=empty('Rotor_'+name,(x,y,z+.265),root)
    cyl('Rotor hub '+name,(0,0,0),.068,.034,dark,rotor)
    for sign in [-1,1]:
      verts=[];faces=[];stations=[(.04,.025,0),(.16,.055,.00),(.34,.075,.035),(.57,.07,.065),(.77,.034,.09),(.83,.01,.09)]
      for r,w,sweep in stations:
        for zz in [-.005,.005]:
          for e in [-1,1]:verts.append((sign*r,sign*(sweep+e*w),zz+e*w*.1))
      for j in range(5):
        k=j*4;l=k+4;faces.extend([(k,l,l+1,k+1),(k+2,k+3,l+3,l+2),(k,k+2,l+2,l),(k+1,l+1,l+3,k+3)])
      faces.extend([(0,1,3,2),(20,22,23,21)])
      me=bpy.data.meshes.new('Aerodynamic blade');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('Black folding blade '+name,me);bpy.context.collection.objects.link(o);finish(o,o.name,dark,rotor,.003)
    rotor.rotation_euler.z=.22*sx if sy<0 else -.25*sx
    for sign in [-1,1]:cyl('Propeller screw '+name,(sign*.041,0,.022),.013,.004,metal,rotor,vertices=12)
    beam('White landing leg '+name,(x,y,z-.07),(x+sx*.035,y-.025,-.11),.073,.087,graphite)
    box('Rubber landing sole '+name,(x+sx*.035,y-.025,-.14),(.086,.12,.037),rubber,.012)
# Suspended camera: white nose above a dark functional yoke.
yaw=empty('GimbalYaw',(0,-.62,.29),root)
cyl('Yaw bearing',(0,0,0),.092,.07,metal,yaw)
box('Gimbal overhead yoke',(0,-.07,-.065),(.44,.14,.065),dark,.022,yaw)
for sx in [-1,1]:box('Gimbal side arm',(sx*.198,-.06,-.13),(.045,.10,.19),dark,.018,yaw)
for sx,side in [(-1,'L'),(1,'R')]:box('Gimbal side fairing '+side,(sx*.235,-.065,-.115),(.033,.132,.115),graphite,.014,yaw)
pitch=empty('GimbalPitch',(0,-.09,-.19),yaw)
box('Stabilized camera body',(0,-.03,0),(.325,.255,.245),dark,.035,pitch)
box('Camera front bezel',(0,-.162,0),(.284,.04,.215),metal,.029,pitch)
box('Camera glass surround',(0,-.187,0),(.253,.018,.19),rubber,.032,pitch)
cyl('Camera lens barrel',(0,-.20,0),.087,.03,dark,pitch,axis=(0,-1,0))
cyl('Camera optical glass',(0,-.219,0),.072,.008,glass,pitch,axis=(0,-1,0))
cyl('Camera inner pupil',(0,-.224,0),.034,.002,dark,pitch,axis=(0,-1,0))
for sx in [-1,1]:cyl('Camera pitch bearing',(sx*.185,-.035,0),.09,.03,metal,pitch,axis=(1,0,0))
model=list(bpy.context.scene.objects);bpy.ops.object.select_all(action='DESELECT')
for o in model:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(out/'aele-white-drone.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_yup=True)
box('Studio floor',(0,0,-.23),(200,200,.10),mat('Studio gray',(.21,.22,.235),0,.8),.01,parent=None)
bpy.ops.object.camera_add(location=(3.6,-5.8,3.4));cam=bpy.context.object;aim(cam,(0,0,.3));cam.data.type='ORTHO';cam.data.ortho_scale=4.75;bpy.context.scene.camera=cam
for loc,power,size in [((-3,-4,6),850,5),((2,3,4),1050,4),((4,-1,2),250,3)]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;aim(o,(0,0,.2))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=40;scene.cycles.use_denoising=True;scene.world.color=(.12,.12,.12)
scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.render.filepath=str(out/'aele-white-drone-preview.png');scene.view_settings.view_transform='AgX'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'aele-white-drone.blend'));bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.ops.import_scene.gltf(filepath=str(out/'aele-white-drone.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];points=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
mins=[min(p[i] for p in points) for i in range(3)];maxs=[max(p[i] for p in points) for i in range(3)];tri=0
for o in meshes:o.data.calc_loop_triangles();tri+=len(o.data.loop_triangles)
report={'name':'AELE White Folding Drone','blender_bounds':{'min':mins,'max':maxs},'gltf_bounds':{'min':[mins[0],mins[2],-maxs[1]],'max':[maxs[0],maxs[2],-mins[1]]},'width':maxs[0]-mins[0],'triangles':tri,'mesh_count':len(meshes),'glb_bytes':(out/'aele-white-drone.glb').stat().st_size,'pivots':{n:list(bpy.data.objects[n].location) for n in ['Rotor_FL','Rotor_FR','Rotor_RL','Rotor_RR','GimbalYaw','GimbalPitch']},'gltf_axes':{'up':'+Y','front':'+Z','rotor_spin':'local Y','gimbal_yaw':'local Y','gimbal_pitch':'local X'},'materials':list(set(m.name for o in meshes for m in o.data.materials)),'validation':'Reimported GLB, measured world geometry; standalone validator checks JSON hierarchy.'}
report['blender_local_pivots']=report.pop('pivots')
blob=(out/'aele-white-drone.glb').read_bytes();size=struct.unpack_from('<I',blob,12)[0];doc=json.loads(blob[20:20+size])
report['gltf_local_pivots']={n['name']:n.get('translation',[0,0,0]) for n in doc['nodes'] if n.get('name') in report['blender_local_pivots']}
report['materials']=[m['name'] for m in doc['materials']]
assert 3.6<report['width']<4.3
(out/'white-drone-manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('WHITE_DRONE_REPORT',json.dumps(report))
