import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('white drone asset contract', () => {
  it('ships a lightweight, articulated white model and preserves the previous asset', () => {
    const file = readFileSync(resolve('public/media/drone/aele-white-drone.glb'));
    expect(file.readUInt32LE(0)).toBe(0x46546c67);
    expect(file.readUInt32LE(4)).toBe(2);
    expect(file.readUInt32LE(8)).toBe(file.length);
    expect(file.length).toBeLessThan(3_000_000);
    expect(file.readUInt32LE(16)).toBe(0x4e4f534a);
    const gltf = JSON.parse(file.toString('utf8', 20, 20 + file.readUInt32LE(12)));
    const nodes = gltf.nodes as { name?: string; children?: number[] }[];
    const indexOf = (name: string) => nodes.findIndex((node) => node.name === name);
    for (const name of ['DroneRoot', 'Rotor_FL', 'Rotor_FR', 'Rotor_RL', 'Rotor_RR', 'GimbalYaw', 'GimbalPitch']) {
      expect(nodes.filter((node) => node.name === name), name).toHaveLength(1);
    }
    const root = nodes[indexOf('DroneRoot')];
    for (const name of ['Rotor_FL', 'Rotor_FR', 'Rotor_RL', 'Rotor_RR', 'GimbalYaw']) {
      expect(root.children, name).toContain(indexOf(name));
      expect(nodes[indexOf(name)].children?.length, name).toBeGreaterThan(0);
    }
    expect(nodes[indexOf('GimbalYaw')].children).toContain(indexOf('GimbalPitch'));
    expect(gltf.animations ?? []).toHaveLength(0);
    expect(gltf.materials.some((material: { pbrMetallicRoughness?: { baseColorFactor?: number[] } }) => {
      const color = material.pbrMetallicRoughness?.baseColorFactor;
      return color && color.slice(0, 3).every((channel) => channel > 0.7);
    })).toBe(true);
    expect(file.equals(readFileSync(resolve('assets/drone/aele-white-drone.glb')))).toBe(true);
    expect(readFileSync(resolve('public/media/drone/aele-graphite-drone.glb')).length).toBeGreaterThan(0);
  });
});
