// src/games/whirlybird/index.ts
import type {
  AnchorComp,
  AreaComp,
  ColorComp,
  FixedComp,
  GameObj,
  PosComp,
  RectComp,
  RotateComp,
  SpriteComp,
  TextComp,
} from "kaplay";
import {
  BaseGame,
  GAME_WIDTH,
  GAME_HEIGHT,
  type GameControls,
  type GameOverHandler,
} from "@/games/base";
import characterSprite from "@/assets/character.webp";

// Board dimensions (same 16:9 as base)
const BOARD_WIDTH = GAME_WIDTH;
const BOARD_HEIGHT = GAME_HEIGHT;

// Player — the whirlybird
const PLAYER_RADIUS = GAME_WIDTH * 0.025;
const PLAYER_JUMP_SPEED = GAME_HEIGHT * 0.77;
const PLAYER_MOVE_SPEED = GAME_WIDTH * 0.4;
const PLAYER_GRAVITY = GAME_HEIGHT * 1.0;

// Spin — the character spins fast while ascending (the "whirlybird"), then
// the spin decelerates during the fall so it visibly slows before landing.
// On landing the rotation snaps to the nearest upright angle (multiple of
// 2π) so he always lands on his feet and launches clean into the next hop.
const PLAYER_SPIN_SPEED = Math.PI * 2; // rad/s while ascending (1 turn/sec)
const PLAYER_SPIN_DECEL = Math.PI * 2.5; // rad/s² while descending
const TWO_PI = Math.PI * 2;

// Platforms
const PLATFORM_WIDTH = GAME_WIDTH * 0.08;
const PLATFORM_HEIGHT = GAME_HEIGHT * 0.015;
const PLATFORM_GAP = GAME_HEIGHT * 0.1;
const PLATFORM_DESPAWN_Y = GAME_HEIGHT * 0.6;
const PLATFORM_SPAWN_OFFSET = GAME_WIDTH * 0.1;
const MIN_PLATFORM_SPACING = GAME_WIDTH * 0.05;
const MAX_ATTEMPTS = 50;
const INITIAL_PLATFORM_COUNT = 6;

// Difficulty scales with climb height (score). Each tier raises the spawn
// chances of traps and unlocks new hazards, so the opening seconds are calm
// and the run grows steadily harder the higher the player climbs — but never
// tips into unwinnable, since specials still can't stack back-to-back and
// every platform keeps a chance of being safe.
//
// Score is climb height / 10, so each platform climbed (~PLATFORM_GAP) is
// worth ~7 points. Thresholds are stretched high because climb score ramps
// fast in practice — this keeps the calm opening and each unlock spread
// across a real stretch of play instead of all hitting in the first minute.
const SCORE_TIER_FRAGILE = 500;
const SCORE_TIER_SPIKE = 1200;
const SCORE_TIER_PLANE = 2500;
const SCORE_TIER_HARD = 4500;

// Per-tier spawn chances, rolled for every new platform after the safe
// initial floor (and only when the previous platform was normal, so two
// traps never spawn back-to-back). Higher tiers nudge the mix toward traps
// but cap well below 1.0 — safe platforms always stay possible.
const FRAGILE_CHANCE_BY_TIER = [0, 0.15, 0.3, 0.4, 0.5] as const;
const SPIKE_CHANCE_BY_TIER = [0, 0, 0.08, 0.12, 0.15] as const;

// Strategic placement offsets, measured from the last spawned platform's X.
// Spikes sit tight on the player's natural bounce path so a stationary
// player falls back onto them and must dodge sideways; fragile platforms
// sit a tempting hop away so they read as an easy stepping stone but break.
const SPIKE_BAIT_OFFSET = PLATFORM_WIDTH * 0.3;
const FRAGILE_BAIT_OFFSET = PLATFORM_WIDTH * 0.9;

// Spike strip geometry — triangles sitting on top of a spike platform.
const SPIKE_COUNT = 5;
const SPIKE_HEIGHT = PLATFORM_HEIGHT * 2;

// How far below the lowest remaining platform the player may fall before
// the run ends. The camera follows the player, so a screen-based check
// never triggers — death is measured against the platform floor in world
// coordinates.
const FALL_DEATH_MARGIN = GAME_HEIGHT * 0.25;

// Plane obstacle — flies horizontally across the screen at the player's
// altitude. Spawns on the side opposite the player so it crosses the whole
// field aimed at where they are, trapping them toward their own wall and
// forcing an altitude/timing dodge.
const PLANE_BODY_W = GAME_WIDTH * 0.05;
const PLANE_BODY_H = GAME_HEIGHT * 0.02;
const PLANE_WING_W = GAME_WIDTH * 0.07;
const PLANE_WING_H = GAME_HEIGHT * 0.035;
const PLANE_NOSE_LEN = GAME_WIDTH * 0.015;
const PLANE_NOSE_H = PLANE_BODY_H * 0.8;
const PLANE_SPEED = GAME_WIDTH * 0.55; // world units per second
// Spawn interval (seconds) by difficulty: calm early, tighter once planes
// are unlocked, tighter still at the hard tier where pairs appear.
const PLANE_SPAWN_MIN = 5;
const PLANE_SPAWN_MAX = 9;
const PLANE_SPAWN_MIN_HARD = 3;
const PLANE_SPAWN_MAX_HARD = 6;
// At the hard tier, this fraction of spawns sends a second plane from the
// opposite side, squeezing the player between two crossing threats.
const PLANE_DOUBLE_SPAWN_CHANCE = 0.5;
// Vertical separation between the two planes of a pair, so they don't
// visually overlap at the screen center but both stay in threat range.
const PLANE_PAIR_Y_OFFSET = PLANE_WING_H * 0.8;

// HUD score — fixed in the top-left of the viewport so it stays put while
// the camera follows the player upward.
const SCORE_TEXT_SIZE = GAME_HEIGHT * 0.05;
const SCORE_TEXT_MARGIN = GAME_WIDTH * 0.02;
const SCORE_COLOR = [255, 120, 220] as const;
const GAME_OVER_TEXT_SIZE = GAME_HEIGHT * 0.09;
const RESTART_TEXT_SIZE = GAME_HEIGHT * 0.04;
const GAME_OVER_COLOR = [255, 80, 120] as const;
const RESTART_COLOR = [255, 120, 220] as const;

// Colors
const PLATFORM_COLOR = [120, 200, 255] as const;
const FRAGILE_COLOR = [255, 170, 50] as const;
const CRACK_COLOR = [120, 70, 20] as const;
const SPIKE_BASE_COLOR = [90, 90, 100] as const;
const SPIKE_TIP_COLOR = [220, 60, 60] as const;
const PLANE_BODY_COLOR = [180, 60, 70] as const;
const PLANE_DETAIL_COLOR = [120, 40, 50] as const;

type PlatformKind = "normal" | "fragile" | "spike";

// Plain x/y pair — stored as class fields, not on the kaplay GameObj
// (TypeScript conflates custom Vec2 props with PosComp.pos).
type Point = { x: number; y: number };

type PlayerObj = GameObj<
  SpriteComp | PosComp | AnchorComp | AreaComp | RotateComp
>;
type PlatformObj = GameObj<
  RectComp | PosComp | AnchorComp | AreaComp | ColorComp
>;
// A plane is just a positioned container — its visuals are child objects.
type PlaneObj = GameObj<PosComp>;
type TextObj = GameObj<TextComp | PosComp | ColorComp | FixedComp>;

type PlatformState = {
  obj: PlatformObj;
  pos: Point;
  kind: PlatformKind;
  broken: boolean; // fragile platforms break after one bounce
};

type PlaneState = {
  obj: PlaneObj;
  x: number; // world X (center)
  y: number; // world Y (center)
  dir: 1 | -1; // travel direction
};

export class WhirlybirdGame extends BaseGame {
  readonly controls: GameControls = { joystick: true, press: false };
  private player: PlayerObj;
  private playerPos: Point = { x: 0, y: 0 };
  private velY = 0;
  private grounded = false;
  private rotation = 0; // radians; 0 = feet down
  private spinVel = 0; // rad/s; decelerates during descent
  private platforms: PlatformState[] = [];
  private highestY = 0; // highest world Y reached (smaller = higher)
  private cameraY = 0; // world Y offset: screenY = worldY - cameraY
  private targetScreenY = BOARD_HEIGHT * 0.5; // desired player screen Y (centered)
  private spawnTimer = 0;
  private nextPlatformY = 0;
  private prevWorldY = 0; // player world Y last frame, for swept collision
  private lastSpawnX = BOARD_WIDTH / 2; // X of the most recently spawned platform
  private lastSpawnKind: PlatformKind = "normal"; // guarantees a safe platform between traps
  private planes: PlaneState[] = [];
  private planeSpawnTimer = 0;
  private nextPlaneSpawn = PLANE_SPAWN_MIN;
  private scoreText!: TextObj;
  private gameOverTexts: TextObj[] = [];

  constructor(canvas: HTMLCanvasElement, onGameOver?: GameOverHandler) {
    super(canvas, onGameOver);
    const k = this._k;

    k.loadSprite("character", characterSprite);

    this.player = k.add([
      k.sprite("character", { height: PLAYER_RADIUS * 2 }),
      k.anchor("center"),
      k.area(),
      k.rotate(0),
    ]) as PlayerObj;

    // HUD score, pinned to the viewport top-left (fixed() ignores camera).
    this.scoreText = k.add([
      k.text("0", { size: SCORE_TEXT_SIZE }),
      k.pos(SCORE_TEXT_MARGIN, SCORE_TEXT_MARGIN),
      k.color(...SCORE_COLOR),
      k.fixed(),
    ]) as TextObj;

    // Create initial platforms
    this.nextPlatformY = BOARD_HEIGHT - PLATFORM_GAP;
    for (let i = 0; i < 6; i++) {
      this.spawnPlatform();
    }

    // Start the player on the first platform (bottommost), resting on its
    // top surface so the swept-collision baseline is above the platform.
    if (this.platforms.length > 0) {
      const firstPlatform = this.platforms[0];
      this.playerPos = {
        x: firstPlatform.pos.x,
        y: firstPlatform.pos.y - PLATFORM_HEIGHT / 2 - PLAYER_RADIUS,
      };
      this.grounded = true;
    }

    // Initialize swept-collision baseline
    this.prevWorldY = this.playerPos.y;
    // Score baseline = current climb, so the opening reads as tier 0 (calm)
    // instead of leaking the field default of 0 (which would read as ~72).
    this.highestY = this.playerPos.y;

    // Initial camera offset so player appears at targetScreenY
    this.updateCamera();
  }

  private updateCamera() {
    this.cameraY = this.playerPos.y - this.targetScreenY;
    // Apply camera offset to player and platforms
    this.player.pos = this._k.vec2(
      this.playerPos.x,
      this.playerPos.y - this.cameraY,
    );
    // kaplay's angle is in degrees; rotation is tracked in radians.
    this.player.angle = (this.rotation * 180) / Math.PI;
    for (const platform of this.platforms) {
      platform.obj.pos = this._k.vec2(
        platform.pos.x,
        platform.pos.y - this.cameraY,
      );
    }
    for (const plane of this.planes) {
      plane.obj.pos = this._k.vec2(plane.x, plane.y - this.cameraY);
    }
  }

  protected moveLeft() {
    this.playerPos.x = Math.max(
      PLAYER_RADIUS,
      this.playerPos.x - PLAYER_MOVE_SPEED * this._k.dt(),
    );
  }

  protected moveRight() {
    this.playerPos.x = Math.min(
      BOARD_WIDTH - PLAYER_RADIUS,
      this.playerPos.x + PLAYER_MOVE_SPEED * this._k.dt(),
    );
  }

  protected press() {
    // No action — whirlybird auto-bounces on platforms; movement is A/D only.
  }

  restart() {
    super.restart();
    // Clear all platforms
    for (const platform of this.platforms) {
      this._k.destroy(platform.obj);
    }
    this.platforms = [];
    // Clear any planes in flight
    for (const plane of this.planes) {
      this._k.destroy(plane.obj);
    }
    this.planes = [];
    // Clear any game-over overlay text from the previous run.
    for (const t of this.gameOverTexts) {
      this._k.destroy(t);
    }
    this.gameOverTexts = [];
    this.highestY = BOARD_HEIGHT * 0.7; // start high
    this.cameraY = 0;
    this.spawnTimer = 0;
    this.nextPlatformY = BOARD_HEIGHT - PLATFORM_GAP;
    this.lastSpawnX = BOARD_WIDTH / 2;
    this.lastSpawnKind = "normal";
    this.planeSpawnTimer = 0;
    this.nextPlaneSpawn = PLANE_SPAWN_MIN;

    // Reset player world position
    this.playerPos = { x: BOARD_WIDTH / 2, y: BOARD_HEIGHT * 0.7 };
    this.velY = 0;
    this.grounded = false;
    this.rotation = 0;
    this.spinVel = 0;
    this.player.angle = 0;

    // Rebuild initial platforms
    for (let i = 0; i < 6; i++) {
      this.spawnPlatform();
    }

    // Place player on first platform, resting on its top surface
    if (this.platforms.length > 0) {
      const firstPlatform = this.platforms[0];
      this.playerPos = {
        x: firstPlatform.pos.x,
        y: firstPlatform.pos.y - PLATFORM_HEIGHT / 2 - PLAYER_RADIUS,
      };
      this.grounded = true;
      this.velY = 0;
    }

    this.highestY = this.playerPos.y;
    this.prevWorldY = this.playerPos.y;
    this.scoreText.text = String(this.calculateScore());
    this.updateCamera();
  }

  // Score is based on how high the player has climbed (lower world Y = higher)
  calculateScore() {
    return Math.floor((BOARD_HEIGHT - this.highestY) / 10);
  }

  /**
   * Current difficulty tier (0..4), driven by score so the opening is calm
   * and hazards unlock as the player climbs. Used to gate both trap and plane
   * spawning.
   */
  private difficultyTier(): number {
    const score = this.calculateScore();
    if (score >= SCORE_TIER_HARD) return 4;
    if (score >= SCORE_TIER_PLANE) return 3;
    if (score >= SCORE_TIER_SPIKE) return 2;
    if (score >= SCORE_TIER_FRAGILE) return 1;
    return 0;
  }

  /**
   * Show the game-over overlay, pinned to the viewport center (fixed()
   * ignores the camera). Called after endGame() so the final score is
   * already locked in. Two lines: a title and a restart hint.
   */
  private showGameOver(): void {
    const k = this._k;
    const cx = BOARD_WIDTH / 2;
    const cy = BOARD_HEIGHT / 2;
    this.gameOverTexts.push(
      k.add([
        k.text("GAME OVER", { size: GAME_OVER_TEXT_SIZE }),
        k.pos(cx, cy - GAME_OVER_TEXT_SIZE),
        k.anchor("center"),
        k.color(...GAME_OVER_COLOR),
        k.fixed(),
      ]) as TextObj,
      k.add([
        k.text("Press R to restart", { size: RESTART_TEXT_SIZE }),
        k.pos(cx, cy + RESTART_TEXT_SIZE),
        k.anchor("center"),
        k.color(...RESTART_COLOR),
        k.fixed(),
      ]) as TextObj,
    );
  }

  protected update() {
    const k = this._k;

    // Apply gravity if not grounded
    if (!this.grounded) {
      this.velY += PLAYER_GRAVITY * k.dt();
    }

    // Integrate velocity to get new world position
    this.playerPos.y += this.velY * k.dt();

    // Spin: full speed while ascending, decelerating while falling. The
    // snap on landing (above) guarantees an upright finish each hop.
    if (!this.grounded) {
      if (this.velY >= 0) {
        this.spinVel = Math.max(0, this.spinVel - PLAYER_SPIN_DECEL * k.dt());
      }
      this.rotation += this.spinVel * k.dt();
    }

    // Keep player within horizontal bounds (world)
    this.playerPos.x = Math.max(
      PLAYER_RADIUS,
      Math.min(BOARD_WIDTH - PLAYER_RADIUS, this.playerPos.x),
    );

    // Track highest point reached (smallest y)
    if (this.playerPos.y < this.highestY) {
      this.highestY = this.playerPos.y;
    }

    // Reflect the current climb score in the HUD.
    this.scoreText.text = String(this.calculateScore());

    // Platform collision (using world positions). Swept check: if the
    // player's bottom crossed the platform's top surface this frame while
    // moving down, they land — this prevents tunneling through thin
    // platforms at high fall speed (platforms stay solid every bounce).
    this.grounded = false;
    const prevBottom = this.prevWorldY + PLAYER_RADIUS;
    const currBottom = this.playerPos.y + PLAYER_RADIUS;
    for (const platform of this.platforms) {
      const withinX =
        this.playerPos.x >= platform.pos.x - PLATFORM_WIDTH / 2 &&
        this.playerPos.x <= platform.pos.x + PLATFORM_WIDTH / 2;

      const platformTop = platform.pos.y - PLATFORM_HEIGHT / 2;
      if (
        withinX &&
        this.velY >= 0 &&
        prevBottom <= platformTop &&
        currBottom >= platformTop
      ) {
        if (platform.kind === "spike") {
          // Spikes kill on contact — no bounce.
          this.endGame();
          this.showGameOver();
          break;
        }
        // Snap to top of platform
        this.playerPos.y = platformTop - PLAYER_RADIUS;
        this.velY = -PLAYER_JUMP_SPEED; // bounce up
        this.grounded = true;
        // Land on feet (snap to nearest upright angle), then spin up for
        // the next hop.
        this.rotation = Math.round(this.rotation / TWO_PI) * TWO_PI;
        this.spinVel = PLAYER_SPIN_SPEED;
        if (platform.kind === "fragile") {
          // Breaks after the first bounce.
          platform.broken = true;
        }
        break;
      }
    }

    // Remove platforms broken this frame (fragile) or far below the player.
    for (let i = this.platforms.length - 1; i >= 0; i--) {
      const platform = this.platforms[i];
      if (
        platform.broken ||
        platform.pos.y > this.playerPos.y + PLATFORM_DESPAWN_Y
      ) {
        k.destroy(platform.obj);
        this.platforms.splice(i, 1);
      }
    }
    this.prevWorldY = this.playerPos.y;

    // Spawn new platforms as the player climbs (world coords)
    this.spawnTimer += k.dt();
    if (this.spawnTimer > 0.1) {
      this.spawnTimer = 0;
      while (this.nextPlatformY > this.playerPos.y - PLATFORM_DESPAWN_Y) {
        this.spawnPlatform();
      }
    }

    // Move planes and check collisions. AABB overlap between the plane's
    // bounds (wing extent) and the player's circle bounding box.
    for (let i = this.planes.length - 1; i >= 0; i--) {
      const plane = this.planes[i];
      plane.x += plane.dir * PLANE_SPEED * k.dt();
      const offScreen =
        plane.dir > 0
          ? plane.x > BOARD_WIDTH + PLANE_WING_W
          : plane.x < -PLANE_WING_W;
      if (offScreen) {
        k.destroy(plane.obj);
        this.planes.splice(i, 1);
        continue;
      }
      const dx = Math.abs(this.playerPos.x - plane.x);
      const dy = Math.abs(this.playerPos.y - plane.y);
      if (
        dx < PLANE_WING_W / 2 + PLAYER_RADIUS &&
        dy < PLANE_WING_H / 2 + PLAYER_RADIUS
      ) {
        this.endGame();
        this.showGameOver();
      }
    }

    // Plane spawn timer — only ticks once the player has climbed far enough
    // (tier 3+) to keep the opening calm. At the hard tier (4) planes spawn
    // more frequently and sometimes in pairs from opposite sides.
    const tier = this.difficultyTier();
    if (tier >= 3) {
      this.planeSpawnTimer += k.dt();
      if (this.planeSpawnTimer >= this.nextPlaneSpawn) {
        this.planeSpawnTimer = 0;
        const hard = tier >= 4;
        const min = hard ? PLANE_SPAWN_MIN_HARD : PLANE_SPAWN_MIN;
        const max = hard ? PLANE_SPAWN_MAX_HARD : PLANE_SPAWN_MAX;
        this.nextPlaneSpawn = min + Math.random() * (max - min);
        const dir = this.spawnPlane();
        if (hard && Math.random() < PLANE_DOUBLE_SPAWN_CHANCE) {
          this.spawnPlane(dir === 1 ? -1 : 1, PLANE_PAIR_Y_OFFSET);
        }
      }
    }

    // Update camera and render positions
    this.updateCamera();

    // Falling below the lowest remaining platform ends the run. The camera
    // tracks the player, so we measure against the platform floor, not the
    // screen edge.
    let lowestPlatformY = -Infinity;
    for (const platform of this.platforms) {
      if (platform.pos.y > lowestPlatformY) {
        lowestPlatformY = platform.pos.y;
      }
    }
    if (
      lowestPlatformY !== -Infinity &&
      this.playerPos.y > lowestPlatformY + FALL_DEATH_MARGIN
    ) {
      this.endGame();
      this.showGameOver();
    }
  }

  private spawnPlatform() {
    const k = this._k;

    // Decide kind first — initial platforms are always normal so the player
    // never spawns onto a trap. Specials also can't follow another special:
    // forcing a normal platform between traps guarantees the player always
    // has reachable safe ground instead of a stack of spikes/fragile.
    // Specials are further gated by difficulty tier so the opening stays
    // calm: fragile platforms appear from tier 1, spikes from tier 2.
    let kind: PlatformKind = "normal";
    if (
      this.platforms.length >= INITIAL_PLATFORM_COUNT &&
      this.lastSpawnKind === "normal"
    ) {
      const tier = this.difficultyTier();
      const fragileChance = FRAGILE_CHANCE_BY_TIER[tier];
      const spikeChance = SPIKE_CHANCE_BY_TIER[tier];
      const roll = Math.random();
      if (roll < spikeChance) kind = "spike";
      else if (roll < spikeChance + fragileChance) kind = "fragile";
    }
    this.lastSpawnKind = kind;

    const x = this.pickSpawnX(kind);

    const color =
      kind === "fragile"
        ? FRAGILE_COLOR
        : kind === "spike"
          ? SPIKE_BASE_COLOR
          : PLATFORM_COLOR;

    const obj = k.add([
      k.rect(PLATFORM_WIDTH, PLATFORM_HEIGHT),
      k.anchor("center"),
      k.color(color[0], color[1], color[2]),
      k.area(),
    ]) as PlatformObj;

    if (kind === "fragile") {
      // Crack across the middle to signal it'll break.
      obj.add([
        k.rect(PLATFORM_WIDTH * 0.6, PLATFORM_HEIGHT * 0.25),
        k.anchor("center"),
        k.color(CRACK_COLOR[0], CRACK_COLOR[1], CRACK_COLOR[2]),
      ]);
    }

    if (kind === "spike") {
      // Row of triangle spikes on the platform's top edge. Each is its own
      // 3-point polygon child (convex) so kaplay doesn't need to triangulate
      // a concave shape, which would throw and stall spawning.
      const spikeW = PLATFORM_WIDTH / SPIKE_COUNT;
      for (let i = 0; i < SPIKE_COUNT; i++) {
        const cx = -PLATFORM_WIDTH / 2 + (i + 0.5) * spikeW;
        obj.add([
          k.polygon([
            k.vec2(cx - spikeW / 2, 0),
            k.vec2(cx + spikeW / 2, 0),
            k.vec2(cx, -SPIKE_HEIGHT),
          ]),
          k.pos(0, -PLATFORM_HEIGHT / 2),
          k.color(SPIKE_TIP_COLOR[0], SPIKE_TIP_COLOR[1], SPIKE_TIP_COLOR[2]),
        ]);
      }
    }

    // Store world position separately; pos is updated each frame via camera
    this.platforms.push({
      obj,
      pos: { x, y: this.nextPlatformY },
      kind,
      broken: false,
    });
    this.lastSpawnX = x;
    this.nextPlatformY -= PLATFORM_GAP;
  }

  /**
   * Pick the X for a new platform. Normal platforms scatter randomly (with a
   * spacing guard so adjacent platforms don't overlap). Special platforms are
   * placed to bait the player along their natural bounce trajectory:
   *
   *  - spike: tight on the last platform's X, so a player who bounces
   *    straight up and comes back down lands on the spikes — they must
   *    dodge sideways to survive.
   *  - fragile: a tempting hop away from the last platform — reads as an
   *    easy stepping stone but breaks after one bounce.
   */
  private pickSpawnX(kind: PlatformKind): number {
    const k = this._k;
    const min = PLATFORM_WIDTH / 2 + PLATFORM_SPAWN_OFFSET;
    const max = BOARD_WIDTH - PLATFORM_WIDTH / 2 - PLATFORM_SPAWN_OFFSET;
    const clamp = (v: number) => Math.max(min, Math.min(max, v));

    if (kind === "normal") {
      let attempts = 0;
      let x: number;
      do {
        x = k.rand(min, max);
        attempts++;
      } while (
        attempts < MAX_ATTEMPTS &&
        this.platforms.some(
          (p) =>
            p.pos.y > this.nextPlatformY - PLATFORM_GAP * 1.5 &&
            p.pos.y < this.nextPlatformY + PLATFORM_GAP * 1.5 &&
            Math.abs(p.pos.x - x) < MIN_PLATFORM_SPACING,
        )
      );
      return x;
    }

    const offset =
      kind === "spike"
        ? k.rand(-SPIKE_BAIT_OFFSET, SPIKE_BAIT_OFFSET)
        : k.rand(-FRAGILE_BAIT_OFFSET, FRAGILE_BAIT_OFFSET);
    return clamp(this.lastSpawnX + offset);
  }

  /**
   * Spawn a plane that flies across the screen aimed at the player. It
   * enters from the side opposite the player and flies at the player's
   * current altitude, so the trajectory crosses the player's position —
   * trapping them toward their own wall and forcing a dodge (move out of
   * the plane's altitude band or break horizontally past it).
   *
   * `forceDir` overrides the auto-picked travel direction (used for the
   * second plane of a hard-tier pair, so it squeezes from the opposite
   * side). `yOffset` nudges its altitude so paired planes don't overlap
   * at the screen center while both stay in threat range.
   * Returns the direction the plane actually flew.
   */
  private spawnPlane(forceDir?: 1 | -1, yOffset = 0): 1 | -1 {
    const k = this._k;
    // dir = travel direction. Player on the left => plane flies leftward
    // (comes from the right edge), and vice versa, so it crosses the field
    // toward the player's side.
    const dir: 1 | -1 =
      forceDir ?? (this.playerPos.x < BOARD_WIDTH / 2 ? -1 : 1);
    const startX = dir > 0 ? -PLANE_WING_W : BOARD_WIDTH + PLANE_WING_W;
    const y = this.playerPos.y + yOffset;
    const screenY = y - this.cameraY;

    const obj = k.add([k.pos(startX, screenY)]) as PlaneObj;

    // Wings sit beneath the body (wider, shorter).
    obj.add([
      k.rect(PLANE_WING_W, PLANE_WING_H),
      k.anchor("center"),
      k.color(
        PLANE_DETAIL_COLOR[0],
        PLANE_DETAIL_COLOR[1],
        PLANE_DETAIL_COLOR[2],
      ),
    ]);
    // Fuselage.
    obj.add([
      k.rect(PLANE_BODY_W, PLANE_BODY_H),
      k.anchor("center"),
      k.color(PLANE_BODY_COLOR[0], PLANE_BODY_COLOR[1], PLANE_BODY_COLOR[2]),
    ]);
    // Nose triangle pointing in the travel direction (convex, 3 points —
    // no triangulation needed).
    const noseBase = dir * (PLANE_BODY_W / 2);
    const noseTip = dir * (PLANE_BODY_W / 2 + PLANE_NOSE_LEN);
    obj.add([
      k.polygon([
        k.vec2(noseTip, 0),
        k.vec2(noseBase, -PLANE_NOSE_H / 2),
        k.vec2(noseBase, PLANE_NOSE_H / 2),
      ]),
      k.color(PLANE_BODY_COLOR[0], PLANE_BODY_COLOR[1], PLANE_BODY_COLOR[2]),
    ]);

    this.planes.push({ obj, x: startX, y, dir });
    return dir;
  }
}
