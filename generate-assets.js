import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const DIRS = [
  'public/assets',
  'public/assets/sprites',
  'public/assets/tiles',
  'public/assets/props'
];

DIRS.forEach((d) => {
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
  }
});

// =========================================================================
// PIXEL ART ENGINE V6 - AUTHENTIC TRUYTIMDANCHU.SITE AESTHETICS & VNR202
// =========================================================================
class PixelCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.png = new PNG({ width, height });
    this.png.data.fill(0);
  }

  setPixel(x, y, r, g, b, a = 255) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (this.width * y + x) << 2;
    if (a < 255) {
      const prevA = this.png.data[idx + 3] / 255;
      const curA = a / 255;
      const outA = curA + prevA * (1 - curA);
      if (outA > 0) {
        this.png.data[idx] = Math.round((r * curA + this.png.data[idx] * prevA * (1 - curA)) / outA);
        this.png.data[idx + 1] = Math.round((g * curA + this.png.data[idx + 1] * prevA * (1 - curA)) / outA);
        this.png.data[idx + 2] = Math.round((b * curA + this.png.data[idx + 2] * prevA * (1 - curA)) / outA);
        this.png.data[idx + 3] = Math.round(outA * 255);
      }
    } else {
      this.png.data[idx] = r;
      this.png.data[idx + 1] = g;
      this.png.data[idx + 2] = b;
      this.png.data[idx + 3] = a;
    }
  }

  fillRect(x, y, w, h, [r, g, b, a = 255]) {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        this.setPixel(x + i, y + j, r, g, b, a);
      }
    }
  }

  fillEllipse(cx, cy, rx, ry, [r, g, b, a = 255]) {
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) {
          this.setPixel(cx + x, cy + y, r, g, b, a);
        }
      }
    }
  }

  drawBorder(x, y, w, h, [r, g, b, a = 255]) {
    this.fillRect(x, y, w, 1, [r, g, b, a]);
    this.fillRect(x, y + h - 1, w, 1, [r, g, b, a]);
    this.fillRect(x, y, 1, h, [r, g, b, a]);
    this.fillRect(x + w - 1, y, 1, h, [r, g, b, a]);
  }

  line(x0, y0, x1, y1, [r, g, b, a = 255]) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0, y = y0;
    while (true) {
      this.setPixel(x, y, r, g, b, a);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }

  drawStar(cx, cy, outerR, innerR, pointsCount = 5, [r, g, b, a = 255]) {
    const pts = [];
    let angle = -Math.PI / 2;
    const step = Math.PI / pointsCount;
    for (let i = 0; i < pointsCount * 2; i++) {
      const rad = i % 2 === 0 ? outerR : innerR;
      pts.push({
        x: cx + Math.cos(angle) * rad,
        y: cy + Math.sin(angle) * rad
      });
      angle += step;
    }
    this.fillPolygon(pts, [r, g, b, a]);
  }

  fillPolygon(points, [r, g, b, a = 255]) {
    if (points.length < 3) return;
    let minY = Infinity, maxY = -Infinity;
    points.forEach((pt) => {
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    });

    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const nodeX = [];
      let j = points.length - 1;
      for (let i = 0; i < points.length; i++) {
        if (
          (points[i].y < y && points[j].y >= y) ||
          (points[j].y < y && points[i].y >= y)
        ) {
          nodeX.push(
            Math.round(
              points[i].x +
                ((y - points[i].y) / (points[j].y - points[i].y)) *
                  (points[j].x - points[i].x)
            )
          );
        }
        j = i;
      }
      nodeX.sort((x1, x2) => x1 - x2);
      for (let k = 0; k < nodeX.length; k += 2) {
        if (nodeX[k + 1] !== undefined) {
          for (let x = nodeX[k]; x <= nodeX[k + 1]; x++) {
            this.setPixel(x, y, r, g, b, a);
          }
        }
      }
    }
  }

  addSilhouetteOutline(outlineColor = [22, 18, 26, 235]) {
    const orig = Buffer.from(this.png.data);
    const w = this.width;
    const h = this.height;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (w * y + x) << 2;
        if (orig[idx + 3] < 60) {
          let hasSolidNeighbor = false;
          const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const nIdx = (w * ny + nx) << 2;
              if (orig[nIdx + 3] > 140 && ny < h - 4) {
                hasSolidNeighbor = true;
                break;
              }
            }
          }
          if (hasSolidNeighbor) {
            this.setPixel(x, y, outlineColor[0], outlineColor[1], outlineColor[2], outlineColor[3]);
          }
        }
      }
    }
  }

  save(filePath) {
    const buffer = PNG.sync.write(this.png);
    fs.writeFileSync(filePath, buffer);
    console.log(`Generated: ${filePath}`);
  }
}

// =========================================================================
// 1. CHIBI SPRITE BUILDER (48x64 HD PIXEL ART WITH 100% TRUYTIMDANCHU DETAIL)
// =========================================================================
function createHDChibiSprite({
  hairStyle = 'spiky_wavy', // 'spiky_wavy', 'ponytail', 'scholar_slick', 'elder_curly', 'bun', 'youth_crop', 'short_bob'
  hairColors = {
    dark: [60, 38, 25],
    base: [115, 78, 52],
    highlight: [168, 122, 92],
    glint: [215, 170, 138]
  },
  skin = {
    base: [254, 228, 206],
    shadow: [242, 194, 162],
    blush: [246, 160, 148]
  },
  outfit = {
    jacketBase: [36, 122, 102],
    jacketShadow: [24, 85, 72],
    jacketTrim: [52, 160, 135],
    collar: [255, 255, 255],
    tie: null, // [r,g,b]
    buttons: [245, 195, 35],
    hasSkirt: false,
    skirtColor: [40, 48, 65],
    skirtShadow: [25, 32, 45],
    pants: [52, 60, 72],
    pantsShadow: [36, 42, 52],
    socks: [245, 245, 250],
    shoes: [32, 30, 38],
    shoesHighlight: [68, 64, 75]
  },
  accessories = {
    hasGlasses: false,
    glassesColor: [60, 60, 70],
    hasBeard: false,
    beardColor: [240, 240, 245],
    hasHat: false,
    hatType: null, // 'beret_star', 'newsboy', 'fedora', 'ethnic_beret'
    accessoryItem: null, // 'red_armband', 'document_scroll', 'newspaper', 'red_book', 'satchel', 'scarf', 'ponytail_ribbon'
    hairRibbonColor: [220, 38, 38]
  },
  direction = 'down',
  walkFrame = 0
}) {
  const c = new PixelCanvas(48, 64);
  const isWalking = walkFrame > 0;

  // 1. CHUYỂN ĐỘNG CƠ THỂ TỰ NHIÊN (NHÚN NGƯỜI & NGHIÊNG VỀ TRƯỚC)
  // - Nhún người 1px xuống khi đặt chân tiếp đất (step impact bobbing)
  const bobY = isWalking ? 1 : 0;
  // - Nghiêng nhẹ 1px về hướng di chuyển khi bước ngang để tạo lực quán tính
  const leanX = isWalking ? (direction === 'left' ? -1 : (direction === 'right' ? 1 : 0)) : 0;
  const cx = 24 + leanX;

  // 2. BÓNG ĐỔ DƯỚI CHÂN (GROUND SHADOW)
  if (isWalking && (direction === 'left' || direction === 'right')) {
    c.fillEllipse(cx - (direction === 'left' ? 2 : -2), 60, 15, 5, [0, 0, 0, 75]);
  } else {
    c.fillEllipse(cx, 60, 14, 5, [0, 0, 0, 75]);
  }
  c.fillEllipse(cx, 60, 10, 3, [0, 0, 0, 110]);

  // 3. CHÂN & BƯỚC ĐI (WALKING STRIDE & LEGS)
  if (outfit.hasSkirt) {
    // Váy ngắn nữ sinh (Phương, Lan,...)
    const skirtX = cx - 10 + (direction === 'left' ? -1 : (direction === 'right' ? 1 : 0));
    const skirtY = 46 + bobY;
    c.fillRect(skirtX, skirtY, 20, 6, outfit.skirtColor);
    c.fillRect(skirtX, skirtY + 5, 20, 2, outfit.skirtShadow);
    // Xếp ly váy
    for (let sx = skirtX + 2; sx <= skirtX + 18; sx += 4) {
      c.fillRect(sx, skirtY + 1, 1, 5, outfit.skirtShadow);
    }

    if (direction === 'down' || direction === 'up') {
      let lLegY = 51 + bobY;
      let rLegY = 51 + bobY;
      let lShoeY = 57 + bobY;
      let rShoeY = 57 + bobY;
      if (walkFrame === 1) {
        lShoeY += 1;
        rLegY -= 2;
        rShoeY -= 2;
      } else if (walkFrame === 2) {
        rShoeY += 1;
        lLegY -= 2;
        lShoeY -= 2;
      }
      // Vớ trắng / Chân
      c.fillRect(cx - 7, lLegY, 5, 7, outfit.socks);
      c.fillRect(cx + 2, rLegY, 5, 7, outfit.socks);
      // Giày búp bê đáng yêu
      c.fillRect(cx - 8, lShoeY, 6, 4, outfit.shoes);
      c.fillRect(cx - 7, lShoeY, 4, 1, outfit.shoesHighlight);
      c.fillRect(cx + 2, rShoeY, 6, 4, outfit.shoes);
      c.fillRect(cx + 3, rShoeY, 4, 1, outfit.shoesHighlight);
    } else if (direction === 'left') {
      if (walkFrame === 1) {
        // Chân gần bước tới trước
        c.fillRect(cx - 9, 51, 5, 7, outfit.socks);
        c.fillRect(cx - 10, 57, 7, 4, outfit.shoes);
        c.fillRect(cx - 9, 57, 5, 1, outfit.shoesHighlight);
        // Chân xa nhấc về sau
        c.fillRect(cx + 2, 49, 4, 6, [210, 210, 215]);
        c.fillRect(cx + 2, 54, 5, 4, outfit.shoes);
      } else if (walkFrame === 2) {
        // Chân gần co về sau
        c.fillRect(cx - 3, 49, 5, 6, outfit.socks);
        c.fillRect(cx - 3, 54, 6, 4, outfit.shoes);
        // Chân xa bước tới trước
        c.fillRect(cx - 7, 51, 4, 7, [210, 210, 215]);
        c.fillRect(cx - 9, 57, 6, 4, outfit.shoes);
      } else {
        c.fillRect(cx - 6, 51 + bobY, 5, 7, outfit.socks);
        c.fillRect(cx - 8, 57 + bobY, 7, 4, outfit.shoes);
        c.fillRect(cx - 7, 57 + bobY, 5, 1, outfit.shoesHighlight);
        c.fillRect(cx, 51 + bobY, 4, 7, [210, 210, 215]);
        c.fillRect(cx - 1, 57 + bobY, 5, 4, outfit.shoes);
      }
    } else if (direction === 'right') {
      if (walkFrame === 1) {
        c.fillRect(cx + 4, 51, 5, 7, outfit.socks);
        c.fillRect(cx + 3, 57, 7, 4, outfit.shoes);
        c.fillRect(cx + 4, 57, 5, 1, outfit.shoesHighlight);
        c.fillRect(cx - 6, 49, 4, 6, [210, 210, 215]);
        c.fillRect(cx - 7, 54, 5, 4, outfit.shoes);
      } else if (walkFrame === 2) {
        c.fillRect(cx - 2, 49, 5, 6, outfit.socks);
        c.fillRect(cx - 3, 54, 6, 4, outfit.shoes);
        c.fillRect(cx + 3, 51, 4, 7, [210, 210, 215]);
        c.fillRect(cx + 3, 57, 6, 4, outfit.shoes);
      } else {
        c.fillRect(cx + 1, 51 + bobY, 5, 7, outfit.socks);
        c.fillRect(cx + 1, 57 + bobY, 7, 4, outfit.shoes);
        c.fillRect(cx + 2, 57 + bobY, 5, 1, outfit.shoesHighlight);
        c.fillRect(cx - 4, 51 + bobY, 4, 7, [210, 210, 215]);
        c.fillRect(cx - 4, 57 + bobY, 5, 4, outfit.shoes);
      }
    }
  } else {
    // Quần dài (Pants)
    if (direction === 'down' || direction === 'up') {
      let lLegY = 49 + bobY;
      let rLegY = 49 + bobY;
      let lShoeY = 57 + bobY;
      let rShoeY = 57 + bobY;
      let lShoeW = 7;
      let rShoeW = 7;

      if (walkFrame === 1) {
        // Chân trái bước dậm xuống, chân phải nhấc gót
        lLegY = 50;
        lShoeY = 58;
        lShoeW = 8;
        rLegY = 47;
        rShoeY = 54;
        rShoeW = 6;
      } else if (walkFrame === 2) {
        // Chân phải bước dậm xuống, chân trái nhấc gót
        rLegY = 50;
        rShoeY = 58;
        rShoeW = 8;
        lLegY = 47;
        lShoeY = 54;
        lShoeW = 6;
      }

      // Ống quần trái
      c.fillRect(cx - 8, lLegY, 6, 9, outfit.pants);
      c.fillRect(cx - 8, lLegY, 1, 9, outfit.pantsShadow);
      c.fillRect(cx - 8, lLegY + 8, 6, 1, outfit.pantsShadow);
      // Ống quần phải
      c.fillRect(cx + 2, rLegY, 6, 9, outfit.pants);
      c.fillRect(cx + 7, rLegY, 1, 9, outfit.pantsShadow);
      c.fillRect(cx + 2, rLegY + 8, 6, 1, outfit.pantsShadow);

      // Giày tây / Loafers
      c.fillRect(cx - 9, lShoeY, lShoeW, 4, outfit.shoes);
      c.fillRect(cx - 8, lShoeY, lShoeW - 2, 1, outfit.shoesHighlight);
      if (walkFrame === 1) c.fillRect(cx - 9, lShoeY + 3, lShoeW, 1, [15, 15, 20]);

      c.fillRect(cx + 2, rShoeY, rShoeW, 4, outfit.shoes);
      c.fillRect(cx + 3, rShoeY, rShoeW - 2, 1, outfit.shoesHighlight);
      if (walkFrame === 2) c.fillRect(cx + 2, rShoeY + 3, rShoeW, 1, [15, 15, 20]);
    } else if (direction === 'left') {
      // 2 CHÂN RÕ RỆT KHI ĐI NGANG SANG TRÁI (KHÔNG CÒN 1 CỤC NHỰA)
      if (walkFrame === 1) {
        // Chân trước sải dài về bên trái
        c.fillRect(cx - 10, 49, 6, 9, outfit.pants);
        c.fillRect(cx - 10, 49, 1, 9, outfit.pantsShadow);
        c.fillRect(cx - 12, 57, 9, 4, outfit.shoes);
        c.fillRect(cx - 11, 57, 7, 1, outfit.shoesHighlight);

        // Chân sau co lại đẩy đất ở bên phải
        c.fillRect(cx + 2, 47, 5, 8, outfit.pantsShadow);
        c.fillRect(cx + 3, 54, 5, 4, outfit.shoes);
      } else if (walkFrame === 2) {
        // Chân trước co về sau
        c.fillRect(cx - 2, 47, 5, 8, outfit.pants);
        c.fillRect(cx - 2, 54, 5, 4, outfit.shoes);

        // Chân sau sải vượt tới trước
        c.fillRect(cx - 8, 49, 6, 9, outfit.pantsShadow);
        c.fillRect(cx - 10, 57, 8, 4, outfit.shoes);
        c.fillRect(cx - 9, 57, 6, 1, outfit.shoesHighlight);
      } else {
        // Đứng nghiêng tự nhiên (2 chân đan xen có chiều sâu)
        c.fillRect(cx, 49 + bobY, 5, 9, outfit.pantsShadow);
        c.fillRect(cx - 1, 57 + bobY, 6, 4, outfit.shoes);

        c.fillRect(cx - 6, 49 + bobY, 6, 9, outfit.pants);
        c.fillRect(cx - 6, 49 + bobY, 1, 9, outfit.pantsShadow);
        c.fillRect(cx - 8, 57 + bobY, 8, 4, outfit.shoes);
        c.fillRect(cx - 7, 57 + bobY, 6, 1, outfit.shoesHighlight);
      }
    } else if (direction === 'right') {
      // 2 CHÂN RÕ RỆT KHI ĐI NGANG SANG PHẢI
      if (walkFrame === 1) {
        // Chân trước sải dài về bên phải
        c.fillRect(cx + 4, 49, 6, 9, outfit.pants);
        c.fillRect(cx + 9, 49, 1, 9, outfit.pantsShadow);
        c.fillRect(cx + 3, 57, 9, 4, outfit.shoes);
        c.fillRect(cx + 4, 57, 7, 1, outfit.shoesHighlight);

        // Chân sau đẩy đất ở bên trái
        c.fillRect(cx - 7, 47, 5, 8, outfit.pantsShadow);
        c.fillRect(cx - 8, 54, 5, 4, outfit.shoes);
      } else if (walkFrame === 2) {
        // Chân trước co về
        c.fillRect(cx - 3, 47, 5, 8, outfit.pants);
        c.fillRect(cx - 3, 54, 5, 4, outfit.shoes);

        // Chân sau sải vượt tới trước
        c.fillRect(cx + 2, 49, 6, 9, outfit.pantsShadow);
        c.fillRect(cx + 2, 57, 8, 4, outfit.shoes);
        c.fillRect(cx + 3, 57, 6, 1, outfit.shoesHighlight);
      } else {
        c.fillRect(cx - 5, 49 + bobY, 5, 9, outfit.pantsShadow);
        c.fillRect(cx - 5, 57 + bobY, 6, 4, outfit.shoes);

        c.fillRect(cx, 49 + bobY, 6, 9, outfit.pants);
        c.fillRect(cx + 5, 49 + bobY, 1, 9, outfit.pantsShadow);
        c.fillRect(cx, 57 + bobY, 8, 4, outfit.shoes);
        c.fillRect(cx + 1, 57 + bobY, 6, 1, outfit.shoesHighlight);
      }
    }
  }

  // 4. THÂN ÁO (TORSO / BLAZER JACKET - PHOM DÁNG CĂNG TRẺ TRUNG)
  const torsoY = 33 + bobY;
  c.fillRect(cx - 11, torsoY, 22, 17, outfit.jacketBase);
  c.fillRect(cx - 11, torsoY + 15, 22, 2, outfit.jacketShadow);
  c.fillRect(cx - 11, torsoY, 2, 17, outfit.jacketShadow);
  c.fillRect(cx + 9, torsoY, 2, 17, outfit.jacketShadow);
  // Highlight nhẹ ở ngực áo tạo khối 3D mềm mại
  c.fillRect(cx - 6, torsoY + 3, 12, 1, outfit.jacketTrim || [Math.min(255, outfit.jacketBase[0] + 30), Math.min(255, outfit.jacketBase[1] + 30), Math.min(255, outfit.jacketBase[2] + 30)]);

  if (direction === 'down') {
    // Cổ áo sơ mi & V-neck
    c.fillRect(cx - 4, torsoY, 8, 5, outfit.collar);
    c.fillRect(cx - 1, torsoY + 4, 2, 3, [240, 240, 245]);

    if (outfit.tie) {
      c.fillRect(cx - 2, torsoY + 2, 4, 8, outfit.tie);
      c.fillRect(cx - 1, torsoY + 4, 2, 6, [Math.max(0, outfit.tie[0] - 35), Math.max(0, outfit.tie[1] - 35), Math.max(0, outfit.tie[2] - 35)]);
    } else {
      c.fillRect(cx - 1, torsoY + 5, 2, 9, outfit.jacketTrim);
    }

    if (outfit.buttons) {
      c.fillRect(cx - 1, torsoY + 7, 2, 2, outfit.buttons);
      c.fillRect(cx - 1, torsoY + 11, 2, 2, outfit.buttons);
    }

    // TAY ÁO & CÁNH TAY VUNG TỰ NHIÊN KHI BƯỚC ĐI
    let lArmY = torsoY + 1;
    let rArmY = torsoY + 1;
    let lArmH = 11;
    let rArmH = 11;
    let lArmX = cx - 14;
    let rArmX = cx + 10;

    if (walkFrame === 1) {
      // Tay trái kéo nhẹ về sau, tay phải vung về trước
      lArmY -= 2;
      lArmH = 10;
      rArmY += 1;
      rArmH = 13;
      rArmX += 1;
    } else if (walkFrame === 2) {
      // Tay trái vung về trước, tay phải kéo nhẹ về sau
      lArmY += 1;
      lArmH = 13;
      lArmX -= 1;
      rArmY -= 2;
      rArmH = 10;
    }

    // Tay trái
    c.fillRect(lArmX, lArmY, 4, lArmH, outfit.jacketBase);
    c.fillRect(lArmX, lArmY, 1, lArmH, outfit.jacketShadow);
    c.fillRect(lArmX, lArmY + lArmH, 4, 4, skin.base);
    c.setPixel(lArmX + 1, lArmY + lArmH + 1, skin.highlight ? skin.highlight[0] : 255, skin.highlight ? skin.highlight[1] : 235, skin.highlight ? skin.highlight[2] : 220);

    // Tay phải
    c.fillRect(rArmX, rArmY, 4, rArmH, outfit.jacketBase);
    c.fillRect(rArmX + 3, rArmY, 1, rArmH, outfit.jacketShadow);
    c.fillRect(rArmX, rArmY + rArmH, 4, 4, skin.base);
    c.setPixel(rArmX + 2, rArmY + rArmH + 1, skin.highlight ? skin.highlight[0] : 255, skin.highlight ? skin.highlight[1] : 235, skin.highlight ? skin.highlight[2] : 220);

    // Phụ kiện cầm tay
    if (accessories.accessoryItem === 'red_armband') {
      c.fillRect(lArmX, lArmY + 2, 4, 4, [220, 38, 38]);
      c.setPixel(lArmX + 1, lArmY + 3, 255, 215, 0);
      c.setPixel(lArmX + 2, lArmY + 4, 255, 215, 0);
    } else if (accessories.accessoryItem === 'document_scroll') {
      c.fillRect(rArmX, rArmY + 5, 6, 11, [248, 244, 228]);
      c.drawBorder(rArmX, rArmY + 5, 6, 11, [175, 155, 125]);
      c.fillRect(rArmX + 1, rArmY + 9, 3, 3, [220, 38, 38]);
    } else if (accessories.accessoryItem === 'newspaper') {
      c.fillRect(lArmX - 3, lArmY + 4, 6, 12, [240, 238, 228]);
      c.drawBorder(lArmX - 3, lArmY + 4, 6, 12, [150, 140, 130]);
    } else if (accessories.accessoryItem === 'red_book') {
      c.fillRect(rArmX, rArmY + 5, 6, 10, [195, 35, 35]);
      c.drawBorder(rArmX, rArmY + 5, 6, 10, [245, 195, 35]);
      c.fillRect(rArmX + 2, rArmY + 8, 2, 4, [255, 255, 255]);
    } else if (accessories.accessoryItem === 'satchel') {
      c.line(cx - 8, torsoY, cx + 11, torsoY + 15, [160, 120, 80]);
      c.fillRect(cx + 9, rArmY + 4, 6, 7, [140, 100, 65]);
      c.drawBorder(cx + 9, rArmY + 4, 6, 7, [100, 70, 45]);
    }
  } else if (direction === 'up') {
    c.fillRect(cx - 6, torsoY, 12, 3, outfit.collar);
    let lArmY = torsoY + 1;
    let rArmY = torsoY + 1;
    if (walkFrame === 1) {
      lArmY -= 2;
      rArmY += 2;
    } else if (walkFrame === 2) {
      lArmY += 2;
      rArmY -= 2;
    }
    c.fillRect(cx - 14, lArmY, 4, 11, outfit.jacketBase);
    c.fillRect(cx + 10, rArmY, 4, 11, outfit.jacketBase);
  } else if (direction === 'left') {
    // VUNG 2 CÁNH TAY ĐỐI XỨNG BƯỚC ĐI KHI QUAY TRÁI
    c.fillRect(cx - 7, torsoY, 14, 17, outfit.jacketBase);
    c.fillRect(cx - 7, torsoY + 15, 14, 2, outfit.jacketShadow);

    // Tay sau (phía xa)
    let backArmX = cx + 2;
    let backArmY = torsoY + 1;
    let backArmH = 10;
    if (walkFrame === 1) {
      backArmX += 2;
      backArmY -= 2;
    } else if (walkFrame === 2) {
      backArmX -= 4;
      backArmY += 2;
      backArmH = 12;
    }
    c.fillRect(backArmX, backArmY, 4, backArmH, outfit.jacketShadow);
    c.fillRect(backArmX, backArmY + backArmH, 3, 3, skin.shadow);

    // Tay trước (phía gần)
    let frontArmX = cx - 7;
    let frontArmY = torsoY + 2;
    let frontArmH = 11;
    if (walkFrame === 1) {
      frontArmX -= 3;
      frontArmY += 1;
      frontArmH = 12;
    } else if (walkFrame === 2) {
      frontArmX += 3;
      frontArmY -= 2;
      frontArmH = 9;
    }
    c.fillRect(frontArmX, frontArmY, 5, frontArmH, outfit.jacketBase);
    c.fillRect(frontArmX, frontArmY, 1, frontArmH, outfit.jacketShadow);
    c.fillRect(frontArmX, frontArmY + frontArmH, 4, 4, skin.base);
  } else if (direction === 'right') {
    // VUNG 2 CÁNH TAY ĐỐI XỨNG BƯỚC ĐI KHI QUAY PHẢI
    c.fillRect(cx - 7, torsoY, 14, 17, outfit.jacketBase);
    c.fillRect(cx - 7, torsoY + 15, 14, 2, outfit.jacketShadow);

    // Tay sau (phía xa)
    let backArmX = cx - 6;
    let backArmY = torsoY + 1;
    let backArmH = 10;
    if (walkFrame === 1) {
      backArmX -= 2;
      backArmY -= 2;
    } else if (walkFrame === 2) {
      backArmX += 4;
      backArmY += 2;
      backArmH = 12;
    }
    c.fillRect(backArmX, backArmY, 4, backArmH, outfit.jacketShadow);
    c.fillRect(backArmX + 1, backArmY + backArmH, 3, 3, skin.shadow);

    // Tay trước (phía gần)
    let frontArmX = cx + 2;
    let frontArmY = torsoY + 2;
    let frontArmH = 11;
    if (walkFrame === 1) {
      frontArmX += 3;
      frontArmY += 1;
      frontArmH = 12;
    } else if (walkFrame === 2) {
      frontArmX -= 3;
      frontArmY -= 2;
      frontArmH = 9;
    }
    c.fillRect(frontArmX, frontArmY, 5, frontArmH, outfit.jacketBase);
    c.fillRect(frontArmX + 4, frontArmY, 1, frontArmH, outfit.jacketShadow);
    c.fillRect(frontArmX + 1, frontArmY + frontArmH, 4, 4, skin.base);
  }

  // Khăn rằn Nam Bộ của Má Bảy
  if (accessories.accessoryItem === 'scarf' && direction === 'down') {
    c.fillRect(cx - 8, torsoY, 4, 15, [245, 245, 250]);
    c.fillRect(cx + 4, torsoY, 4, 15, [245, 245, 250]);
    for (let sy = torsoY + 1; sy <= torsoY + 14; sy += 3) {
      c.fillRect(cx - 8, sy, 4, 1, [35, 35, 40]);
      c.fillRect(cx + 4, sy, 4, 1, [35, 35, 40]);
    }
  }

  // 5. KHUÔN MẶT CHIBI TRÒN TRỊA & BẦU BĨNH (HEAD & FACE)
  const headY = 21 + bobY;
  c.fillEllipse(cx, headY, 13, 11, skin.base);
  c.fillEllipse(cx, headY + 7, 12, 4, skin.shadow);
  // Đổ bóng mềm dưới cằm
  c.fillRect(cx - 5, headY + 10, 10, 2, [Math.max(0, skin.base[0] - 30), Math.max(0, skin.base[1] - 35), Math.max(0, skin.base[2] - 35)]);

  // 6. KIỂU TÓC CHIBI HD CỰC ĐẸP & CÓ ĐỘ BỒNG BỀNH
  const hairY = 13 + bobY;
  if (hairStyle === 'spiky_wavy') {
    // Quang, Bảo, Nguyễn Văn Cừ
    c.fillEllipse(cx, hairY, 15, 11, hairColors.base);
    c.fillEllipse(cx, hairY - 3, 13, 7, hairColors.highlight);
    c.fillEllipse(cx - 4, hairY - 6, 7, 4, hairColors.glint);

    // Chùm tóc 2 bên tai
    c.fillRect(cx - 14, hairY - 1, 5, 10, hairColors.base);
    c.fillRect(cx + 9, hairY - 1, 5, 10, hairColors.base);
    c.fillRect(cx - 15, hairY + 3, 3, 5, hairColors.dark);
    c.fillRect(cx + 12, hairY + 3, 3, 5, hairColors.dark);

    // Tóc mái tỉa layer tự nhiên
    c.fillRect(cx - 9, hairY + 4, 4, 6, hairColors.highlight);
    c.fillRect(cx - 4, hairY + 5, 5, 5, hairColors.highlight);
    c.fillRect(cx + 2, hairY + 4, 4, 6, hairColors.base);
    c.fillRect(cx + 6, hairY + 5, 4, 5, hairColors.dark);
  } else if (hairStyle === 'ponytail') {
    // Phương, Anh (Ponytail girl with ribbon)
    c.fillEllipse(cx, hairY, 15, 11, hairColors.base);
    c.fillEllipse(cx - 2, hairY - 3, 12, 6, hairColors.highlight);
    c.fillEllipse(cx - 4, hairY - 6, 7, 4, hairColors.glint);

    // Tóc mái
    c.fillRect(cx - 11, hairY + 3, 6, 6, hairColors.base);
    c.fillRect(cx - 4, hairY + 4, 8, 4, hairColors.highlight);
    c.fillRect(cx + 4, hairY + 3, 7, 6, hairColors.base);

    // Đuôi ngựa bồng bềnh bên trái
    const ponyY = hairY + 1 + (isWalking ? -1 : 0);
    c.fillEllipse(cx - 14, ponyY, 5, 8, hairColors.base);
    c.fillEllipse(cx - 15, ponyY + 4, 4, 9, hairColors.dark);
    // Nơ ruy băng
    c.fillRect(cx - 14, ponyY - 3, 5, 3, accessories.hairRibbonColor || [220, 38, 38]);
  } else if (hairStyle === 'short_bob') {
    // Lan, Linh (Short cute bob)
    c.fillEllipse(cx, hairY, 15, 11, hairColors.base);
    c.fillEllipse(cx, hairY - 3, 12, 6, hairColors.highlight);
    c.fillRect(cx - 14, hairY + 1, 5, 12, hairColors.base);
    c.fillRect(cx + 9, hairY + 1, 5, 12, hairColors.base);
    c.fillRect(cx - 10, hairY + 3, 20, 5, hairColors.base);
    c.fillRect(cx - 6, hairY + 4, 12, 3, hairColors.highlight);
  } else if (hairStyle === 'elder_curly') {
    // Bác Hồ, Trọng
    c.fillEllipse(cx, hairY, 15, 11, hairColors.base);
    c.fillEllipse(cx, hairY - 3, 13, 7, hairColors.highlight);
    c.fillEllipse(cx - 2, hairY - 6, 8, 4, hairColors.glint);
    c.fillEllipse(cx, hairY + 4, 10, 6, skin.base); // Trán cao thông thái
    c.fillRect(cx - 14, hairY + 2, 5, 9, hairColors.base);
    c.fillRect(cx + 9, hairY + 2, 5, 9, hairColors.base);
    c.fillRect(cx - 15, hairY + 5, 3, 5, hairColors.dark);
    c.fillRect(cx + 12, hairY + 5, 3, 5, hairColors.dark);
  } else if (hairStyle === 'scholar_slick') {
    // Dũng, Trần Phú, Trường Chinh
    c.fillEllipse(cx, hairY, 14, 9, hairColors.base);
    c.fillEllipse(cx + 2, hairY - 3, 10, 5, hairColors.highlight);
    c.fillRect(cx - 4, hairY - 3, 2, 8, hairColors.dark);
    c.fillRect(cx - 13, hairY + 2, 4, 9, hairColors.base);
    c.fillRect(cx + 9, hairY + 2, 4, 9, hairColors.base);
  } else if (hairStyle === 'bun') {
    // Má Bảy
    c.fillEllipse(cx, hairY + 1, 14, 10, hairColors.base);
    c.fillEllipse(cx, hairY - 2, 11, 6, hairColors.highlight);
    c.fillEllipse(cx, hairY - 9, 5, 5, hairColors.base);
    c.fillEllipse(cx, hairY - 10, 3, 3, hairColors.highlight);
    c.fillRect(cx - 13, hairY + 3, 4, 8, hairColors.base);
    c.fillRect(cx + 9, hairY + 3, 4, 8, hairColors.base);
  } else if (hairStyle === 'youth_crop') {
    // Nam, Kim Đồng
    c.fillEllipse(cx, hairY, 13, 9, hairColors.base);
    c.fillEllipse(cx, hairY - 3, 9, 5, hairColors.highlight);
    c.fillRect(cx - 12, hairY + 1, 4, 7, hairColors.base);
    c.fillRect(cx + 8, hairY + 1, 4, 7, hairColors.base);
    c.fillRect(cx - 6, hairY + 4, 12, 3, hairColors.base);
  }

  // Mũ (Hats)
  if (accessories.hasHat) {
    if (accessories.hatType === 'beret_star') {
      c.fillEllipse(cx, hairY - 1, 17, 8, [38, 92, 48]);
      c.fillEllipse(cx + 3, hairY - 4, 13, 5, [48, 115, 60]);
      c.fillRect(cx - 16, hairY + 1, 32, 4, [30, 75, 40]);
      c.drawStar(cx, hairY - 2, 4.5, 2, 5, [255, 215, 0]);
    } else if (accessories.hatType === 'newsboy') {
      c.fillEllipse(cx, hairY - 1, 17, 8, [115, 85, 60]);
      c.fillEllipse(cx, hairY - 4, 13, 5, [145, 110, 80]);
      c.fillRect(cx - 16, hairY + 1, 32, 4, [90, 65, 45]);
      c.fillRect(cx - 8, hairY + 4, 16, 2, [75, 55, 38]);
    } else if (accessories.hatType === 'fedora') {
      c.fillRect(cx - 17, hairY, 34, 4, [35, 35, 42]);
      c.fillRect(cx - 11, hairY - 8, 22, 9, [45, 45, 54]);
      c.fillRect(cx - 11, hairY - 2, 22, 2, [180, 40, 40]);
    } else if (accessories.hatType === 'ethnic_beret') {
      c.fillEllipse(cx, hairY - 1, 15, 7, [40, 65, 95]);
      c.fillEllipse(cx, hairY - 4, 11, 4, [60, 95, 135]);
      c.fillRect(cx - 13, hairY + 1, 26, 3, [30, 50, 75]);
    }
  }

  // 7. CHI TIẾT KHUÔN MẶT: MẮT ANIME TO TRÒN LONG LANH & MÁ HỒNG TỰ NHIÊN
  const eyeY = 20 + bobY;
  if (direction === 'down') {
    // Eyelash contour cong quyến rũ
    c.fillRect(cx - 8, eyeY, 5, 1, [22, 14, 18]);
    c.fillRect(cx + 3, eyeY, 5, 1, [22, 14, 18]);

    // Mắt trái: Iris 2 tầng + Catchlight sáng
    c.fillRect(cx - 7, eyeY + 1, 3, 4, [26, 16, 20]);
    c.fillRect(cx - 7, eyeY + 3, 3, 2, [75, 45, 35]); // Tầng dưới mắt ấm áp
    c.setPixel(cx - 7, eyeY + 1, 255, 255, 255);       // Điểm sáng lớn
    c.setPixel(cx - 5, eyeY + 3, 215, 225, 245);       // Ánh sáng phụ

    // Mắt phải: Iris 2 tầng + Catchlight sáng
    c.fillRect(cx + 4, eyeY + 1, 3, 4, [26, 16, 20]);
    c.fillRect(cx + 4, eyeY + 3, 3, 2, [75, 45, 35]);
    c.setPixel(cx + 4, eyeY + 1, 255, 255, 255);
    c.setPixel(cx + 6, eyeY + 3, 215, 225, 245);

    // Má hồng Chibi 2 tầng mềm mịn ngọt ngào
    c.fillRect(cx - 10, eyeY + 5, 4, 2, [255, 175, 175, 160]);
    c.fillRect(cx - 9, eyeY + 5, 2, 2, [255, 150, 155, 220]);

    c.fillRect(cx + 6, eyeY + 5, 4, 2, [255, 175, 175, 160]);
    c.fillRect(cx + 7, eyeY + 5, 2, 2, [255, 150, 155, 220]);

    // Miệng cười nhỏ xinh
    c.fillRect(cx - 1, eyeY + 8, 2, 1, [205, 115, 110]);
    c.setPixel(cx - 2, eyeY + 7, 225, 145, 140);
    c.setPixel(cx + 1, eyeY + 7, 225, 145, 140);

    // Kính mắt
    if (accessories.hasGlasses) {
      c.drawBorder(cx - 9, eyeY - 1, 6, 6, accessories.glassesColor);
      c.drawBorder(cx + 3, eyeY - 1, 6, 6, accessories.glassesColor);
      c.fillRect(cx - 3, eyeY + 1, 6, 1, accessories.glassesColor);
      c.fillRect(cx - 8, eyeY, 4, 2, [210, 235, 255, 180]);
      c.fillRect(cx + 4, eyeY, 4, 2, [210, 235, 255, 180]);
    }

    // Chòm râu
    if (accessories.hasBeard) {
      c.fillRect(cx - 4, eyeY + 6, 8, 2, accessories.beardColor);
      c.fillRect(cx - 3, eyeY + 8, 6, 5, accessories.beardColor);
      c.fillRect(cx - 2, eyeY + 13, 4, 4, accessories.beardColor);
      c.fillRect(cx - 1, eyeY + 17, 2, 3, accessories.beardColor);
      c.setPixel(cx, eyeY + 20, accessories.beardColor[0], accessories.beardColor[1], accessories.beardColor[2]);
    }
  } else if (direction === 'left') {
    c.fillRect(cx - 10, eyeY, 5, 1, [22, 14, 18]);
    c.fillRect(cx - 9, eyeY + 1, 3, 4, [26, 16, 20]);
    c.fillRect(cx - 9, eyeY + 3, 3, 2, [75, 45, 35]);
    c.setPixel(cx - 9, eyeY + 1, 255, 255, 255);
    c.fillRect(cx - 10, eyeY + 5, 3, 2, [255, 160, 165, 200]);
    if (accessories.hasGlasses) {
      c.drawBorder(cx - 10, eyeY - 1, 5, 6, accessories.glassesColor);
      c.fillRect(cx - 5, eyeY + 1, 4, 1, accessories.glassesColor);
    }
    if (accessories.hasBeard) {
      c.fillRect(cx - 8, eyeY + 8, 4, 6, accessories.beardColor);
    }
  } else if (direction === 'right') {
    c.fillRect(cx + 5, eyeY, 5, 1, [22, 14, 18]);
    c.fillRect(cx + 6, eyeY + 1, 3, 4, [26, 16, 20]);
    c.fillRect(cx + 6, eyeY + 3, 3, 2, [75, 45, 35]);
    c.setPixel(cx + 6, eyeY + 1, 255, 255, 255);
    c.fillRect(cx + 7, eyeY + 5, 3, 2, [255, 160, 165, 200]);
    if (accessories.hasGlasses) {
      c.drawBorder(cx + 5, eyeY - 1, 5, 6, accessories.glassesColor);
      c.fillRect(cx + 1, eyeY + 1, 4, 1, accessories.glassesColor);
    }
    if (accessories.hasBeard) {
      c.fillRect(cx + 4, eyeY + 8, 4, 6, accessories.beardColor);
    }
  }

  // Viền silhouette đậm nét cổ điển retro (Dark Charcoal Contour)
  c.addSilhouetteOutline([22, 18, 26, 235]);

  return c;
}

// =========================================================================
// 2. GENERATE CHARACTERS (SPRITES CHO TẤT CẢ NHÂN VẬT)
// =========================================================================
function generateAllSprites() {
  const directions = ['down', 'up', 'left', 'right'];

  // 1. NHÂN VẬT CHÍNH: QUANG (Chibi thanh niên áo xanh mòng két - Điểm nhấn truytimdanchu.site)
  directions.forEach((dir) => {
    [0, 1, 2].forEach((frame) => {
      const sprite = createHDChibiSprite({
        hairStyle: 'spiky_wavy',
        hairColors: {
          dark: [60, 38, 25],
          base: [115, 78, 52],
          highlight: [168, 122, 92],
          glint: [215, 170, 138]
        },
        outfit: {
          jacketBase: [36, 122, 102],
          jacketShadow: [24, 85, 72],
          jacketTrim: [52, 160, 135],
          collar: [255, 255, 255],
          buttons: [245, 195, 35],
          pants: [52, 60, 72],
          pantsShadow: [36, 42, 52],
          shoes: [32, 30, 38],
          shoesHighlight: [68, 64, 75]
        },
        direction: dir,
        walkFrame: frame
      });

      let name = `player-${dir}`;
      if (frame > 0) name += `-walk${frame}`;
      sprite.save(`public/assets/sprites/${name}.png`);
    });
  });

  // =======================================================================
  // 8 THÀNH VIÊN NHÓM VNR202 (THEO YÊU CẦU CỦA USER TỪ ẢNH CHỤP)
  // Chỉ lấy tên gọi: Anh (Trưởng nhóm), Bình, Linh, Ngọc, Dũng, Khánh, Đức, Hùng
  // =======================================================================

  // 1. ANH (Ngọc Anh - Trưởng nhóm)
  const anh = createHDChibiSprite({
    hairStyle: 'ponytail',
    hairColors: {
      dark: [45, 30, 25],
      base: [85, 58, 48],
      highlight: [130, 95, 82],
      glint: [175, 135, 120]
    },
    outfit: {
      jacketBase: [180, 50, 60], // Áo đỏ đô nổi bật của Trưởng nhóm
      jacketShadow: [130, 35, 45],
      jacketTrim: [225, 215, 180],
      collar: [255, 255, 255],
      tie: [245, 195, 35], // Cà vạt vàng vương miện
      hasSkirt: false,
      pants: [45, 48, 56],
      pantsShadow: [32, 34, 40],
      shoes: [35, 30, 38],
      shoesHighlight: [70, 65, 75]
    },
    accessories: {
      hairRibbonColor: [220, 38, 38]
    },
    direction: 'down'
  });
  anh.save('public/assets/sprites/npc-anh.png');

  // 2. BÌNH (Đeo kính, áo khoác đen cá tính theo ảnh đại diện)
  const binh = createHDChibiSprite({
    hairStyle: 'spiky_wavy',
    hairColors: {
      dark: [30, 26, 25],
      base: [60, 52, 48],
      highlight: [95, 85, 80],
      glint: [135, 120, 115]
    },
    outfit: {
      jacketBase: [36, 38, 44],
      jacketShadow: [24, 25, 30],
      jacketTrim: [70, 75, 85],
      collar: [245, 245, 250],
      buttons: [160, 160, 170],
      pants: [48, 50, 58],
      pantsShadow: [32, 34, 40],
      shoes: [28, 28, 32],
      shoesHighlight: [62, 62, 70]
    },
    accessories: {
      hasGlasses: true,
      glassesColor: [35, 35, 40]
    },
    direction: 'down'
  });
  binh.save('public/assets/sprites/npc-binh.png');

  // 3. LINH (Bùi Ngọc Linh - Nữ sinh dịu dàng, áo len xanh pastel)
  const linh = createHDChibiSprite({
    hairStyle: 'short_bob',
    hairColors: {
      dark: [55, 38, 32],
      base: [105, 75, 60],
      highlight: [155, 118, 98],
      glint: [195, 160, 140]
    },
    outfit: {
      jacketBase: [45, 125, 135],
      jacketShadow: [30, 90, 100],
      jacketTrim: [240, 245, 250],
      collar: [255, 255, 255],
      tie: [235, 185, 55],
      hasSkirt: true,
      skirtColor: [40, 75, 95],
      skirtShadow: [28, 52, 68],
      socks: [250, 250, 255],
      shoes: [36, 32, 40],
      shoesHighlight: [70, 65, 75]
    },
    direction: 'down'
  });
  linh.save('public/assets/sprites/npc-linh.png');

  // 4. NGỌC (Đỗ Vũ Minh Ngọc - Chàng trai mặc vest thanh lịch theo avatar)
  const ngoc = createHDChibiSprite({
    hairStyle: 'scholar_slick',
    hairColors: {
      dark: [25, 22, 22],
      base: [55, 48, 45],
      highlight: [90, 80, 76],
      glint: [130, 115, 110]
    },
    outfit: {
      jacketBase: [35, 36, 42],
      jacketShadow: [22, 23, 28],
      jacketTrim: [60, 62, 70],
      collar: [255, 255, 255],
      tie: [180, 35, 35], // Cà vạt đỏ lịch thiệp
      buttons: [220, 180, 45],
      pants: [40, 42, 48],
      pantsShadow: [26, 28, 32],
      shoes: [26, 26, 30],
      shoesHighlight: [58, 58, 65]
    },
    direction: 'down'
  });
  ngoc.save('public/assets/sprites/npc-ngoc.png');

  // 5. DŨNG (Nguyễn Dũng - Nam sinh năng động, áo khoác học viện)
  const dung = createHDChibiSprite({
    hairStyle: 'spiky_wavy',
    hairColors: {
      dark: [65, 50, 40],
      base: [110, 85, 70],
      highlight: [155, 125, 105],
      glint: [195, 165, 145]
    },
    outfit: {
      jacketBase: [52, 75, 115], // Áo khoác xanh lam
      jacketShadow: [36, 52, 85],
      jacketTrim: [230, 230, 240],
      collar: [250, 250, 255],
      buttons: [240, 190, 40],
      pants: [46, 48, 56],
      pantsShadow: [32, 34, 40],
      shoes: [30, 30, 35],
      shoesHighlight: [65, 65, 72]
    },
    direction: 'down'
  });
  dung.save('public/assets/sprites/npc-dung.png');

  // 6. KHÁNH (Nguyễn Duy Khánh - Sơ mi trắng trẻ trung)
  const khanh = createHDChibiSprite({
    hairStyle: 'youth_crop',
    hairColors: {
      dark: [45, 32, 25],
      base: [85, 62, 48],
      highlight: [130, 98, 80],
      glint: [170, 138, 120]
    },
    outfit: {
      jacketBase: [246, 246, 250],
      jacketShadow: [200, 200, 210],
      jacketTrim: [50, 130, 160],
      collar: [255, 255, 255],
      buttons: [80, 80, 90],
      pants: [42, 115, 145],
      pantsShadow: [28, 85, 110],
      shoes: [45, 38, 32],
      shoesHighlight: [80, 70, 60]
    },
    direction: 'down'
  });
  khanh.save('public/assets/sprites/npc-khanh.png');

  // 7. ĐỨC (Áo len xanh lá trầm tư, thân thiện)
  const duc = createHDChibiSprite({
    hairStyle: 'spiky_wavy',
    hairColors: {
      dark: [40, 35, 32],
      base: [75, 65, 60],
      highlight: [115, 102, 95],
      glint: [155, 140, 132]
    },
    outfit: {
      jacketBase: [52, 98, 70], // Xanh lá cây tự nhiên
      jacketShadow: [36, 70, 48],
      jacketTrim: [220, 225, 215],
      collar: [250, 250, 255],
      buttons: [215, 180, 50],
      pants: [50, 54, 62],
      pantsShadow: [34, 38, 44],
      shoes: [32, 30, 36],
      shoesHighlight: [65, 62, 70]
    },
    direction: 'down'
  });
  duc.save('public/assets/sprites/npc-duc.png');

  // 8. HÙNG (Avatar thỏ trắng ngộ nghĩnh - Áo hoodie trắng ngà viền hồng pastel)
  const hung = createHDChibiSprite({
    hairStyle: 'youth_crop',
    hairColors: {
      dark: [50, 42, 38],
      base: [92, 78, 70],
      highlight: [138, 120, 110],
      glint: [178, 158, 148]
    },
    outfit: {
      jacketBase: [248, 245, 240], // Áo trắng sáng
      jacketShadow: [210, 205, 200],
      jacketTrim: [240, 160, 175], // Viền hồng pastel dễ thương như avatar thỏ
      collar: [255, 240, 245],
      buttons: [245, 180, 190],
      pants: [65, 70, 82],
      pantsShadow: [45, 50, 60],
      shoes: [38, 35, 42],
      shoesHighlight: [75, 70, 80]
    },
    direction: 'down'
  });
  hung.save('public/assets/sprites/npc-hung.png');

  // 7. TRỌNG (Giáo sư cố vấn cao tuổi tóc trắng, ria mép, kính tròn, âu phục đen)
  const trong = createHDChibiSprite({
    hairStyle: 'elder_curly',
    hairColors: {
      dark: [180, 180, 185],
      base: [225, 225, 230],
      highlight: [248, 248, 252],
      glint: [255, 255, 255]
    },
    outfit: {
      jacketBase: [42, 44, 50],
      jacketShadow: [28, 30, 35],
      jacketTrim: [60, 62, 70],
      collar: [255, 255, 255],
      tie: [185, 40, 40], // Red tie
      buttons: [220, 180, 40],
      pants: [35, 37, 42],
      pantsShadow: [24, 25, 30],
      shoes: [28, 28, 32],
      shoesHighlight: [60, 60, 65]
    },
    accessories: {
      hasGlasses: true,
      glassesColor: [40, 40, 45],
      hasBeard: true,
      beardColor: [235, 235, 240]
    },
    direction: 'down'
  });
  trong.save('public/assets/sprites/npc-trong.png');

  // 8. BÁC HỒ (Chủ tịch Hồ Chí Minh - Bộ kaki, râu dài hiền từ, vầng trán cao rộng)
  const bacHo = createHDChibiSprite({
    hairStyle: 'elder_curly',
    hairColors: {
      dark: [120, 115, 110],
      base: [175, 170, 165],
      highlight: [215, 210, 205],
      glint: [245, 245, 245]
    },
    outfit: {
      jacketBase: [175, 162, 135],
      jacketShadow: [135, 122, 98],
      jacketTrim: [195, 182, 155],
      collar: [235, 230, 215],
      buttons: [95, 85, 70],
      pants: [155, 142, 118],
      pantsShadow: [118, 105, 85],
      shoes: [65, 55, 45],
      shoesHighlight: [105, 95, 80]
    },
    accessories: {
      hasBeard: true,
      beardColor: [225, 222, 218]
    },
    direction: 'down'
  });
  bacHo.save('public/assets/sprites/npc-bac-ho.png');

  // 9. ĐẠI TƯỚNG VÕ NGUYÊN GIÁP (Quân phục xanh lá, mũ ca-lô sao vàng)
  const voNguyenGiap = createHDChibiSprite({
    hairStyle: 'spiky_wavy',
    hairColors: {
      dark: [30, 26, 22],
      base: [65, 55, 46],
      highlight: [105, 90, 78],
      glint: [145, 125, 110]
    },
    outfit: {
      jacketBase: [48, 92, 54],
      jacketShadow: [32, 68, 38],
      jacketTrim: [65, 120, 72],
      collar: [235, 235, 240],
      buttons: [245, 200, 45],
      pants: [40, 78, 46],
      pantsShadow: [26, 56, 32],
      shoes: [35, 32, 38],
      shoesHighlight: [70, 68, 76]
    },
    accessories: {
      hasHat: true,
      hatType: 'beret_star',
      accessoryItem: 'document_scroll'
    },
    direction: 'down'
  });
  voNguyenGiap.save('public/assets/sprites/npc-vo-nguyen-giap.png');

  // 10. TỔNG BÍ THƯ TRẦN PHÚ
  const tranPhu = createHDChibiSprite({
    hairStyle: 'scholar_slick',
    hairColors: {
      dark: [25, 22, 20],
      base: [55, 48, 42],
      highlight: [90, 80, 72],
      glint: [130, 115, 105]
    },
    outfit: {
      jacketBase: [42, 46, 58],
      jacketShadow: [28, 32, 42],
      jacketTrim: [62, 68, 82],
      collar: [255, 255, 255],
      tie: [180, 40, 40],
      pants: [36, 40, 52],
      pantsShadow: [24, 28, 38],
      shoes: [28, 28, 32],
      shoesHighlight: [62, 62, 70]
    },
    direction: 'down'
  });
  tranPhu.save('public/assets/sprites/npc-tran-phu.png');

  // 11. PHAN ĐĂNG LƯU (Nhà báo chiến sĩ)
  const phanDangLuu = createHDChibiSprite({
    hairStyle: 'spiky_wavy',
    hairColors: {
      dark: [40, 32, 26],
      base: [85, 68, 55],
      highlight: [130, 108, 90],
      glint: [170, 145, 125]
    },
    outfit: {
      jacketBase: [110, 95, 82],
      jacketShadow: [80, 68, 58],
      jacketTrim: [130, 115, 102],
      collar: [245, 245, 245],
      buttons: [70, 60, 52],
      pants: [55, 52, 50],
      pantsShadow: [38, 36, 35],
      shoes: [40, 38, 36],
      shoesHighlight: [75, 70, 66]
    },
    accessories: {
      hasHat: true,
      hatType: 'newsboy',
      accessoryItem: 'newspaper'
    },
    direction: 'down'
  });
  phanDangLuu.save('public/assets/sprites/npc-nha-bao.png');

  // 12. MÁ BẢY (Cơ sở Bà Điểm)
  const maBay = createHDChibiSprite({
    hairStyle: 'bun',
    hairColors: {
      dark: [45, 40, 42],
      base: [85, 75, 80],
      highlight: [130, 120, 125],
      glint: [165, 155, 160]
    },
    outfit: {
      jacketBase: [42, 40, 44],
      jacketShadow: [28, 26, 30],
      jacketTrim: [60, 58, 64],
      collar: [225, 225, 230],
      buttons: [180, 160, 130],
      pants: [30, 30, 34],
      pantsShadow: [20, 20, 24],
      shoes: [35, 32, 30],
      shoesHighlight: [65, 60, 55]
    },
    accessories: {
      accessoryItem: 'scarf'
    },
    direction: 'down'
  });
  maBay.save('public/assets/sprites/npc-ma-bay.png');

  // 13. TỔNG BÍ THƯ TRƯỜNG CHINH
  const truongChinh = createHDChibiSprite({
    hairStyle: 'scholar_slick',
    hairColors: {
      dark: [32, 28, 25],
      base: [60, 52, 48],
      highlight: [95, 85, 78],
      glint: [135, 120, 110]
    },
    outfit: {
      jacketBase: [50, 58, 70],
      jacketShadow: [35, 42, 52],
      jacketTrim: [70, 80, 95],
      collar: [250, 250, 255],
      buttons: [245, 195, 35],
      pants: [40, 46, 56],
      pantsShadow: [28, 32, 40],
      shoes: [30, 30, 35],
      shoesHighlight: [65, 65, 75]
    },
    accessories: {
      accessoryItem: 'red_armband'
    },
    direction: 'down'
  });
  truongChinh.save('public/assets/sprites/npc-truong-chinh.png');

  // 14. LÊ HỒNG PHONG
  const leHongPhong = createHDChibiSprite({
    hairStyle: 'scholar_slick',
    hairColors: {
      dark: [30, 25, 22],
      base: [70, 58, 50],
      highlight: [110, 95, 85],
      glint: [150, 135, 125]
    },
    outfit: {
      jacketBase: [45, 50, 65],
      jacketShadow: [30, 34, 46],
      jacketTrim: [65, 72, 90],
      collar: [255, 255, 255],
      tie: [160, 45, 45],
      pants: [42, 46, 58],
      pantsShadow: [28, 32, 40],
      shoes: [30, 30, 35],
      shoesHighlight: [65, 65, 75]
    },
    direction: 'down'
  });
  leHongPhong.save('public/assets/sprites/npc-le-hong-phong.png');

  // 15. NGUYỄN VĂN CỪ
  const nguyenVanCu = createHDChibiSprite({
    hairStyle: 'spiky_wavy',
    hairColors: {
      dark: [40, 30, 25],
      base: [85, 65, 52],
      highlight: [130, 105, 88],
      glint: [175, 145, 125]
    },
    outfit: {
      jacketBase: [88, 76, 64],
      jacketShadow: [64, 54, 45],
      jacketTrim: [112, 98, 84],
      collar: [248, 248, 250],
      buttons: [230, 185, 40],
      pants: [45, 48, 55],
      pantsShadow: [30, 32, 38],
      shoes: [32, 30, 36],
      shoesHighlight: [66, 62, 72]
    },
    accessories: {
      accessoryItem: 'red_book'
    },
    direction: 'down'
  });
  nguyenVanCu.save('public/assets/sprites/npc-nguyen-van-cu.png');

  // 16. HÀ HUY TẬP
  const haHuyTap = createHDChibiSprite({
    hairStyle: 'scholar_slick',
    hairColors: {
      dark: [35, 30, 35],
      base: [68, 60, 70],
      highlight: [105, 95, 110],
      glint: [145, 135, 150]
    },
    outfit: {
      jacketBase: [58, 62, 72],
      jacketShadow: [40, 44, 52],
      jacketTrim: [80, 86, 98],
      collar: [255, 255, 255],
      tie: [195, 55, 45],
      pants: [46, 50, 60],
      pantsShadow: [32, 35, 42],
      shoes: [30, 30, 35],
      shoesHighlight: [65, 65, 75]
    },
    accessories: {
      hasGlasses: true,
      glassesColor: [60, 60, 70]
    },
    direction: 'down'
  });
  haHuyTap.save('public/assets/sprites/npc-ha-huy-tap.png');

  // 17. HOÀNG VĂN THỤ
  const hoangVanThu = createHDChibiSprite({
    hairStyle: 'spiky_wavy',
    hairColors: {
      dark: [32, 28, 25],
      base: [75, 62, 54],
      highlight: [120, 102, 90],
      glint: [165, 142, 128]
    },
    outfit: {
      jacketBase: [62, 78, 65],
      jacketShadow: [44, 58, 48],
      jacketTrim: [82, 102, 86],
      collar: [245, 245, 245],
      buttons: [240, 190, 40],
      pants: [42, 48, 52],
      pantsShadow: [30, 34, 38],
      shoes: [32, 30, 36],
      shoesHighlight: [66, 62, 72]
    },
    direction: 'down'
  });
  hoangVanThu.save('public/assets/sprites/npc-hoang-van-thu.png');

  // 18. KIM ĐỒNG
  const kimDong = createHDChibiSprite({
    hairStyle: 'youth_crop',
    hairColors: {
      dark: [25, 22, 20],
      base: [60, 48, 40],
      highlight: [95, 80, 70],
      glint: [135, 115, 100]
    },
    outfit: {
      jacketBase: [45, 75, 110],
      jacketShadow: [30, 52, 80],
      jacketTrim: [65, 100, 145],
      collar: [240, 240, 245],
      buttons: [220, 220, 225],
      pants: [35, 55, 80],
      pantsShadow: [24, 38, 58],
      shoes: [45, 40, 35],
      shoesHighlight: [75, 70, 65]
    },
    accessories: {
      hasHat: true,
      hatType: 'ethnic_beret',
      accessoryItem: 'satchel'
    },
    direction: 'down'
  });
  kimDong.save('public/assets/sprites/npc-kim-dong.png');

  // 19. MẬT THÁM PHÁP (Trang phục Sĩ quan Cảnh sát Thực dân Pháp sắc sảo)
  const matTham = createHDChibiSprite({
    hairStyle: 'spiky_wavy',
    outfit: {
      jacketBase: [26, 36, 62],
      jacketShadow: [16, 22, 40],
      jacketTrim: [235, 195, 45],
      collar: [220, 38, 38],
      buttons: [245, 205, 45],
      pants: [24, 30, 48],
      pantsShadow: [16, 20, 34],
      shoes: [18, 18, 22],
      shoesHighlight: [55, 55, 68]
    },
    accessories: {
      hasHat: true,
      hatType: 'fedora',
      hasGlasses: true,
      glassesColor: [18, 18, 22]
    },
    direction: 'down'
  });
  matTham.save('public/assets/sprites/patrol-agent.png');
}

// =========================================================================
// 3. GENERATE FULL REALISTIC TERRAIN TILES & PROPS
// =========================================================================
function generateMapTilesAndProps() {
  const S = 48;

  // 1. Cỏ đồng bằng / Meadow Grass (Organic checkerboard palette as in screenshot)
  const grass = new PixelCanvas(S, S);
  grass.fillRect(0, 0, S, S, [84, 134, 82]); // #548652
  grass.fillRect(0, 0, S / 2, S / 2, [77, 124, 75]); // #4d7c4b
  grass.fillRect(S / 2, S / 2, S / 2, S / 2, [77, 124, 75]);
  grass.fillRect(6, 10, 2, 3, [62, 105, 60]);
  grass.fillRect(32, 34, 2, 3, [62, 105, 60]);
  grass.fillRect(20, 24, 2, 2, [255, 255, 250, 190]); // Tiny white petal
  grass.save('public/assets/tiles/tile-grass.png');

  // 2. Cỏ sân quảng trường đậm màu / Courtyard Turf
  const grassPlaza = new PixelCanvas(S, S);
  grassPlaza.fillRect(0, 0, S, S, [60, 107, 68]); // #3c6b44
  grassPlaza.fillRect(0, 0, S / 2, S / 2, [54, 98, 62]);
  grassPlaza.fillRect(S / 2, S / 2, S / 2, S / 2, [54, 98, 62]);
  grassPlaza.fillRect(14, 18, 2, 2, [48, 86, 54]);
  grassPlaza.fillRect(36, 12, 2, 2, [48, 86, 54]);
  grassPlaza.save('public/assets/tiles/tile-grass-plaza.png');

  // 3. Lối đi cát sỏi / Sandstone Pathway (#dfc299 warm beige)
  const pathTile = new PixelCanvas(S, S);
  pathTile.fillRect(0, 0, S, S, [223, 194, 153]); // #dfc299
  for (let y = 0; y < S; y += 12) {
    for (let x = 0; x < S; x += 16) {
      pathTile.fillRect(x + 2, y + 2, 12, 8, [230, 203, 163]);
      pathTile.fillRect(x + 1, y + 10, 14, 1, [204, 175, 134]);
      pathTile.fillRect(x + 14, y + 2, 1, 9, [204, 175, 134]);
    }
  }
  pathTile.save('public/assets/tiles/tile-path.png');

  // 4. Đá núi Pác Bó
  const rocky = new PixelCanvas(S, S);
  rocky.fillRect(0, 0, S, S, [125, 118, 112]);
  for (let y = 0; y < S; y += 8) {
    for (let x = 0; x < S; x += 8) {
      if ((x + y) % 16 === 0) {
        rocky.fillRect(x + 1, y + 1, 6, 6, [145, 138, 130]);
        rocky.fillRect(x + 2, y + 2, 4, 4, [160, 152, 142]);
      } else {
        rocky.fillRect(x + 1, y + 1, 6, 6, [110, 102, 96]);
      }
    }
  }
  rocky.save('public/assets/tiles/tile-rocky.png');

  // 5. Viền đá cẩm thạch
  const curbTop = new PixelCanvas(S, S);
  curbTop.fillRect(0, 0, S, S, [78, 130, 92]);
  curbTop.fillRect(0, 0, S, 6, [218, 195, 155]);
  curbTop.fillRect(0, 0, S, 2, [240, 222, 188]);
  curbTop.fillRect(0, 5, S, 1, [170, 145, 110]);
  curbTop.save('public/assets/tiles/tile-curb-top.png');

  // 6. Gạch lát đường phố cổ Hà Nội
  const cityTile = new PixelCanvas(S, S);
  cityTile.fillRect(0, 0, S, S, [192, 168, 140]);
  for (let y = 0; y < S; y += 12) {
    const shift = (y / 12) % 2 === 0 ? 0 : 8;
    for (let x = 0; x < S; x += 16) {
      cityTile.fillRect(x + shift + 1, y + 1, 14, 10, [212, 188, 158]);
      cityTile.drawBorder(x + shift + 1, y + 1, 14, 10, [165, 142, 116]);
    }
  }
  cityTile.save('public/assets/tiles/tile-city.png');

  // 7. Rừng rậm cây xanh
  const forest = new PixelCanvas(S, S);
  forest.fillRect(0, 0, S, S, [48, 88, 62]);
  forest.fillEllipse(S / 2, S / 2, 18, 18, [36, 75, 50]);
  forest.fillEllipse(S / 2, S / 2 - 2, 15, 15, [52, 105, 70]);
  forest.fillEllipse(S / 2 - 3, S / 2 - 5, 10, 10, [72, 135, 90]);
  forest.save('public/assets/tiles/tile-forest.png');

  // 8. Nước Suối Lê-nin
  const water = new PixelCanvas(S, S);
  water.fillRect(0, 0, S, S, [65, 135, 175]);
  water.fillRect(4, 12, 18, 4, [90, 165, 205]);
  water.fillRect(24, 28, 20, 4, [90, 165, 205]);
  water.fillRect(8, 38, 14, 3, [90, 165, 205]);
  water.save('public/assets/tiles/tile-water.png');

  // =======================================================================
  // ĐẠO CỤ THẾ GIỚI (PROPS)
  // =======================================================================

  // A. Bục đá cẩm thạch ở 4 góc quảng trường (Pedestal Stone 48x48)
  const pedestal = new PixelCanvas(S, S);
  const pedx = S / 2;
  pedestal.fillEllipse(pedx, 38, 12, 4, [0, 0, 0, 70]);
  pedestal.fillRect(pedx - 9, 28, 18, 10, [68, 76, 85]);
  pedestal.fillRect(pedx - 8, 29, 16, 2, [95, 105, 118]);
  pedestal.fillRect(pedx - 7, 14, 14, 15, [110, 122, 135]);
  pedestal.fillRect(pedx - 7, 14, 3, 15, [135, 148, 162]);
  pedestal.fillRect(pedx + 4, 14, 3, 15, [85, 95, 105]);
  pedestal.fillRect(pedx - 9, 10, 18, 5, [135, 148, 162]);
  pedestal.fillRect(pedx - 9, 10, 18, 2, [175, 188, 202]);
  pedestal.save('public/assets/props/pedestal-stone.png');

  // B. Bảng tin / Tủ trưng bày cạnh Dũng (Exhibit Kiosk 48x56 as in screenshot)
  const kiosk = new PixelCanvas(48, 56);
  const kx = 24;
  kiosk.fillEllipse(kx, 50, 18, 5, [0, 0, 0, 75]);
  // Chân gỗ
  kiosk.fillRect(kx - 12, 28, 4, 22, [115, 82, 50]);
  kiosk.fillRect(kx + 8, 28, 4, 22, [115, 82, 50]);
  // Khung bảng tin gỗ
  kiosk.fillRect(kx - 18, 8, 36, 28, [160, 118, 75]);
  kiosk.drawBorder(kx - 18, 8, 36, 28, [105, 75, 45]);
  // Mặt giấy thông báo
  kiosk.fillRect(kx - 14, 12, 28, 20, [248, 242, 220]);
  kiosk.drawBorder(kx - 14, 12, 28, 20, [195, 180, 150]);
  // Dòng chữ mô phỏng
  kiosk.fillRect(kx - 11, 16, 14, 2, [195, 45, 45]); // Tiêu đề đỏ
  kiosk.fillRect(kx - 11, 20, 22, 1, [70, 70, 75]);
  kiosk.fillRect(kx - 11, 23, 18, 1, [70, 70, 75]);
  kiosk.fillRect(kx - 11, 26, 20, 1, [70, 70, 75]);
  kiosk.save('public/assets/props/exhibit-kiosk.png');

  // C. Bục trưng bày hiện vật bảo tàng cạnh Trọng (Museum Showcase Pedestal 48x64)
  const museumPed = new PixelCanvas(48, 64);
  const mx = 24;
  museumPed.fillEllipse(mx, 58, 18, 5, [0, 0, 0, 80]);
  // Bục đế gỗ
  museumPed.fillRect(mx - 16, 36, 32, 22, [175, 135, 90]);
  museumPed.drawBorder(mx - 16, 36, 32, 22, [115, 85, 52]);
  museumPed.fillRect(mx - 12, 44, 24, 10, [140, 105, 65]);
  // Hộp kính trong suốt
  museumPed.fillRect(mx - 14, 14, 28, 22, [215, 235, 250, 120]);
  museumPed.drawBorder(mx - 14, 14, 28, 22, [160, 195, 220]);
  // Hiện vật vàng phát sáng bên trong
  museumPed.fillEllipse(mx, 25, 6, 6, [245, 200, 45]);
  museumPed.fillEllipse(mx - 1, 24, 3, 3, [255, 255, 255]);
  museumPed.save('public/assets/props/prop-podium-museum.png');

  // D. Cây xanh Chibi bo tròn quanh rìa (Chibi Tree 48x64 as in screenshot)
  const treeChibi = new PixelCanvas(48, 64);
  const tx = 24;
  treeChibi.fillEllipse(tx, 58, 12, 4, [0, 0, 0, 70]);
  treeChibi.fillRect(tx - 3, 40, 6, 18, [92, 62, 42]);
  // Tán lá 2 tầng bo tròn mềm mại
  treeChibi.fillEllipse(tx, 32, 18, 16, [45, 95, 55]);
  treeChibi.fillEllipse(tx, 26, 16, 14, [58, 122, 70]);
  treeChibi.fillEllipse(tx - 3, 22, 11, 9, [75, 148, 88]);
  treeChibi.fillEllipse(tx - 4, 18, 5, 4, [105, 185, 115]); // Glint
  treeChibi.save('public/assets/props/prop-tree-chibi.png');

  // E. Cây đa Tân Trào (Banyan Tree 96x96)
  const banyan = new PixelCanvas(96, 96);
  const bx = 48;
  banyan.fillEllipse(bx, 84, 38, 10, [0, 0, 0, 80]);
  banyan.fillRect(bx - 12, 48, 24, 38, [95, 68, 48]);
  banyan.fillRect(bx - 20, 72, 40, 14, [80, 55, 38]);
  banyan.line(bx - 16, 52, bx - 22, 82, [80, 55, 38]);
  banyan.line(bx + 16, 52, bx + 22, 82, [80, 55, 38]);
  banyan.fillEllipse(bx, 36, 44, 30, [38, 85, 52]);
  banyan.fillEllipse(bx - 12, 28, 28, 22, [52, 110, 68]);
  banyan.fillEllipse(bx + 14, 30, 26, 20, [52, 110, 68]);
  banyan.fillEllipse(bx, 20, 22, 16, [68, 142, 88]);
  banyan.save('public/assets/props/banyan-tree.png');

  // F. Cây cau Nam Bộ - Bà Điểm (Areca Palm 48x80)
  const palm = new PixelCanvas(48, 80);
  const ax = 24;
  palm.fillEllipse(ax, 76, 8, 3, [0, 0, 0, 65]);
  palm.line(ax, 76, ax - 3, 25, [135, 110, 85]);
  palm.line(ax + 1, 76, ax - 2, 25, [155, 130, 100]);
  palm.fillEllipse(ax - 3, 20, 20, 10, [46, 118, 62]);
  palm.fillEllipse(ax - 12, 16, 14, 8, [58, 142, 75]);
  palm.fillEllipse(ax + 8, 16, 14, 8, [58, 142, 75]);
  palm.fillEllipse(ax - 3, 10, 8, 6, [72, 165, 90]);
  palm.fillEllipse(ax - 3, 24, 4, 4, [215, 185, 45]);
  palm.save('public/assets/props/prop-tree-palm.png');

  // G. Tòa nhà Phố Cổ Hà Nội (French Colonial Shophouse 96x112)
  const hanoiHouse = new PixelCanvas(96, 112);
  const hx = 48;
  hanoiHouse.fillEllipse(hx, 106, 44, 6, [0, 0, 0, 90]);
  hanoiHouse.fillRect(hx - 44, 14, 88, 18, [180, 65, 45]);
  hanoiHouse.fillRect(hx - 46, 28, 92, 4, [145, 48, 32]);
  hanoiHouse.fillRect(hx - 40, 32, 80, 74, [232, 198, 92]);
  hanoiHouse.drawBorder(hx - 40, 32, 80, 74, [185, 150, 60]);
  [-24, 8].forEach((ox) => {
    hanoiHouse.fillRect(hx + ox, 44, 18, 22, [42, 98, 65]);
    hanoiHouse.drawBorder(hx + ox, 44, 18, 22, [28, 70, 45]);
    hanoiHouse.line(hx + ox + 9, 44, hx + ox + 9, 66, [28, 70, 45]);
  });
  hanoiHouse.fillRect(hx - 36, 72, 72, 10, [195, 38, 38]);
  hanoiHouse.drawBorder(hx - 36, 72, 72, 10, [245, 195, 45]);
  hanoiHouse.fillRect(hx - 16, 82, 32, 24, [88, 55, 35]);
  hanoiHouse.drawBorder(hx - 16, 82, 32, 24, [58, 35, 20]);
  hanoiHouse.save('public/assets/props/prop-building-hanoi.png');

  // H. Cột đèn đường cổ điển Hà Nội (Street Lamp 32x64)
  const lamp = new PixelCanvas(32, 64);
  const lx = 16;
  lamp.fillEllipse(lx, 60, 6, 3, [0, 0, 0, 70]);
  lamp.fillRect(lx - 4, 52, 8, 8, [45, 52, 60]);
  lamp.fillRect(lx - 1, 14, 3, 40, [55, 62, 72]);
  lamp.fillRect(lx - 6, 8, 12, 8, [70, 80, 92]);
  lamp.fillRect(lx - 4, 10, 8, 6, [255, 235, 140]);
  lamp.setPixel(lx, 13, 255, 255, 255);
  lamp.save('public/assets/props/prop-street-lamp.png');

  // I. Nhà tranh vách đất Bà Điểm (Thatched Cottage 80x72)
  const thatchHouse = new PixelCanvas(80, 72);
  const ttx = 40;
  thatchHouse.fillEllipse(ttx, 66, 36, 6, [0, 0, 0, 80]);
  thatchHouse.fillPolygon([{ x: ttx, y: 10 }, { x: ttx - 36, y: 36 }, { x: ttx + 36, y: 36 }], [195, 155, 85]);
  thatchHouse.fillRect(ttx - 38, 34, 76, 4, [160, 125, 65]);
  thatchHouse.fillRect(ttx - 30, 38, 60, 28, [225, 202, 160]);
  thatchHouse.drawBorder(ttx - 30, 38, 60, 28, [180, 155, 115]);
  thatchHouse.fillRect(ttx - 8, 46, 16, 20, [110, 75, 45]);
  thatchHouse.drawBorder(ttx - 8, 46, 16, 20, [75, 48, 25]);
  thatchHouse.save('public/assets/props/prop-house-thatch.png');

  // J. Cầu gỗ qua suối (Wooden Bridge 64x48)
  const bridge = new PixelCanvas(64, 48);
  bridge.fillRect(0, 10, 64, 28, [155, 118, 78]);
  for (let x = 0; x < 64; x += 6) {
    bridge.line(x, 10, x, 38, [120, 88, 55]);
  }
  bridge.fillRect(0, 8, 64, 4, [115, 80, 48]);
  bridge.fillRect(0, 36, 64, 4, [115, 80, 48]);
  bridge.save('public/assets/props/prop-bridge-wood.png');

  // K. Đại Lễ Đài Ba Đình 1945 (Podium Ba Đình 96x80)
  const podium = new PixelCanvas(96, 80);
  const pox = 48;
  podium.fillEllipse(pox, 72, 44, 8, [0, 0, 0, 95]);
  podium.fillRect(pox - 44, 44, 88, 28, [215, 218, 225]);
  podium.drawBorder(pox - 44, 44, 88, 28, [165, 170, 180]);
  podium.fillRect(pox - 36, 32, 72, 16, [235, 238, 245]);
  podium.drawBorder(pox - 36, 32, 72, 16, [175, 180, 190]);
  podium.fillRect(pox - 32, 36, 64, 18, [205, 35, 35]);
  podium.drawStar(pox, 45, 6, 2.5, 5, [255, 215, 0]);
  podium.fillRect(pox - 8, 16, 2, 18, [80, 85, 95]);
  podium.fillRect(pox - 10, 14, 6, 4, [180, 185, 195]);
  podium.fillRect(pox + 6, 16, 2, 18, [80, 85, 95]);
  podium.fillRect(pox + 4, 14, 6, 4, [180, 185, 195]);
  podium.save('public/assets/props/prop-podium-badinh.png');

  // L. Đình Tân Trào (Temple Dinh 112x88)
  const dinh = new PixelCanvas(112, 88);
  const dx = 56;
  dinh.fillEllipse(dx, 82, 50, 6, [0, 0, 0, 85]);
  dinh.fillPolygon([{ x: dx, y: 12 }, { x: dx - 54, y: 38 }, { x: dx + 54, y: 38 }], [165, 52, 38]);
  dinh.fillRect(dx - 56, 36, 112, 6, [130, 38, 26]);
  [-36, -12, 12, 36].forEach((offset) => {
    dinh.fillRect(dx + offset - 3, 42, 6, 40, [95, 60, 36]);
  });
  dinh.fillRect(dx - 44, 76, 88, 6, [135, 95, 60]);
  dinh.save('public/assets/props/prop-temple-dinh.png');

  // M. Bàn đá Pác Bó (Stone Table 64x48)
  const stoneTable = new PixelCanvas(64, 48);
  const sx = 32;
  stoneTable.fillEllipse(sx, 40, 22, 6, [0, 0, 0, 70]);
  stoneTable.fillRect(sx - 16, 22, 32, 16, [105, 112, 120]);
  stoneTable.fillEllipse(sx, 20, 24, 10, [145, 155, 165]);
  stoneTable.fillEllipse(sx - 2, 18, 20, 7, [175, 185, 195]);
  stoneTable.fillRect(sx - 8, 16, 12, 4, [245, 245, 250]);
  stoneTable.save('public/assets/props/stone-table.png');

  // N. Cột cờ Đỏ Sao Vàng (Flagpole 64x112)
  const flagpole = new PixelCanvas(64, 112);
  const fx = 32;
  flagpole.fillEllipse(fx, 104, 20, 6, [0, 0, 0, 70]);
  flagpole.fillRect(fx - 8, 92, 16, 14, [140, 145, 155]);
  flagpole.fillRect(fx - 1, 10, 3, 84, [220, 220, 225]);
  flagpole.fillRect(fx + 2, 12, 30, 20, [220, 38, 38]);
  flagpole.drawBorder(fx + 2, 12, 30, 20, [180, 25, 25]);
  flagpole.drawStar(fx + 17, 22, 6, 2.5, 5, [255, 215, 0]);
  flagpole.save('public/assets/props/flagpole-redstar.png');

  // O. Vách đá núi Pác Bó (Cliff Rock 64x64)
  const cliff = new PixelCanvas(64, 64);
  cliff.fillRect(0, 16, 64, 48, [105, 110, 118]);
  cliff.fillRect(0, 16, 64, 6, [140, 145, 155]);
  cliff.fillRect(0, 10, 64, 8, [68, 125, 78]);
  cliff.fillRect(4, 8, 56, 4, [85, 145, 95]);
  cliff.line(16, 20, 22, 58, [75, 80, 88]);
  cliff.line(42, 22, 38, 60, [75, 80, 88]);
  cliff.line(22, 36, 32, 42, [75, 80, 88]);
  cliff.save('public/assets/props/prop-cliff-rock.png');

  // P. Cây thông núi Pác Bó (Pine Tree 48x72)
  const pine = new PixelCanvas(48, 72);
  const pnx = 24;
  pine.fillEllipse(pnx, 68, 12, 4, [0, 0, 0, 75]);
  pine.fillRect(pnx - 3, 50, 6, 20, [88, 58, 38]);
  pine.fillPolygon([{ x: pnx, y: 8 }, { x: pnx - 18, y: 38 }, { x: pnx + 18, y: 38 }], [32, 75, 48]);
  pine.fillPolygon([{ x: pnx, y: 22 }, { x: pnx - 21, y: 52 }, { x: pnx + 21, y: 52 }], [26, 65, 42]);
  pine.fillPolygon([{ x: pnx, y: 36 }, { x: pnx - 24, y: 64 }, { x: pnx + 24, y: 64 }], [20, 55, 36]);
  pine.save('public/assets/props/prop-tree-pine.png');
}

console.log('--- BẮT ĐẦU TẠO HỆ THỐNG ASSET ĐẶC BIỆT CHUẨN TRUYTIMDANCHU.SITE & VNR202 ---');
generateAllSprites();
generateMapTilesAndProps();
console.log('--- HOÀN THÀNH 100%! TẤT CẢ ASSET ĐÃ SẴN SÀNG ---');
