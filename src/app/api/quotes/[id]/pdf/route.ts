import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { toNumber } from '@/lib/calculations'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

const PRIMARY = rgb(0.098, 0.557, 0.522)
const DARK = rgb(0.051, 0.31, 0.29)
const WHITE = rgb(1, 1, 1)
const LIGHT_GRAY = rgb(0.95, 0.97, 0.98)
const TEXT = rgb(0.1, 0.125, 0.173)
const MUTED = rgb(0.443, 0.502, 0.588)

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      client: true,
      items: {
        include: {
          furnitureType: true,
          cuts: { include: { edgeBands: true } },
          accessories: true,
          additionals: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let logoImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo.png')
    const logoBytes = fs.readFileSync(logoPath)
    logoImage = await pdfDoc.embedPng(logoBytes)
  } catch { /* logo optional */ }

  const W = 595
  const H = 842
  let page = pdfDoc.addPage([W, H])
  let y = H - 40

  function newPage() {
    page = pdfDoc.addPage([W, H])
    y = H - 40
    drawHeader()
  }

  function checkSpace(needed: number) {
    if (y - needed < 55) newPage()
  }

  function drawHeader() {
    // Header bar — compact 60px
    page.drawRectangle({ x: 0, y: H - 60, width: W, height: 60, color: DARK })

    if (logoImage) {
      const logoH = 38
      const logoW = logoImage.width * (logoH / logoImage.height)
      page.drawImage(logoImage, { x: 32, y: H - 52, width: logoW, height: logoH })
    } else {
      page.drawText('CRAVERO MUEBLES', { x: 40, y: H - 28, size: 16, font: fontBold, color: WHITE })
      page.drawText('Sistema de Presupuestación', { x: 40, y: H - 43, size: 8, font, color: rgb(0.7,0.9,0.88) })
    }

    page.drawText('PRESUPUESTO', { x: W - 190, y: H - 22, size: 7, font, color: rgb(0.7,0.9,0.88) })
    page.drawText(quote!.quoteNumber, { x: W - 190, y: H - 38, size: 15, font: fontBold, color: WHITE })

    y = H - 68
  }

  drawHeader()

  // Combined client + title block
  y -= 8
  const issueDate = new Date(quote.issueDate).toLocaleDateString('es-AR')
  const expDate = quote.expirationDate ? new Date(quote.expirationDate).toLocaleDateString('es-AR') : '—'
  const contactLine = [quote.client.phone, quote.client.email].filter(Boolean).join('  ·  ')

  const blockH = 58 + (quote.title ? 26 : 0)
  page.drawRectangle({ x: 36, y: y - blockH + 8, width: W - 72, height: blockH, color: LIGHT_GRAY })

  page.drawText('CLIENTE', { x: 48, y: y - 10, size: 6.5, font: fontBold, color: MUTED })
  page.drawText(quote.client.fullName, { x: 48, y: y - 22, size: 10, font: fontBold, color: TEXT })
  if (quote.client.businessName) {
    page.drawText(quote.client.businessName, { x: 48, y: y - 34, size: 8.5, font, color: MUTED })
  }
  if (contactLine) page.drawText(contactLine, { x: 48, y: y - 44, size: 7.5, font, color: MUTED })

  page.drawText('FECHA', { x: W - 190, y: y - 10, size: 6.5, font: fontBold, color: MUTED })
  page.drawText(issueDate, { x: W - 190, y: y - 22, size: 9, font, color: TEXT })
  page.drawText('VENCIMIENTO', { x: W - 120, y: y - 10, size: 6.5, font: fontBold, color: MUTED })
  page.drawText(expDate, { x: W - 120, y: y - 22, size: 9, font, color: TEXT })

  if (quote.title) {
    page.drawLine({ start: { x: 44, y: y - 52 }, end: { x: W - 44, y: y - 52 }, color: rgb(0.87, 0.9, 0.92), thickness: 0.5 })
    page.drawText('TIPO DE AMOBLAMIENTO: ', { x: 48, y: y - 61, size: 6, font: fontBold, color: MUTED })
    page.drawText(quote.title.toUpperCase(), { x: 48 + fontBold.widthOfTextAtSize('TIPO DE AMOBLAMIENTO: ', 6), y: y - 61, size: 8, font: fontBold, color: TEXT })
  }

  y -= blockH + 4

  const laborFactor = 1 + toNumber(quote.laborPercentage) / 100

  function drawVisibilitySection(label: string, rows: Array<{ text: string; amount: number; visibility: string }>) {
    // A row still earns its line if it has a price to show, even without description text —
    // only truly empty rows (no text, no price shown) are dropped.
    const visible = rows.filter(r => r.visibility !== 'HIDDEN' && (r.text.trim() || r.visibility === 'DESCRIPTION_AND_PRICE'))
    if (visible.length === 0) return
    checkSpace(11)
    y -= 2
    page.drawText(label, { x: 44, y: y - 6, size: 6.5, font: fontBold, color: MUTED })
    y -= 10

    for (const row of visible) {
      checkSpace(9)
      if (row.text.trim()) {
        page.drawText(row.text.substring(0, 70), { x: 48, y: y - 6, size: 6.5, font, color: TEXT })
      }
      if (row.visibility === 'DESCRIPTION_AND_PRICE') {
        page.drawText(fmt(row.amount), { x: W - 100, y: y - 6, size: 6.5, font: fontBold, color: TEXT })
      }
      y -= 9
    }
  }

  // Items
  for (const item of quote.items) {
    checkSpace(34)
    y -= 5

    // Item header
    const itemMatHw = toNumber(item.subtotalMaterials) + toNumber(item.subtotalHardware)
    const itemClientTotal = itemMatHw * laborFactor + toNumber(item.subtotalAdditionals)
    page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: PRIMARY })
    const itemLabel = `${item.furnitureType?.name ?? 'Mueble'}${item.description ? ' · ' + item.description : ''} (×${item.quantity})`
    page.drawText(itemLabel, { x: 44, y: y - 12, size: 8, font: fontBold, color: WHITE })
    page.drawText(fmt(itemClientTotal), { x: W - 100, y: y - 12, size: 8, font: fontBold, color: WHITE })
    y -= 21

    // Cortes y piezas
    drawVisibilitySection('Cortes y piezas:', item.cuts.map((cut: any) => {
      const edgeBandCost = (cut.edgeBands ?? []).reduce((s: number, eb: any) => s + toNumber(eb.subtotalCost), 0)
      return { text: cut.description ?? '', amount: toNumber(cut.subtotalCost) + edgeBandCost, visibility: cut.pdfVisibility }
    }))

    // Herrajes y accesorios
    drawVisibilitySection('Herrajes y accesorios:', item.accessories.map((acc: any) => {
      return { text: acc.description ?? '', amount: toNumber(acc.subtotalCost), visibility: acc.pdfVisibility }
    }))

    // Adicionales — sin MO
    const additionals = (item as any).additionals ?? []
    drawVisibilitySection('Adicionales:', additionals.map((add: any) => {
      return { text: add.description ?? '', amount: toNumber(add.subtotalCost), visibility: add.pdfVisibility }
    }))

    y -= 4
  }

  // Totals box
  const hasDiscount = toNumber(quote.discountAmount) > 0
  const hasAdditionals = toNumber(quote.subtotalAdditionals) > 0
  const totalsH = 76 + (hasDiscount ? 11 : 0) + (hasAdditionals ? 11 : 0)
  checkSpace(totalsH + 14)
  y -= 14
  page.drawRectangle({ x: W - 210, y: y - totalsH, width: 174, height: totalsH, color: DARK })

  let ty = y - 12
  function totalRow(label: string, value: string, bold = false) {
    page.drawText(label, { x: W - 204, y: ty, size: 7.5, font: bold ? fontBold : font, color: rgb(0.8,0.95,0.93) })
    page.drawText(value, { x: W - 48 - fontBold.widthOfTextAtSize(value, 7.5), y: ty, size: 7.5, font: bold ? fontBold : font, color: WHITE })
    ty -= 11
  }

  const discountableBase = toNumber(quote.subtotalMaterials) + toNumber(quote.subtotalLabor)
  totalRow('Subtotal:', fmt(discountableBase))
  if (hasDiscount) {
    const discountDollar = discountableBase * (toNumber(quote.discountAmount) / 100)
    totalRow(`Descuento (${toNumber(quote.discountAmount)}%):`, `-${fmt(discountDollar)}`)
  }
  if (hasAdditionals) {
    totalRow('Adicionales:', fmt(quote.subtotalAdditionals))
  }
  totalRow(`IVA (${toNumber(quote.vatPercentage)}%):`, fmt(quote.vatAmount))
  ty -= 10
  page.drawLine({ start: { x: W - 204, y: ty + 5 }, end: { x: W - 44, y: ty + 5 }, color: rgb(0.4,0.7,0.68), thickness: 0.5 })
  ty -= 5
  totalRow('TOTAL:', fmt(quote.totalAmount), true)

  // Advance y past the totals box (always, regardless of payment terms)
  y -= totalsH + 14

  // Payment terms
  if (quote.paymentTerms) {
    checkSpace(20)
    page.drawText('FORMAS DE PAGO:', { x: 40, y: y, size: 7, font: fontBold, color: MUTED })
    y -= 12

    const maxW = W - 80
    for (const paragraph of quote.paymentTerms.split('\n')) {
      if (!paragraph.trim()) { y -= 5; continue }
      const words = paragraph.split(' ')
      let line = ''
      for (const word of words) {
        const test = line ? `${line} ${word}` : word
        if (font.widthOfTextAtSize(test, 8) > maxW) {
          checkSpace(10)
          page.drawText(line, { x: 40, y: y, size: 8, font, color: TEXT })
          y -= 10
          line = word
        } else {
          line = test
        }
      }
      if (line) {
        checkSpace(10)
        page.drawText(line, { x: 40, y: y, size: 8, font, color: TEXT })
        y -= 10
      }
    }
  }

  // Observaciones — full width, after totals
  if (quote.notes) {
    y -= 14
    checkSpace(20)
    page.drawRectangle({ x: 36, y: y - 2, width: W - 72, height: 1, color: LIGHT_GRAY })
    y -= 10
    page.drawText('OBSERVACIONES:', { x: 40, y: y, size: 6.5, font: fontBold, color: MUTED })
    y -= 10

    const maxWn = W - 80
    for (const paragraph of quote.notes.split('\n')) {
      if (!paragraph.trim()) { y -= 5; continue }
      const words = paragraph.split(' ')
      let line = ''
      for (const word of words) {
        const test = line ? `${line} ${word}` : word
        if (font.widthOfTextAtSize(test, 8) > maxWn) {
          checkSpace(10)
          page.drawText(line, { x: 40, y: y, size: 8, font, color: TEXT })
          y -= 10
          line = word
        } else {
          line = test
        }
      }
      if (line) {
        checkSpace(10)
        page.drawText(line, { x: 40, y: y, size: 8, font, color: TEXT })
        y -= 10
      }
    }
  }

  // Footer
  const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1]
  lastPage.drawLine({ start: { x: 40, y: 46 }, end: { x: W - 40, y: 46 }, color: LIGHT_GRAY, thickness: 1 })
  lastPage.drawText('Este presupuesto es válido hasta la fecha de vencimiento indicada.', { x: 40, y: 32, size: 7, font, color: MUTED })
  lastPage.drawText('Cravero Muebles', { x: W - 116, y: 32, size: 7, font: fontBold, color: PRIMARY })

  const pdfBytes = await pdfDoc.save()

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${quote.quoteNumber}.pdf"`,
    },
  })
}

function fmt(val: any): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(parseFloat(String(val)))
}
