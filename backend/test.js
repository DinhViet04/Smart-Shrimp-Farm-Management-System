const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const data = await prisma.waterQualityRecord.findMany({
    orderBy: { recordTime: 'asc' }
  });
  console.log("RECORDS IN DB:");
  data.forEach(d => console.log(d.id, d.recordTime));
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
