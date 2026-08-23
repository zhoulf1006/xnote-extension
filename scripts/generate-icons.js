import fs from 'fs-extra';
import path from 'path';
import { createCanvas } from 'canvas';
import pngToIco from 'png-to-ico';

const ICON_SIZES = [16, 32, 48, 128];
const ICO_SIZES = [16, 32, 48];  // Common sizes for .ico files
const BACKGROUND_COLOR = '#4A90E2';  // Blue background (production)
const DEV_BACKGROUND_COLOR = '#E67E22';  // Orange background (dev builds, visually distinct in the toolbar)
const ICON_COLOR = '#FFFFFF';  // White icon

async function generateIcon(size, bgColor = BACKGROUND_COLOR) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Draw background with rounded corners
    const radius = size * 0.15;
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(size - radius, 0);
    ctx.quadraticCurveTo(size, 0, size, radius);
    ctx.lineTo(size, size - radius);
    ctx.quadraticCurveTo(size, size, size - radius, size);
    ctx.lineTo(radius, size);
    ctx.quadraticCurveTo(0, size, 0, size - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fill();

    // Draw note/document icon
    ctx.fillStyle = ICON_COLOR;
    const padding = size * 0.2;
    const noteWidth = size - (padding * 2);
    const noteHeight = noteWidth * 1.2;
    const noteX = padding;
    const noteY = (size - noteHeight) / 2;

    // Draw note body with folded corner
    const cornerSize = noteWidth * 0.2;
    ctx.beginPath();
    ctx.moveTo(noteX, noteY);
    ctx.lineTo(noteX + noteWidth - cornerSize, noteY);
    ctx.lineTo(noteX + noteWidth, noteY + cornerSize);
    ctx.lineTo(noteX + noteWidth, noteY + noteHeight);
    ctx.lineTo(noteX, noteY + noteHeight);
    ctx.closePath();
    ctx.fill();

    // Draw the folded corner
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.moveTo(noteX + noteWidth - cornerSize, noteY);
    ctx.lineTo(noteX + noteWidth - cornerSize, noteY + cornerSize);
    ctx.lineTo(noteX + noteWidth, noteY + cornerSize);
    ctx.closePath();
    ctx.fill();

    // Draw lines on the note
    ctx.strokeStyle = bgColor;
    ctx.lineWidth = size * 0.02;
    const lineSpacing = noteHeight * 0.15;
    const lineStartX = noteX + noteWidth * 0.15;
    const lineEndX = noteX + noteWidth * 0.85;

    for (let i = 0; i < 3; i++) {
        const lineY = noteY + noteHeight * 0.35 + (i * lineSpacing);
        if (lineY < noteY + noteHeight - lineSpacing) {
            ctx.beginPath();
            ctx.moveTo(lineStartX, lineY);
            ctx.lineTo(lineEndX, lineY);
            ctx.stroke();
        }
    }

    return canvas;
}

async function main() {
    try {
        // Ensure output directory exists
        const outputDir = path.resolve('public/icons');
        await fs.ensureDir(outputDir);

        // Generate PNG icons
        for (const size of ICON_SIZES) {
            const canvas = await generateIcon(size);
            const buffer = canvas.toBuffer('image/png');
            await fs.writeFile(path.join(outputDir, `icon-${size}.png`), buffer);
            console.log(`Generated icon-${size}.png`);
        }

        // Generate the orange dev icon set (used by dev builds via apply-dev-manifest.js)
        const devDir = path.resolve('scripts/dev-icons');
        await fs.ensureDir(devDir);
        for (const size of ICON_SIZES) {
            const canvas = await generateIcon(size, DEV_BACKGROUND_COLOR);
            await fs.writeFile(path.join(devDir, `icon-${size}.png`), canvas.toBuffer('image/png'));
            console.log(`Generated scripts/dev-icons/icon-${size}.png`);
        }

        // Generate .ico file
        // Use the 48px PNG as source for ico
        const pngBuffer = (await generateIcon(48)).toBuffer('image/png');
        const icoBuffer = await pngToIco(pngBuffer);
        await fs.writeFile(path.join(outputDir, 'favicon.ico'), icoBuffer);
        console.log('Generated favicon.ico');

        console.log('Icon generation complete!');
    } catch (error) {
        console.error('Error generating icons:', error);
        process.exit(1);
    }
}

main();
