const { createCanvas } = require('canvas');
const fs = require('fs');

// Create a 4096x4096 canvas
const canvas = createCanvas(4096, 4096);
const ctx = canvas.getContext('2d');

// Fill with solid red color
ctx.fillStyle = '#FF0000';
ctx.fillRect(0, 0, 4096, 4096);

// Write to file
const buffer = canvas.toBuffer('image/png');
const outputPath = './fronted/public/assets/background.png';
fs.writeFileSync(outputPath, buffer);

console.log('4096x4096 red background.png created successfully!');