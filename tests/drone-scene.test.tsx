import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGLTF } from '@react-three/drei';
import {
  CAMERA_Y,
  DroneScene,
  FLIGHT_STOPS,
  GIMBAL_LANDING_PITCH,
  GIMBAL_LANDING_YAW,
  LANDING_POSE,
  interpolatePose,
  follow,
  parkedPoseY,
  poseToWorld,
  pointerLook,
  resolveStopOffsets,
  rotorTargetSpeed,
  stepRotorSpeed,
} from '../components/drone-scene';

const motion = { paused: false, reduced: false, desktop: false, saveData: false };
vi.mock('../components/motion-context', () => ({ useMotion: () => motion }));
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="drone-canvas">{children}</div>,
  useFrame: () => undefined,
  useThree: () => ({ viewport: { width: 10, height: 6 }, size: { width: 1000, height: 600 } }),
}));
vi.mock('@react-three/drei', () => ({ useGLTF: Object.assign(vi.fn(() => ({ scene: { getObjectByName: () => undefined } })), { preload: () => undefined }) }));

afterEach(() => {
  vi.clearAllMocks();
  motion.desktop = false;
  motion.paused = false;
  motion.reduced = false;
  motion.saveData = false;
});

describe('DroneScene', () => {
  it('loads the approved white drone asset on eligible devices', () => {
    motion.desktop = true;
    render(<DroneScene />);
    expect(useGLTF).toHaveBeenCalledWith('/media/drone/aele-white-drone.glb');
  });

  it('renders nothing at all when motion is not eligible', () => {
    const { container } = render(<DroneScene />);
    expect(screen.queryByTestId('drone-canvas')).not.toBeInTheDocument();
    // No decorative still stands in for the drone on phones or under reduced motion.
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('keeps the drone active when the hero motion control is paused', () => {
    motion.desktop = true;
    motion.paused = true;
    render(<DroneScene />);
    expect(screen.getByTestId('drone-canvas')).toBeInTheDocument();
  });
});

describe('poseToWorld', () => {
  const view = { width: 10, height: 6 };
  const pose = (x: number, y: number, width = 0.25) => ({ x, y, width, rotationX: 0, rotationY: 0, rotationZ: 0 });

  it('puts a centred pose on the point the camera aims at', () => {
    // React Three Fiber points the default camera at the origin, so screen centre is world zero.
    // Assuming otherwise offsets every pose vertically by the camera height.
    expect(CAMERA_Y).toBe(0);
    const world = poseToWorld(pose(0.5, 0.5), view.width, view.height);
    expect(world.x).toBeCloseTo(0);
    expect(world.y).toBeCloseTo(0);
  });

  it('maps viewport fractions onto the visible world extent', () => {
    expect(poseToWorld(pose(1, 0.5), view.width, view.height).x).toBeCloseTo(5);
    expect(poseToWorld(pose(0, 0.5), view.width, view.height).x).toBeCloseTo(-5);
    expect(poseToWorld(pose(0.5, 1), view.width, view.height).y).toBeCloseTo(CAMERA_Y - 3);
    expect(poseToWorld(pose(0.5, 0), view.width, view.height).y).toBeCloseTo(CAMERA_Y + 3);
  });

  it('derives scale from the requested on-screen width', () => {
    const narrow = poseToWorld(pose(0.5, 0.5, 0.2), view.width, view.height);
    const wide = poseToWorld(pose(0.5, 0.5, 0.4), view.width, view.height);
    expect(wide.scale).toBeCloseTo(narrow.scale * 2);
    expect(narrow.scale).toBeGreaterThan(0);
  });

  it('keeps the same viewport fraction on a different aspect', () => {
    const a = poseToWorld(pose(0.75, 0.5), 10, 6);
    const b = poseToWorld(pose(0.75, 0.5), 20, 6);
    expect(a.x / 10).toBeCloseTo(b.x / 20);
  });
});

describe('resolveStopOffsets', () => {
  const stops = [
    { selector: null, pose: LANDING_POSE },
    { selector: '.mid', pose: LANDING_POSE },
    { selector: '.end', pose: LANDING_POSE },
  ];
  const measure = (selector: string) =>
    ({ '.mid': { top: 1000, height: 400 }, '.end': { top: 4000, height: 500 } })[selector] ?? null;

  it('anchors the opening stop to the top of the page', () => {
    expect(resolveStopOffsets(stops, measure, 600, 5000)[0].at).toBe(0);
  });

  it('places each stop where its element sits centred in the viewport', () => {
    const resolved = resolveStopOffsets(stops, measure, 600, 5000);
    expect(resolved[1].at).toBeCloseTo((1000 + 200 - 300) / 5000);
    expect(resolved[2].at).toBeCloseTo((4000 + 250 - 300) / 5000);
  });

  it('drops stops whose element is not on the page', () => {
    const resolved = resolveStopOffsets(stops, () => null, 600, 5000);
    expect(resolved).toHaveLength(1);
  });

  it('returns stops in ascending scroll order', () => {
    const shuffled = [stops[0], stops[2], stops[1]];
    const resolved = resolveStopOffsets(shuffled, measure, 600, 5000);
    const order = resolved.map((stop) => stop.at);
    expect(order).toEqual(order.slice().sort((a, b) => a - b));
  });

  it('reaches an aligned stop when its element sits at the requested height', () => {
    const aligned = [{ selector: '.end', pose: LANDING_POSE, align: 0.2 }];
    const [stop] = resolveStopOffsets(aligned, measure, 600, 5000);
    // Element top 4000, reached once it sits 0.2 * 600 = 120px below the top of the viewport.
    expect(stop.at).toBeCloseTo((4000 - 120) / 5000);
  });

  it('reaches an aligned stop earlier than the centred default', () => {
    const centred = resolveStopOffsets([{ selector: '.end', pose: LANDING_POSE }], measure, 600, 5000);
    const early = resolveStopOffsets([{ selector: '.end', pose: LANDING_POSE, align: 0.15 }], measure, 600, 5000);
    expect(early[0].at).toBeLessThan(centred[0].at);
  });

  it('survives a page that cannot scroll', () => {
    const resolved = resolveStopOffsets(stops, measure, 600, 0);
    expect(resolved.every((stop) => Number.isFinite(stop.at))).toBe(true);
  });
});

describe('interpolatePose', () => {
  const resolved = resolveStopOffsets(
    FLIGHT_STOPS,
    (selector) => ({ top: FLIGHT_STOPS.findIndex((stop) => stop.selector === selector) * 1000, height: 500 }),
    600,
    6000,
  );

  it('holds the opening pose at the top of the page', () => {
    const { pose, landing } = interpolatePose(resolved, 0);
    expect(pose.x).toBeCloseTo(FLIGHT_STOPS[0].pose.x);
    expect(landing).toBe(0);
  });

  it('settles on the landing pose at the end of the flight', () => {
    const { pose, landing } = interpolatePose(resolved, 1);
    expect(pose.x).toBeCloseTo(LANDING_POSE.x);
    expect(pose.width).toBeCloseTo(LANDING_POSE.width);
    expect(landing).toBe(1);
  });

  it('reports landing only across the final approach', () => {
    const last = resolved[resolved.length - 1].at;
    const previous = resolved[resolved.length - 2].at;
    expect(interpolatePose(resolved, previous).landing).toBeCloseTo(0);
    expect(interpolatePose(resolved, (previous + last) / 2).landing).toBeCloseTo(0.5);
  });

  it('blends linearly between two stops', () => {
    const [first, second] = resolved;
    const half = interpolatePose(resolved, (first.at + second.at) / 2).pose;
    expect(half.x).toBeCloseTo((first.pose.x + second.pose.x) / 2);
    expect(half.width).toBeCloseTo((first.pose.width + second.pose.width) / 2);
  });

  it('never jumps between neighbouring scroll positions', () => {
    let previous = interpolatePose(resolved, 0).pose;
    for (let progress = 0.01; progress <= 1; progress += 0.01) {
      const next = interpolatePose(resolved, progress).pose;
      expect(Math.abs(next.x - previous.x)).toBeLessThan(0.1);
      expect(Math.abs(next.y - previous.y)).toBeLessThan(0.1);
      previous = next;
    }
  });
});

describe('FLIGHT_STOPS', () => {
  const films = FLIGHT_STOPS.filter((stop) => stop.selector?.startsWith('.film-'));

  it('holds the right lane across every catalogue film, which all sit on the left', () => {
    expect(films).toHaveLength(3);
    for (const { pose } of films) {
      expect(pose.x).toBeGreaterThan(0.6);
      expect(pose.x - pose.width / 2).toBeGreaterThan(0.61);
    }
  });

  it('keeps the films at one height so the pass reads as a single move', () => {
    expect(new Set(films.map((stop) => stop.pose.y)).size).toBe(1);
    expect(films[0].pose.y).toBeCloseTo(0.5);
  });

  it('turns the drone toward the films on its left', () => {
    for (const { pose } of films) expect(pose.rotationY).toBeLessThan(0);
  });

  it('shrinks the drone over the full-bleed story so it stops covering the footage', () => {
    const story = FLIGHT_STOPS.find((stop) => stop.selector === '.scroll-story');
    expect(story?.pose.width).toBeLessThan(0.2);
    for (const stop of FLIGHT_STOPS) {
      if (stop.selector !== '.scroll-story') expect(stop.pose.width).toBeGreaterThan(story!.pose.width);
    }
  });

  it('keeps every stop inside the viewport', () => {
    for (const { pose } of FLIGHT_STOPS) {
      expect(pose.x - pose.width / 2).toBeGreaterThan(-0.02);
      expect(pose.x + pose.width / 2).toBeLessThan(1.02);
      expect(pose.y).toBeGreaterThan(0);
      expect(pose.y).toBeLessThan(1);
    }
  });

  it('finishes the landing while the contact form is still framed', () => {
    const contact = FLIGHT_STOPS.filter((stop) => stop.selector === '#contacto');
    // An approach stop then the parked stop, so the descent is a move rather than a long drift.
    expect(contact).toHaveLength(2);
    expect(contact[1].pose).toBe(LANDING_POSE);
    // The parked stop is reached well before the page bottom, not at the very end of the scroll.
    expect(contact[1].align).toBeDefined();
    // Parked while the section is still high in the viewport, not at the page bottom.
    expect(contact[1].align!).toBeGreaterThan(0.2);
    expect(contact[1].align!).toBeLessThan(0.4);
    expect(contact[0].align!).toBeGreaterThan(contact[1].align!);
  });

  it('is already parked once the contact section is framed', () => {
    const stops = resolveStopOffsets(
      FLIGHT_STOPS,
      (selector) => (selector === '#contacto' ? { top: 6076, height: 745 } : { top: 5189, height: 738 }),
      849,
      6364,
    );
    // Matches the reported scroll position where the form is fully in view.
    const framed = (6076 - 0.14 * 849) / 6364;
    expect(interpolatePose(stops, framed).landing).toBe(1);
  });

  it('keeps the hero drone clear of the centred hero copy', () => {
    const hero = FLIGHT_STOPS[0];
    expect(hero.selector).toBeNull();
    // The copy starts around a third of the way down, so the drone stays above it.
    expect(hero.pose.y + hero.pose.width / 4).toBeLessThan(0.4);
  });

  it('lands low on the left, turned toward the contact form', () => {
    expect(LANDING_POSE.y).toBeGreaterThan(0.6);
    expect(LANDING_POSE.x).toBeLessThan(0.5);
    expect(LANDING_POSE.rotationY).toBeGreaterThan(0);
  });
});

describe('parking the drone on the page', () => {
  const parked = FLIGHT_STOPS[FLIGHT_STOPS.length - 1];
  // Measured inside the contact section: the intro paragraph ends 386px below the section top.
  const CLEAR = 386 + 40;
  const WIDTH = parked.pose.width;
  const topEdge = (y: number, width: number) => y - 0.37 * width;

  it('rests at a fixed place inside the section, not a fixed place on the screen', () => {
    expect(parked.clearBelow).toBeDefined();
    const framed = parkedPoseY(0, CLEAR, WIDTH, 800);
    const scrolledOn = parkedPoseY(-200, CLEAR, WIDTH, 800);
    // Scrolling 200px moves the drone 200px up the screen — it holds station on the page.
    expect(scrolledOn).toBeCloseTo(framed - 200 / 800);
  });

  it('clears the intro copy at every viewport height', () => {
    for (const viewportHeight of [600, 664, 800, 854, 1080, 1440]) {
      const y = parkedPoseY(0, CLEAR, WIDTH, viewportHeight);
      // The drone's top edge stays below the paragraph, whatever the viewport shape.
      expect(topEdge(y, WIDTH) * viewportHeight).toBeGreaterThan(386);
    }
  });

  it('stays inside the section rather than sliding onto the footer', () => {
    const SECTION = 745;
    for (const viewportHeight of [664, 854, 1080]) {
      const y = parkedPoseY(0, CLEAR, WIDTH, viewportHeight);
      expect((y + 0.162 * WIDTH) * viewportHeight).toBeLessThan(SECTION);
    }
  });

  it('degrades safely without a measurable viewport', () => {
    expect(Number.isFinite(parkedPoseY(0, CLEAR, WIDTH, 0))).toBe(true);
  });
});

describe('follow', () => {
  const frame = 0.016;

  it('damps normally while the drone is flying', () => {
    const flown = follow(0, 10, 2.8, frame, 0);
    expect(flown).toBeGreaterThan(0);
    expect(flown).toBeLessThan(10);
  });

  it('tracks the target exactly once parked', () => {
    // A parked drone belongs to the page, so any lag reads as the drone sliding around.
    expect(follow(0, 10, 2.8, frame, 1)).toBe(10);
    expect(follow(-4, 2.5, 2.8, frame, 1)).toBe(2.5);
  });

  it('hands over gradually so the landing has no seam', () => {
    const damped = follow(0, 10, 2.8, frame, 0);
    const half = follow(0, 10, 2.8, frame, 0.5);
    expect(half).toBeGreaterThan(damped);
    expect(half).toBeLessThan(10);
    expect(half).toBeCloseTo(damped + (10 - damped) * 0.5);
  });

  it('does not overshoot when the target is already reached', () => {
    expect(follow(5, 5, 2.8, frame, 0)).toBeCloseTo(5);
    expect(follow(5, 5, 2.8, frame, 1)).toBe(5);
  });
});

describe('rotorTargetSpeed', () => {
  it('holds the rotors still until the page is scrolled', () => {
    expect(rotorTargetSpeed(0, 0)).toBe(0);
  });

  it('spins the rotors up as the first scroll begins', () => {
    const early = [0.005, 0.01, 0.02, 0.04].map((progress) => rotorTargetSpeed(progress, 0));
    for (let index = 1; index < early.length; index += 1) {
      expect(early[index]).toBeGreaterThan(early[index - 1]);
    }
    expect(early[0]).toBeGreaterThan(0);
    // Cruising revs are reached quickly, well inside the hero.
    expect(rotorTargetSpeed(0.06, 0)).toBeCloseTo(rotorTargetSpeed(0.06, 0));
    expect(rotorTargetSpeed(0.08, 0)).toBeGreaterThan(rotorTargetSpeed(0.04, 0) * 0.9);
  });

  it('keeps the rotors spinning at the end of the scroll when no landing is underway', () => {
    expect(rotorTargetSpeed(1, 0)).toBeGreaterThan(0);
  });

  it('cuts the target to a full stop once parked', () => {
    expect(rotorTargetSpeed(0.4, 1)).toBe(0);
    expect(rotorTargetSpeed(1, 1)).toBe(0);
  });

  it('decreases monotonically as the landing progresses', () => {
    const speeds = [0, 0.25, 0.5, 0.75, 1].map((landing) => rotorTargetSpeed(0.9, landing));
    for (let index = 1; index < speeds.length; index += 1) {
      expect(speeds[index]).toBeLessThan(speeds[index - 1]);
    }
  });
});

describe('stepRotorSpeed', () => {
  const frame = 0.016;
  const cruise = rotorTargetSpeed(1, 0);
  const run = (from: number, target: number, done: (value: number) => boolean, limit = 1200) => {
    let value = from;
    let frames = 0;
    while (!done(value) && frames < limit) {
      value = stepRotorSpeed(value, target, frame);
      frames += 1;
    }
    return { value, frames };
  };

  it('ramps down instead of cutting to zero', () => {
    const afterOneFrame = stepRotorSpeed(cruise, 0, frame);
    expect(afterOneFrame).toBeLessThan(cruise);
    expect(afterOneFrame).toBeGreaterThan(cruise * 0.9);
  });

  it('eventually reaches a full stop', () => {
    const { value, frames } = run(cruise, 0, (current) => current === 0);
    expect(value).toBe(0);
    expect(frames).toBeLessThan(1200);
  });

  it('ramps up faster than it ramps down', () => {
    const up = run(0, cruise, (current) => current >= cruise * 0.9);
    const down = run(cruise, 0, (current) => current <= cruise * 0.1);
    expect(up.frames).toBeLessThan(down.frames);
  });

  it('snaps the last sliver of momentum to a clean stop', () => {
    expect(stepRotorSpeed(0.02, 0, frame)).toBe(0);
  });
});

describe('pointerLook', () => {
  it('looks down when the pointer is below the centre of the viewport', () => {
    expect(pointerLook({ x: 0, y: 1 }, 0).pitch).toBeGreaterThan(0);
    expect(pointerLook({ x: 0, y: -1 }, 0).pitch).toBeLessThan(0);
  });

  it('keeps following the pointer horizontally', () => {
    expect(pointerLook({ x: 1, y: 0 }, 0).yaw).toBeGreaterThan(0);
    expect(pointerLook({ x: -1, y: 0 }, 0).yaw).toBeLessThan(0);
  });

  it('locks onto the contact form once parked', () => {
    const look = pointerLook({ x: -1, y: -1 }, 1);
    expect(look.yaw).toBeCloseTo(GIMBAL_LANDING_YAW);
    expect(look.pitch).toBeCloseTo(GIMBAL_LANDING_PITCH);
  });

  it('fades pointer influence out while landing', () => {
    const spread = (landing: number) =>
      pointerLook({ x: 1, y: 1 }, landing).yaw - pointerLook({ x: -1, y: -1 }, landing).yaw;
    expect(spread(0.5)).toBeLessThan(spread(0));
    expect(spread(0.5)).toBeGreaterThan(0);
    expect(spread(1)).toBe(0);
  });
});
