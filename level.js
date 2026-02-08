/*
Level.js

A Level represents ONE maze grid loaded from levels.json. 

Tile legend (from your original example): 
0 = floor
1 = wall
2 = start
3 = goal

Responsibilities:
- Store the grid
- Find the start tile
- Provide collision/meaning queries (isWall, isGoal, inBounds)
- Draw the tiles (including a goal highlight)
*/

class Level {
  /*
  MovingObstacle (inner class)
  - created when parsing 'M' symbols in the level grid
  - moves vertically between minRow and maxRow (pixel bounds computed)
  - reverses direction at bounds
  */
  static MovingObstacle = class {
    constructor(col, row, minRow, maxRow, ts, speed = 1.8) {
      this.col = col; // column index in grid
      this.row = row; // initial row index in grid (used to reset)
      this.minRow = minRow; // inclusive min row index
      this.maxRow = maxRow; // inclusive max row index
      this.ts = ts;
      this.speed = speed;

      // pixel center y position
      this.y = row * ts + ts / 2;
      this.x = col * ts + ts / 2;
      this.dir = 1; // 1 = down, -1 = up
      this.w = ts * 0.8;
      this.h = ts * 0.8;
      this.minY = minRow * ts + ts / 2;
      this.maxY = maxRow * ts + ts / 2;
    }

    update() {
      // Move and reverse at bounds
      this.y += this.speed * this.dir;
      if (this.y >= this.maxY) {
        this.y = this.maxY;
        this.dir = -1;
      } else if (this.y <= this.minY) {
        this.y = this.minY;
        this.dir = 1;
      }
    }

    draw() {
      push();
      fill(220, 50, 50);
      noStroke();
      rectMode(CENTER);
      rect(this.x, this.y, this.w, this.h, 4);
      pop();
    }

    reset() {
      this.y = this.row * this.ts + this.ts / 2;
      this.dir = 1;
    }

    // returns axis-aligned rectangle bounds {left, top, right, bottom}
    bounds() {
      const left = this.x - this.w / 2;
      const right = this.x + this.w / 2;
      const top = this.y - this.h / 2;
      const bottom = this.y + this.h / 2;
      return { left, top, right, bottom };
    }
  };

  constructor(grid, tileSize) {
    // Store the tile grid and tile size (pixels per tile).
    // Make a shallow copy of rows so we can normalize characters to floor
    this.grid = grid.map((r) => r.slice());
    this.ts = tileSize;

    // Obstacles generated from 'M' symbols
    this.obstacles = [];

    // Start position in grid coordinates (row/col).
    // We compute this by scanning for tile value 2 and 'M' symbols.
    this.start = null;

    // Parse grid: find start (2), goal (3), walls (1), and 'M' obstacles.
    for (let r = 0; r < this.rows(); r++) {
      for (let c = 0; c < this.cols(); c++) {
        const v = this.grid[r][c];
        // Start tile
        if (v === 2) {
          this.start = { r, c };
          // normalize spawn tile to floor so drawing is consistent
          this.grid[r][c] = 0;
        }

        // Moving obstacle symbol 'M' (string). We turn the grid tile into floor
        // and create a MovingObstacle whose vertical bounds are the contiguous
        // floor cells above and below until a wall (1) or grid edge.
        if (v === "M" || v === "M") {
          // compute minRow (scan upward) and maxRow (scan downward)
          let minRow = r;
          while (minRow - 1 >= 0 && this.grid[minRow - 1][c] !== 1) minRow--;
          let maxRow = r;
          while (maxRow + 1 < this.rows() && this.grid[maxRow + 1][c] !== 1)
            maxRow++;

          // create obstacle and replace grid cell with floor
          const Obs = Level.MovingObstacle;
          this.obstacles.push(new Obs(c, r, minRow, maxRow, this.ts));
          this.grid[r][c] = 0; // obstacle sits on floor
        }
      }
    }
  }

  // ----- Size helpers -----

  rows() {
    return this.grid.length;
  }

  cols() {
    return this.grid[0].length;
  }

  pixelWidth() {
    return this.cols() * this.ts;
  }

  pixelHeight() {
    return this.rows() * this.ts;
  }

  // ----- Semantic helpers -----

  inBounds(r, c) {
    return r >= 0 && c >= 0 && r < this.rows() && c < this.cols();
  }

  tileAt(r, c) {
    // Caller should check inBounds first.
    return this.grid[r][c];
  }

  isWall(r, c) {
    return this.tileAt(r, c) === 1;
  }

  isGoal(r, c) {
    return this.tileAt(r, c) === 3;
  }

  // Update obstacles each frame
  updateObstacles() {
    for (let o of this.obstacles) o.update();
  }

  // Reset obstacles to their initial positions (used when restarting a level)
  resetObstacles() {
    for (let o of this.obstacles) o.reset();
  }

  // Check rectangle-based collision between player and any obstacle
  // playerRect is {left, top, right, bottom}
  checkObstacleCollision(playerRect) {
    for (let o of this.obstacles) {
      const b = o.bounds();
      if (
        !(
          playerRect.right < b.left ||
          playerRect.left > b.right ||
          playerRect.bottom < b.top ||
          playerRect.top > b.bottom
        )
      ) {
        return true;
      }
    }
    return false;
  }

  // ----- Start-finding -----

  findStart() {
    // Scan entire grid to locate the tile value 2 (start).
    for (let r = 0; r < this.rows(); r++) {
      for (let c = 0; c < this.cols(); c++) {
        if (this.grid[r][c] === 2) {
          return { r, c };
        }
      }
    }

    // If a level forgets to include a start tile, return null.
    // (Then the game can choose a default spawn.)
    return null;
  }

  // ----- Drawing -----

  draw() {
    /*
    Draw each tile as a rectangle.

    Visual rules (matches your original logic): 
    - Walls (1): dark teal
    - Everything else: light floor
    - Goal tile (3): add a highlighted inset rectangle
    */
    for (let r = 0; r < this.rows(); r++) {
      for (let c = 0; c < this.cols(); c++) {
        const v = this.grid[r][c];

        // Base tile fill
        if (v === 1) fill(30, 50, 60);
        else fill(232);

        rect(c * this.ts, r * this.ts, this.ts, this.ts);

        // Goal highlight overlay (only on tile 3).
        if (v === 3) {
          noStroke();
          fill(255, 200, 120, 200);
          rect(c * this.ts + 4, r * this.ts + 4, this.ts - 8, this.ts - 8, 6);
        }
      }
    }

    // Draw moving obstacles on top of tiles
    for (let o of this.obstacles) {
      o.draw();
    }
  }
}
