import fs from 'fs';
const path = 'src/components/marketplace/business-showcase.tsx';
let content = fs.readFileSync(path, 'utf8');

// Simple line-by-line replacement based on order
const newImages = [
  'makeup.jpg',           // Lassana Kozmetični Salon
  'beard.jpg',            // Lassana Frizerski Salon  
  'reflexology.jpg',      // Wellness Studio Mira
  'hero-laser.jpg',       // Barbershop AS
  'hottowel.jpg',         // Color Nail Studio
  'wax.jpg',              // Monin Lepotni Kotiček
  'sportmassage.jpg',     // Lassana Frizerski Salon - Derčeva
  'aroma.jpg',            // Lassana Frizerski in Kozmetični
  'hero-atelier.jpg',     // Lassana Frizerski Salon - Celovška
  'staff-barber.jpg',     // Beauty & Spa Center
  'staff-frizerka.jpg',   // LJUBLÉA salon
  'staff-nails.jpg',      // AS Barbershop
  'staff-kozmeticka.jpg', // Moods head and body
  'staff-maserka.jpg',    // Color Nail
  'staff-sivilja.jpg',    // Studio Beauty
];

let imageIndex = 0;
const lines = content.split('\n');
const result = lines.map(line => {
  if (line.includes('image: "/img/presets/') && imageIndex < newImages.length) {
    const newLine = line.replace(/image: "[^"]+"/, 'image: "/img/presets/' + newImages[imageIndex] + '"');
    imageIndex++;
    return newLine;
  }
  return line;
});

fs.writeFileSync(path, result.join('\n'));

// Verify
const verifyContent = fs.readFileSync(path, 'utf8');
const matches = verifyContent.match(/image: "[^"]+"/g);
const unique = [...new Set(matches)];
console.log('Skupaj slik:', matches.length);
console.log('Unikatnih:', unique.length);
unique.forEach(m => console.log(' ', m));
