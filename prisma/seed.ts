import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
})

async function main() {
  console.log('🌱 Seeding database...')

  // Units
  const units = [
    { code: 'M2', name: 'Metro cuadrado' },
    { code: 'ML', name: 'Metro lineal' },
    { code: 'UNIT', name: 'Unidad' },
    { code: 'SET', name: 'Juego' },
    { code: 'PACK', name: 'Paquete' },
  ]

  for (const unit of units) {
    await prisma.unit.upsert({
      where: { code: unit.code },
      update: {},
      create: unit,
    })
  }
  console.log('✅ Units created')

  // Material Categories
  const categories = [
    { name: 'Placa / Madera', description: 'Placas de madera, MDF, melamina' },
    { name: 'Canto', description: 'Cantos de PVC, ABS, madera' },
    { name: 'Herraje', description: 'Herrajes en general' },
    { name: 'Bisagra', description: 'Bisagras para muebles' },
    { name: 'Corredera', description: 'Correderas para cajones' },
    { name: 'Tornillo', description: 'Tornillos y fijaciones' },
    { name: 'Accesorio', description: 'Accesorios varios' },
    { name: 'Insumo adicional', description: 'Insumos y materiales adicionales' },
  ]

  for (const cat of categories) {
    await prisma.materialCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    })
  }
  console.log('✅ Material categories created')

  // Furniture Types
  const furnitureTypes = [
    { name: 'Alacena', description: 'Mueble superior de cocina' },
    { name: 'Bajo mesada', description: 'Mueble inferior de cocina' },
    { name: 'Placard', description: 'Armario empotrado' },
    { name: 'Escritorio', description: 'Mesa de trabajo' },
    { name: 'Mueble de baño', description: 'Vanitory u otros muebles de baño' },
    { name: 'Biblioteca', description: 'Estantería para libros' },
    { name: 'Mesa', description: 'Mesa comedor o auxiliar' },
    { name: 'Rack / TV', description: 'Mueble para televisor' },
    { name: 'Mueble especial', description: 'Diseño a medida especial' },
  ]

  for (const ft of furnitureTypes) {
    await prisma.furnitureType.upsert({
      where: { name: ft.name },
      update: {},
      create: ft,
    })
  }
  console.log('✅ Furniture types created')

  // Admin user
  const passwordHash = await bcrypt.hash('Admin123!', 12)
  await prisma.user.upsert({
    where: { email: 'admin@craveromuebles.com.ar' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@craveromuebles.com.ar',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  })
  console.log('✅ Admin user created: admin@craveromuebles.com.ar / Admin123!')

  // Sample materials
  const allCategories = await prisma.materialCategory.findMany()
  const placaCategory = allCategories.find(c => c.name === 'Placa / Madera')
  const cantoCategory = allCategories.find(c => c.name === 'Canto')
  const herrajeCategory = allCategories.find(c => c.name === 'Herraje')
  const bisagraCategory = allCategories.find(c => c.name === 'Bisagra')
  const correderaCategory = allCategories.find(c => c.name === 'Corredera')
  const tornilloCategory = allCategories.find(c => c.name === 'Tornillo')

  const m2Unit = await prisma.unit.findUnique({ where: { code: 'M2' } })
  const mlUnit = await prisma.unit.findUnique({ where: { code: 'ML' } })
  const unitUnit = await prisma.unit.findUnique({ where: { code: 'UNIT' } })
  const packUnit = await prisma.unit.findUnique({ where: { code: 'PACK' } })

  if (placaCategory && m2Unit) {
    const sampleMaterials = [
      {
        name: 'Melamina Blanca 18mm',
        internalCode: 'MEL-BL-18',
        categoryId: placaCategory.id,
        unitId: m2Unit.id,
        unitCost: 15400,
      },
      {
        name: 'MDF 15mm',
        internalCode: 'MDF-15',
        categoryId: placaCategory.id,
        unitId: m2Unit.id,
        unitCost: 12800,
      },
    ]

    if (cantoCategory && mlUnit) {
      sampleMaterials.push({
        name: 'Canto PVC Blanco 22mm',
        internalCode: 'CANTO-PVC-BL-22',
        categoryId: cantoCategory.id,
        unitId: mlUnit.id,
        unitCost: 450,
      })
    }

    if (herrajeCategory && unitUnit) {
      sampleMaterials.push({
        name: 'Manija Acero Inox 128mm',
        internalCode: 'MAN-AI-128',
        categoryId: herrajeCategory.id,
        unitId: unitUnit.id,
        unitCost: 2850,
      })
    }

    if (bisagraCategory && unitUnit) {
      sampleMaterials.push({
        name: 'Bisagra cazoleta 35mm',
        internalCode: 'BIS-CAZ-35',
        categoryId: bisagraCategory.id,
        unitId: unitUnit.id,
        unitCost: 1320,
      })
    }

    if (correderaCategory && unitUnit) {
      sampleMaterials.push({
        name: 'Corredera Telescópica 45cm',
        internalCode: 'CORR-TEL-45',
        categoryId: correderaCategory.id,
        unitId: unitUnit.id,
        unitCost: 4200,
      })
    }

    if (tornilloCategory && packUnit) {
      sampleMaterials.push({
        name: 'Tornillos Rápido 4x40 (x200)',
        internalCode: 'TORN-RAP-4x40',
        categoryId: tornilloCategory.id,
        unitId: packUnit.id,
        unitCost: 3650,
      })
    }

    for (const mat of sampleMaterials) {
      const existing = await prisma.material.findFirst({
        where: { internalCode: mat.internalCode },
      })
      if (!existing) {
        await prisma.material.create({ data: mat })
      }
    }
    console.log('✅ Sample materials created')
  }

  console.log('🎉 Seed completed successfully!')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
