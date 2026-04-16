import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { toNumber, formatCurrency } from '@/lib/calculations'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

const PRIMARY = rgb(0.098, 0.557, 0.522) // #198e85
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
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Embed logo
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
    if (y - needed < 60) newPage()
  }

  function drawHeader() {
    // Header bar
    page.drawRectangle({ x: 0, y: H - 80, width: W, height: 80, color: DARK })

    // Logo or fallback text
    if (logoImage) {
      const logoH = 50
      const logoW = logoImage.width * (logoH / logoImage.height)
      page.drawImage(logoImage, { x: 32, y: H - 68, width: logoW, height: logoH })
    } else {
      page.drawText('CRAVERO MUEBLES', { x: 40, y: H - 38, size: 18, font: fontBold, color: WHITE })
      page.drawText('Sistema de Presupuestación', { x: 40, y: H - 55, size: 9, font, color: rgb(0.7,0.9,0.88) })
    }

    // Quote number right
    page.drawText(`PRESUPUESTO`, { x: W - 200, y: H - 35, size: 8, font, color: rgb(0.7,0.9,0.88) })
    page.drawText(quote!.quoteNumber, { x: W - 200, y: H - 52, size: 16, font: fontBold, color: WHITE })

    y = H - 90
  }

  drawHeader()

  // Client + dates block
  y -= 12
  page.drawRectangle({ x: 36, y: y - 70, width: W - 72, height: 80, color: LIGHT_GRAY })

  const issueDate = new Date(quote.issueDate).toLocaleDateString('es-AR')
  const expDate = quote.expirationDate ? new Date(quote.expirationDate).toLocaleDateString('es-AR') : '—'

  // Left: client
  page.drawText('CLIENTE', { x: 48, y: y - 14, size: 7, font: fontBold, color: MUTED })
  page.drawText(quote.client.fullName, { x: 48, y: y - 28, size: 11, font: fontBold, color: TEXT })
  if (quote.client.businessName) {
    page.drawText(quote.client.businessName, { x: 48, y: y - 42, size: 9, font, color: MUTED })
  }
  const contactLine = [quote.client.phone, quote.client.email].filter(Boolean).join('  ·  ')
  if (contactLine) page.drawText(contactLine, { x: 48, y: y - 56, size: 8, font, color: MUTED })

  // Right: dates
  page.drawText('FECHA', { x: W - 200, y: y - 14, size: 7, font: fontBold, color: MUTED })
  page.drawText(issueDate, { x: W - 200, y: y - 28, size: 10, font, color: TEXT })
  page.drawText('VENCIMIENTO', { x: W - 130, y: y - 14, size: 7, font: fontBold, color: MUTED })
  page.drawText(expDate, { x: W - 130, y: y - 28, size: 10, font, color: TEXT })

  y -= 86

  // Items
  for (const item of quote.items) {
    checkSpace(60)
    y -= 12

    // Item header
    page.drawRectangle({ x: 36, y: y - 24, width: W - 72, height: 28, color: PRIMARY })
    const itemLabel = `${item.furnitureType?.name ?? 'Mueble'}${item.description ? ' · ' + item.description : ''} (×${item.quantity})`
    page.drawText(itemLabel, { x: 44, y: y - 16, size: 9, font: fontBold, color: WHITE })
    const itemTotal = fmt(item.subtotalTotal)
    page.drawText(itemTotal, { x: W - 100, y: y - 16, size: 9, font: fontBold, color: WHITE })
    y -= 30

    // Cuts table
    if (item.cuts.length > 0) {
      checkSpace(24)
      page.drawText('Cortes y piezas:', { x: 44, y: y - 10, size: 7.5, font: fontBold, color: MUTED })
      y -= 18

      // Table header
      page.drawRectangle({ x: 44, y: y - 14, width: W - 88, height: 16, color: rgb(0.9, 0.94, 0.94) })
      page.drawText('Material', { x: 48, y: y - 10, size: 7, font: fontBold, color: MUTED })
      page.drawText('Desc', { x: 180, y: y - 10, size: 7, font: fontBold, color: MUTED })
      page.drawText('Ancho', { x: 270, y: y - 10, size: 7, font: fontBold, color: MUTED })
      page.drawText('Alto', { x: 310, y: y - 10, size: 7, font: fontBold, color: MUTED })
      page.drawText('Cant', { x: 345, y: y - 10, size: 7, font: fontBold, color: MUTED })
      page.drawText('m²', { x: 375, y: y - 10, size: 7, font: fontBold, color: MUTED })
      page.drawText('Subtotal', { x: W - 100, y: y - 10, size: 7, font: fontBold, color: MUTED })
      y -= 18

      for (const cut of item.cuts) {
        checkSpace(14)
        const matName = cut.materialNameSnapshot ?? '—'
        page.drawText(matName.substring(0, 22), { x: 48, y: y - 8, size: 7.5, font, color: TEXT })
        page.drawText((cut.description ?? '').substring(0, 14), { x: 180, y: y - 8, size: 7.5, font, color: TEXT })
        page.drawText(String(cut.width), { x: 270, y: y - 8, size: 7.5, font, color: TEXT })
        page.drawText(String(cut.height), { x: 310, y: y - 8, size: 7.5, font, color: TEXT })
        page.drawText(String(cut.quantity), { x: 350, y: y - 8, size: 7.5, font, color: TEXT })
        page.drawText(parseFloat(String(cut.totalArea)).toFixed(4), { x: 375, y: y - 8, size: 7.5, font, color: TEXT })
        page.drawText(fmt(cut.subtotalCost), { x: W - 100, y: y - 8, size: 7.5, font: fontBold, color: TEXT })
        y -= 13

        for (const band of cut.edgeBands) {
          checkSpace(12)
          const sl: Record<string, string> = { TOP: 'Sup', BOTTOM: 'Inf', LEFT: 'Izq', RIGHT: 'Der' }
          page.drawText(`  └ Canto ${sl[band.side]} · ${band.materialNameSnapshot ?? ''}`, { x: 52, y: y - 8, size: 7, font, color: MUTED })
          page.drawText(`${parseFloat(String(band.totalLength)).toFixed(3)} ml`, { x: 375, y: y - 8, size: 7, font, color: MUTED })
          page.drawText(fmt(band.subtotalCost), { x: W - 100, y: y - 8, size: 7, font, color: MUTED })
          y -= 12
        }
      }
    }

    // Accessories
    if (item.accessories.length > 0) {
      checkSpace(20)
      y -= 4
      page.drawText('Herrajes y accesorios:', { x: 44, y: y - 10, size: 7.5, font: fontBold, color: MUTED })
      y -= 18

      for (const acc of item.accessories) {
        checkSpace(12)
        const label = `${acc.materialNameSnapshot ?? ''} ${acc.description ? '· ' + acc.description : ''}`
        page.drawText(label.substring(0, 50), { x: 48, y: y - 8, size: 7.5, font, color: TEXT })
        page.drawText(`×${acc.quantity}`, { x: 350, y: y - 8, size: 7.5, font, color: TEXT })
        page.drawText(fmt(acc.subtotalCost), { x: W - 100, y: y - 8, size: 7.5, font: fontBold, color: TEXT })
        y -= 13
      }
    }

    y -= 8
  }

  // Totals box
  checkSpace(140)
  y -= 16
  const totalsH = 112
  page.drawRectangle({ x: W - 220, y: y - totalsH, width: 184, height: totalsH, color: DARK })

  let ty = y - 16
  function totalRow(label: string, value: string, bold = false) {
    page.drawText(label, { x: W - 214, y: ty, size: 8, font: bold ? fontBold : font, color: rgb(0.8,0.95,0.93) })
    page.drawText(value, { x: W - 60 - fontBold.widthOfTextAtSize(value, 8), y: ty, size: 8, font: bold ? fontBold : font, color: WHITE })
    ty -= 13
  }

  totalRow('Subtotal materiales:', fmt(quote.subtotalMaterials))
  totalRow(`Mano de obra (${toNumber(quote.laborPercentage)}%):`, fmt(quote.subtotalLabor))
  if (toNumber(quote.discountAmount) > 0) totalRow('Descuento:', `-${fmt(quote.discountAmount)}`)
  totalRow('Subtotal:', fmt(quote.subtotalBeforeTax))
  totalRow(`IVA (${toNumber(quote.vatPercentage)}%):`, fmt(quote.vatAmount))
  ty -= 4
  page.drawLine({ start: { x: W - 214, y: ty + 6 }, end: { x: W - 44, y: ty + 6 }, color: rgb(0.4,0.7,0.68), thickness: 0.5 })
  totalRow('TOTAL:', fmt(quote.totalAmount), true)

  // Payment terms
  if (quote.paymentTerms) {
    y -= totalsH + 16
    page.drawText('FORMAS DE PAGO:', { x: 40, y: y, size: 7.5, font: fontBold, color: MUTED })
    page.drawText(quote.paymentTerms, { x: 40, y: y - 14, size: 8.5, font, color: TEXT })
    y -= 32
  }

  // Notes
  if (quote.notes) {
    checkSpace(40)
    y = Math.min(y, H - 820)
    page.drawText('OBSERVACIONES:', { x: 40, y: y - (quote.paymentTerms ? 0 : totalsH + 16), size: 7.5, font: fontBold, color: MUTED })
    page.drawText(quote.notes.substring(0, 120), { x: 40, y: y - (quote.paymentTerms ? 14 : totalsH + 30), size: 8.5, font, color: TEXT })
  }

  // Footer
  const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1]
  lastPage.drawLine({ start: { x: 40, y: 50 }, end: { x: W - 40, y: 50 }, color: LIGHT_GRAY, thickness: 1 })
  lastPage.drawText('Este presupuesto es válido hasta la fecha de vencimiento indicada.', { x: 40, y: 34, size: 7.5, font, color: MUTED })
  lastPage.drawText('Cravero Muebles', { x: W - 120, y: 34, size: 7.5, font: fontBold, color: PRIMARY })

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
