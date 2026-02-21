"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const DRY_RUN = !process.argv.includes('--run');
const CUTOFF = 2400;
function numericPart(entryNumber) {
    if (!entryNumber)
        return null;
    const m = /\d+/.exec(entryNumber);
    return m ? parseInt(m[0], 10) : null;
}
async function main() {
    console.log(DRY_RUN
        ? '🔍  DRY-RUN mode — nothing will be deleted.  Pass --run to commit.\n'
        : '🚨  LIVE mode — deletions will be committed!\n');
    const allClients = await prisma.client.findMany({
        select: { id: true, name: true, entryNumber: true, _count: { select: { payments: true } } },
    });
    const clientsToDelete = allClients.filter((c) => numericPart(c.entryNumber) !== null && numericPart(c.entryNumber) < CUTOFF);
    const totalPayments = clientsToDelete.reduce((s, c) => s + c._count.payments, 0);
    console.log(`Clients to delete : ${clientsToDelete.length}`);
    console.log(`Payments (cascade): ${totalPayments}`);
    if (clientsToDelete.length > 0) {
        console.log('\nSample (first 20):');
        clientsToDelete.slice(0, 20).forEach((c) => console.log(`  ${c.entryNumber ?? '(no entry)'}  –  ${c.name}  –  ${c._count.payments} payments`));
        if (clientsToDelete.length > 20) {
            console.log(`  … and ${clientsToDelete.length - 20} more`);
        }
    }
    const allImported = await prisma.importedClient.findMany({
        select: { id: true, clientName: true, entryNumber: true, status: true },
    });
    const importedToDelete = allImported.filter((r) => numericPart(r.entryNumber) !== null && numericPart(r.entryNumber) < CUTOFF);
    console.log(`\nImported staging records to delete: ${importedToDelete.length}`);
    if (importedToDelete.length > 0) {
        console.log('Sample (first 10):');
        importedToDelete.slice(0, 10).forEach((r) => console.log(`  ${r.entryNumber ?? '(no entry)'}  –  ${r.clientName ?? '—'}  [${r.status}]`));
    }
    if (clientsToDelete.length === 0 && importedToDelete.length === 0) {
        console.log('\n✅  Nothing to delete.');
        return;
    }
    if (DRY_RUN) {
        console.log('\n📋  Re-run with --run to actually delete the above records.\n' +
            '    Deleting clients will also cascade-delete their payments.\n');
        return;
    }
    console.log('\nDeleting...');
    const clientIds = clientsToDelete.map((c) => c.id);
    const importedIds = importedToDelete.map((r) => r.id);
    const [deletedClients, deletedImported] = await prisma.$transaction([
        prisma.client.deleteMany({ where: { id: { in: clientIds } } }),
        prisma.importedClient.deleteMany({ where: { id: { in: importedIds } } }),
    ]);
    console.log(`\n✅  Done.`);
    console.log(`   Clients deleted       : ${deletedClients.count}`);
    console.log(`   Payments (cascaded)   : ${totalPayments}`);
    console.log(`   Imported recs deleted : ${deletedImported.count}`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=cleanup-before-a2400.js.map