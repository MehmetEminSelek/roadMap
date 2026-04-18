// Tek seferlik: railway-seed.sql'i prod DB'ye bas.
// Kullanım:
//   cd apps/api
//   DATABASE_URL="postgresql://..." node prisma/run-seed-sql.js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

(async () => {
  const sqlPath = path.join(__dirname, 'railway-seed.sql');
  const raw = fs.readFileSync(sqlPath, 'utf8');

  // Önce yorum satırlarını temizle, sonra ';' ile böl
  const stripped = raw
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');

  const statements = stripped
    .split(/;\s*(?:\n|$)/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`${statements.length} statement çalıştırılacak...`);

  let ok = 0, fail = 0;
  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      ok++;
    } catch (e) {
      fail++;
      console.error('FAIL:', stmt.slice(0, 120).replace(/\s+/g, ' '), '→', e.message);
    }
  }
  console.log(`\n✅ Başarılı: ${ok}    ❌ Hatalı: ${fail}`);
  await prisma.$disconnect();
})();
