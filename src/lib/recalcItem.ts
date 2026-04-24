import { toNumber } from './calculations'

type Tx = Parameters<Parameters<typeof import('./prisma').prisma.$transaction>[0]>[0]

export async function recalcItem(tx: any, itemId: string, quoteId: string) {
  const item = await tx.quoteItem.findUnique({
    where: { id: itemId },
    include: {
      cuts: { include: { edgeBands: true } },
      accessories: true,
      additionals: true,
    },
  })
  if (!item) return

  let subtotalMaterials = 0
  for (const cut of item.cuts) {
    subtotalMaterials += toNumber(cut.subtotalCost)
    for (const eb of cut.edgeBands) subtotalMaterials += toNumber(eb.subtotalCost)
  }
  let subtotalHardware = 0
  for (const acc of item.accessories) subtotalHardware += toNumber(acc.subtotalCost)
  let subtotalAdditionals = 0
  for (const add of item.additionals) subtotalAdditionals += toNumber(add.subtotalCost)

  await tx.quoteItem.update({
    where: { id: itemId },
    data: { subtotalMaterials, subtotalHardware, subtotalAdditionals, subtotalTotal: subtotalMaterials + subtotalHardware + subtotalAdditionals },
  })

  const allItems = await tx.quoteItem.findMany({ where: { quoteId } })
  const quote = await tx.quote.findUnique({ where: { id: quoteId } })
  if (!quote) return

  const totalMat = allItems.reduce(
    (a: number, i: any) => a + toNumber(i.subtotalMaterials) + toNumber(i.subtotalHardware) + toNumber(i.subtotalAdditionals),
    0
  )
  const labor = totalMat * (toNumber(quote.laborPercentage) / 100)
  const sub = totalMat + labor
  const discountDollar = sub * (toNumber(quote.discountAmount) / 100)
  const beforeTax = sub - discountDollar
  const vat = beforeTax * (toNumber(quote.vatPercentage) / 100)

  await tx.quote.update({
    where: { id: quoteId },
    data: { subtotalMaterials: totalMat, subtotalLabor: labor, subtotalBeforeTax: beforeTax, vatAmount: vat, totalAmount: beforeTax + vat },
  })
}
