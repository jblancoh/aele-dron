"""Validate the standalone GLB contract without third-party dependencies."""
import json, struct, sys
from pathlib import Path

def validate(path):
    path=Path(path)
    assert path.exists(), f'Missing generated asset: {path}'
    data=path.read_bytes(); assert data[:4]==b'glTF'
    length,kind=struct.unpack_from('<II',data,12); doc=json.loads(data[20:20+length])
    nodes={n.get('name'):n for n in doc['nodes']}
    names=['DroneRoot','Rotor_FL','Rotor_FR','Rotor_RL','Rotor_RR','GimbalYaw','GimbalPitch']
    assert all(n in nodes for n in names)
    assert doc['nodes'].index(nodes['GimbalPitch']) in nodes['GimbalYaw']['children']
    for name in names[1:6]:
        assert doc['nodes'].index(nodes[name]) in nodes['DroneRoot']['children']
    assert any(m['name']=='Pearl white polymer' for m in doc['materials'])
    assert len(data)<3_000_000
    for name in names[1:6]:
        assert abs(nodes[name].get('rotation',[0,0,0,1])[0])<1e-5, name
    print('PASS GLB runtime hierarchy, upright local pivots, white material, <3 MB')
    return doc
if __name__=='__main__': validate(sys.argv[1])
