#!/usr/bin/env python3
import sys
import os
import json
import FreeCAD
import Part
import Import

FAMILY_MODEL_MAP = {
    'valve': '100001060023.STEP',
    'flange': '100000000527.STEP',
    'pipe': '100001020385.STEP',
    'bolt': '100001020943.STEP',
    'gasket': '100001020944.STEP'
}

MODEL_BASE_PATH = '/Users/shenguoli/Documents/projects/design-institute-platform/docs/solidworks'

def load_step_file(doc, family):
    filename = FAMILY_MODEL_MAP.get(family)
    if not filename:
        print(f"WARNING: No model for {family}")
        return None
    filepath = os.path.join(MODEL_BASE_PATH, filename)
    if not os.path.exists(filepath):
        print(f"ERROR: Not found {filepath}")
        return None
    try:
        Import.insert(filepath, doc.Name)
        if len(doc.Objects) > 0:
            return doc.Objects[-1]
        return None
    except Exception as e:
        print(f"ERROR: Load failed: {e}")
        return None

def generate_assembly_from_file(placements_file, output_step):
    print(f"Reading: {placements_file}")
    if not os.path.exists(placements_file):
        print(f"ERROR: File not found")
        return False
    with open(placements_file, 'r') as f:
        placements = json.load(f)
    print(f"Generating: {len(placements)} parts")
    doc = FreeCAD.newDocument("PID_Assembly")
    FreeCAD.setActiveDocument("PID_Assembly")
    loaded = 0
    for idx, p in enumerate(placements):
        family = p.get('family', p.get('type', 'unknown'))
        pos = p['position']
        obj = load_step_file(doc, family)
        if not obj:
            if family == 'valve':
                shape = Part.makeCylinder(25, 100)
            elif family == 'flange':
                shape = Part.makeCylinder(60, 10)
            elif family == 'pipe':
                shape = Part.makeCylinder(25, 200)
            else:
                shape = Part.makeBox(20, 20, 20)
            obj = doc.addObject("Part::Feature", f"{family}_{idx}")
            obj.Shape = shape
        else:
            loaded += 1
        obj.Placement = FreeCAD.Placement(FreeCAD.Vector(pos['x'], pos['y'], pos['z']), FreeCAD.Rotation(0, 0, 0))
    doc.recompute()
    print(f"Stats: {loaded} STEP, {len(placements)-loaded} defaults")
    try:
        Import.export(doc.Objects, output_step)
        print(f"SUCCESS: STEP generated!")
    except Exception as e:
        print(f"ERROR: Export failed: {e}")
        return False
    fcstd = output_step.replace('.step', '.FCStd')
    try:
        doc.saveAs(fcstd)
        print(f"SUCCESS: FCStd saved!")
    except: pass
    print(f"COMPLETE: {len(doc.Objects)} parts")
    return True

placements_file = "/tmp/placements.json"
output_step = "/tmp/test_assembly.step"
print("FreeCAD Assembly Generator")
success = generate_assembly_from_file(placements_file, output_step)
print(f"Result: {'SUCCESS' if success else 'FAILED'}")
sys.exit(0 if success else 1)
