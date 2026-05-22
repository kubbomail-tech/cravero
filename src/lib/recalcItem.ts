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

  // Labor base: only materials + hardware — additionals never carry MO
  const totalLaborBase = allItems.reduce(
    (a: number, i: any) => a + toNumber(i.subtotalMaterials) + toNumber(i.subtotalHardware),
    0
  )
  const totalAdditionals = allItems.reduce((a: number, i: any) => a + toNumber(i.subtotalAdditionals), 0)

  const labor = totalLaborBase * (toNumber(quote.laborPercentage) / 100)

  // Discount applies only on (materials + hardware + MO), not on additionals
  const discountableBase = totalLaborBase + labor
  const discountDollar = discountableBase * (toNumber(quote.discountAmount) / 100)
  const afterDiscount = discountableBase - discountDollar

  const beforeTax = afterDiscount + totalAdditionals
  const vat = beforeTax * (toNumber(quote.vatPercentage) / 100)

  await tx.quote.update({
    where: { id: quoteId },
    data: {
      subtotalMaterials: totalLaborBase,
      subtotalLabor: labor,
      subtotalAdditionals: totalAdditionals,
      subtotalBeforeTax: beforeTax,
      vatAmount: vat,
      totalAmount: beforeTax + vat,
    },
  })
}
