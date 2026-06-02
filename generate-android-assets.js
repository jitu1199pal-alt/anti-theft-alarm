import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';

// Hex colors for pixel drawing
const COLOR_BG_DARK = 0x0F172AFF;    // #0F172A (Slate-900)
const COLOR_GOLD = 0xEAB308FF;       // #EAB308 (Gold-500)
const COLOR_GREEN = 0x22C55EFF;      // #22C55E (Green-500)
const COLOR_WHITE = 0xFFFFFFFF;      // #FFFFFF (White)

async function generate() {
  console.log("Starting Android fallback launcher icon generation...");

  try {
    // 1. Create outer/square master icon (512x512)
    // Jimp API uses (width, height, background_color) in v1.x
    const masterSquare = new Jimp({ width: 512, height: 512, color: COLOR_BG_DARK });

    // 2. Create round master icon (512x512) with transparent outer corners (alpha 0x00)
    const masterRound = new Jimp({ width: 512, height: 512, color: 0x00000000 });

    // Math function to draw the beautiful golden circle backplate, shield, and battery in the center
    const centerX = 256;
    const centerY = 256;

    // Draw square icon pixels
    masterSquare.scan(0, 0, 512, 512, function(x, y, idx) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Draw standard inner layout
      drawIconComponents(this, x, y, idx, dist, dx, dy);
    });

    // Draw round icon pixels
    masterRound.scan(0, 0, 512, 512, function(x, y, idx) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= 250) {
        // Draw the dark background inside the circle
        this.setPixelColor(COLOR_BG_DARK, x, y);
        // Draw standard inner layout over it
        drawIconComponents(this, x, y, idx, dist, dx, dy);
      } else {
        // Transparent outer border
        this.setPixelColor(0x00000000, x, y);
      }
    });

    // Target Android directories
    const resDir = path.resolve('android/app/src/main/res');
    
    const sizes = [
      { name: 'mipmap-mdpi', size: 48 },
      { name: 'mipmap-hdpi', size: 72 },
      { name: 'mipmap-xhdpi', size: 96 },
      { name: 'mipmap-xxhdpi', size: 144 },
      { name: 'mipmap-xxxhdpi', size: 192 },
      { name: 'mipmap', size: 192 } // default / fallback folder
    ];

    for (const item of sizes) {
      const dirPath = path.join(resDir, item.name);
      
      // Ensure directory exists
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${item.name}`);
      }

      // Resize square icon
      const resizedSquare = masterSquare.clone().resize({ w: item.size, h: item.size });
      await resizedSquare.write(path.join(dirPath, 'ic_launcher.png'));

      // Resize round icon
      const resizedRound = masterRound.clone().resize({ w: item.size, h: item.size });
      await resizedRound.write(path.join(dirPath, 'ic_launcher_round.png'));

      console.log(`Generated ic_launcher and ic_launcher_round PNG files in ${item.name} at size ${item.size}x${item.size}`);
    }

    // 3. Clean up invalid XML vector files from local defaults (AAPT failure root cause)
    // In res/mipmap/, having ic_launcher.xml or ic_launcher_round.xml as raw vectors is invalid and causes AAPT compile errors.
    const mipmapDefaultDir = path.join(resDir, 'mipmap');
    const xmlFileLines = ['ic_launcher.xml', 'ic_launcher_round.xml'];

    for (const xmlFile of xmlFileLines) {
      const xmlPath = path.join(mipmapDefaultDir, xmlFile);
      if (fs.existsSync(xmlPath)) {
        fs.unlinkSync(xmlPath);
        console.log(`Cleaned up invalid compilation-breaking XML file: ${xmlPath}`);
      }
    }

    console.log("Success! Fallback launcher PNG folders and files successfully created.");
  } catch (error) {
    console.error("Error generating Android fallback icons:", error);
  }
}

// Draw the iconic Gold outer ring, medieval shield, battery and safe charging outline using math
function drawIconComponents(image, x, y, idx, dist, dx, dy) {
  // 1. Draw gold outer concentric ring
  if (dist >= 210 && dist <= 230) {
    image.setPixelColor(COLOR_GOLD, x, y);
    return;
  }
  
  // 2. Draw gold decorative middle star shield rings at the borders
  if (dist >= 235 && dist <= 240) {
    image.setPixelColor(COLOR_GOLD, x, y);
    return;
  }

  // 3. Gold shield drawing with mathematical curves
  // Outer Shield golden frame
  const isOuterShield = checkInShield(x, y, 145, 250, 386, 92) && !checkInShield(x, y, 155, 250, 376, 80);
  if (isOuterShield) {
    image.setPixelColor(COLOR_GOLD, x, y);
    return;
  }

  // Draw battery inside the shield center
  // Top connector cap
  if (y >= 210 && y <= 218 && x >= 244 && x <= 268) {
    image.setPixelColor(COLOR_GREEN, x, y);
    return;
  }

  // Body container border (green outline)
  if (y >= 222 && y <= 316 && x >= 216 && x <= 296) {
    const isBorder = (y <= 228 || y >= 310 || x <= 222 || x >= 290);
    if (isBorder) {
      image.setPixelColor(COLOR_GREEN, x, y);
    } else {
      // Draw standard inner segments or lightning symbol
      // Let's draw a charging lightning bolt in Gold!
      if (checkInLightning(x, y)) {
        image.setPixelColor(COLOR_GOLD, x, y);
      } else {
        // Draw green charging liquid bar segments at the bottom
        if (y >= 275 && y <= 302) {
          image.setPixelColor(COLOR_GREEN, x, y);
        }
      }
    }
  }
}

// Helper to mathematically check if pixel falls inside gold medieval shield layout
function checkInShield(x, y, topY, centerShieldY, bottomY, halfWidth) {
  if (y < topY || y > bottomY) return false;
  
  const midY = centerShieldY;
  
  if (y <= midY) {
    // Upper part is a solid rectangle
    return x >= (256 - halfWidth) && x <= (256 + halfWidth);
  } else {
    // Lower part curves parabolically down to a point at the bottom
    const progress = (y - midY) / (bottomY - midY); // 0 to 1
    const allowedHalfWidth = halfWidth * (1 - progress * progress);
    return Math.abs(x - 256) <= allowedHalfWidth;
  }
}

// Check if pixel is inside standard lighting bolt geometry in the center
function checkInLightning(x, y) {
  // Lightning upper segment triangle points
  // Top: (256, 234), bottom left: (230, 274), bottom right: (264, 274)
  const inUpperTriangle = checkPointInTriangle(x, y, 256, 234, 230, 274, 264, 274);
  
  // Lightning lower segment triangle points
  // Top left: (248, 264), top right: (282, 264), bottom tip: (256, 304)
  const inLowerTriangle = checkPointInTriangle(x, y, 248, 264, 282, 264, 256, 304);
  
  return inUpperTriangle || inLowerTriangle;
}

// standard barycentric check to see if pixel coordinate is inside a triangle
function checkPointInTriangle(px, py, x1, y1, x2, y2, x3, y3) {
  const dX = px - x3;
  const dY = py - y3;
  const dX21 = x2 - x3;
  const dY12 = y3 - y2;
  const dX31 = x1 - x3;
  const dY31 = y1 - y3;
  const D = dY12 * dX31 + dX21 * dY31;
  const s = dY12 * dX + dX21 * dY;
  const t = dY31 * dX - dX31 * dY;
  
  if (D < 0) {
    return s <= 0 && t <= 0 && s + t >= D;
  }
  return s >= 0 && t >= 0 && s + t <= D;
}

generate();
