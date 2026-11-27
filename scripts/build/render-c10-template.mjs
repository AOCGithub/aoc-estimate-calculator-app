import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const sourcePath = new URL('../../src/features/payments/c10-template-v6.pdf', import.meta.url);
const outputDirectory = fileURLToPath(new URL('../../src/features/payments/template-v6/', import.meta.url));
const scale = 2.5;
const pageHeight = 792;
const pages = [
  {
    source: 1,
    masks: [
      {x: 64, y: 242, width: 135, height: 18, sample: [195, 249]},
      {x: 145, y: 148, width: 205, height: 18, sample: [350, 156]},
      {x: 145, y: 108, width: 235, height: 34, sample: [375, 120]},
      {x: 44, y: 49, width: 367, height: 14, sample: [350, 53]},
      {x: 44, y: 10, width: 180, height: 18, sample: [220, 17]},
      {x: 235, y: 10, width: 145, height: 18, sample: [350, 17]},
    ],
  },
  {
    source: 3,
    masks: [
      {x: 58, y: 630, width: 230, height: 20},
      {x: 292, y: 630, width: 260, height: 20},
      {x: 58, y: 510, width: 500, height: 62},
      {x: 220, y: 437, width: 302, height: 16, sample: [520, 442]},
      {x: 220, y: 415, width: 302, height: 16, sample: [520, 419]},
      {x: 220, y: 392, width: 302, height: 15, sample: [520, 397]},
      {x: 220, y: 369, width: 302, height: 16, sample: [520, 374]},
      {x: 220, y: 346, width: 302, height: 16, sample: [520, 351]},
      {x: 58, y: 170, width: 500, height: 170},
      {x: 496, y: 17, width: 59, height: 23},
    ],
  },
  {
    source: 4,
    masks: [
      {x: 378, y: 632, width: 176, height: 45, sample: [540, 644]},
      {x: 58, y: 604, width: 150, height: 14},
      {x: 218, y: 604, width: 335, height: 14},
      {x: 58, y: 444, width: 500, height: 78},
      {x: 207, y: 367, width: 220, height: 35, sample: [540, 387]},
      {x: 207, y: 325, width: 220, height: 35, sample: [540, 345]},
      {x: 207, y: 270, width: 220, height: 42, sample: [540, 302]},
      {x: 207, y: 178, width: 220, height: 84, sample: [545, 220]},
      {x: 442, y: 241, width: 106, height: 20, sample: [545, 225]},
      {x: 58, y: 80, width: 500, height: 52},
      {x: 496, y: 17, width: 59, height: 23},
    ],
  },
  {
    source: 5,
    masks: [
      {x: 58, y: 526, width: 500, height: 214},
      {x: 92, y: 298, width: 463, height: 230},
      {x: 496, y: 17, width: 59, height: 23},
    ],
  },
  {
    source: 6,
    masks: [
      {x: 58, y: 580, width: 500, height: 22},
      {x: 68, y: 513, width: 230, height: 22, sample: [290, 535]},
      {x: 68, y: 482, width: 230, height: 20},
      {x: 68, y: 467, width: 230, height: 20},
      {x: 312, y: 513, width: 234, height: 22, sample: [540, 535]},
      {x: 312, y: 482, width: 234, height: 20},
      {x: 312, y: 467, width: 234, height: 20},
      {x: 58, y: 429, width: 500, height: 30},
      {x: 496, y: 17, width: 59, height: 23},
    ],
  },
];

const pdf = await getDocument({data: new Uint8Array(await readFile(sourcePath))}).promise;
await mkdir(outputDirectory, {recursive: true});

for (const {source, masks} of pages) {
  const page = await pdf.getPage(source);
  const viewport = page.getViewport({scale});
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');
  await page.render({canvasContext: context, viewport, canvas}).promise;

  for (const {x, y, width, height, sample} of masks) {
    let fill = '#ffffff';
    if (sample) {
      const pixel = context.getImageData(
        Math.floor(sample[0] * scale),
        Math.floor((pageHeight - sample[1]) * scale),
        1,
        1,
      ).data;
      fill = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
    }
    context.fillStyle = fill;
    context.fillRect(
      Math.round(x * scale),
      Math.round((pageHeight - y - height) * scale),
      Math.ceil(width * scale),
      Math.ceil(height * scale),
    );
  }

  const path = join(outputDirectory, `page-${source}.png`);
  await writeFile(path, canvas.toBuffer('image/png'));
  console.log(`Created ${path}`);
}
