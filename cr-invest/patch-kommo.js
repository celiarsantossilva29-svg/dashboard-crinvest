const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'services', 'kommo.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Find the section after "total++;" and before "if (items.length < 250) break;"
// and inject the history enrichment code

const oldBlock = `      total++;\r
    }\r
\r
    if (items.length < 250) break;\r
    page++;`;

const newBlock = `      total++;\r
    }\r
\r
    // ── Enriquecer leads sem timestamps (Speed-to-Lead, No-Show, etc) ──\r
    for (let ei = 0; ei < items.length; ei += 5) {\r
      const batch = items.slice(ei, ei + 5);\r
      await Promise.all(\r
        batch.map((item: any) => syncLeadHistory(String(item.id)).catch((e: any) => {\r
          console.error(\`syncLeadHistory failed for \${item.id}:\`, e.message);\r
        }))\r
      );\r
      if (ei + 5 < items.length) {\r
        await new Promise((r: any) => setTimeout(r, 800));\r
      }\r
    }\r
\r
    if (items.length < 250) break;\r
    page++;`;

if (content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Patched kommo.ts successfully');
} else {
  // Try without \r
  const oldBlockLF = oldBlock.replace(/\r\n/g, '\n');
  const newBlockLF = newBlock.replace(/\r\n/g, '\n');
  if (content.includes(oldBlockLF)) {
    content = content.replace(oldBlockLF, newBlockLF);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Patched kommo.ts successfully (LF mode)');
  } else {
    // Debug: show what's around "total++;"
    const idx = content.indexOf('total++;');
    if (idx >= 0) {
      console.log('Found total++ at index', idx);
      console.log('Context:', JSON.stringify(content.substring(idx, idx + 200)));
    } else {
      console.log('❌ Could not find "total++;" in the file at all');
    }
  }
}
