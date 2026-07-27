import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The demo seed is disabled in production')
  }

  console.log('Seeding database...')
  const passwordHash = await bcrypt.hash('Demo1234', 12)
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@fantadrama.local' },
    update: {},
    create: {
      username: 'demo',
      email: 'demo@fantadrama.local',
      passwordHash
    }
  })

  const group = await prisma.group.create({
    data: {
      name: 'Gruppo Demo',
      description: 'Gruppo demo per sviluppo',
      code: 'DEMO1234'
    }
  })

  await prisma.groupMember.create({ data: { userId: demoUser.id, groupId: group.id, role: 'ADMIN' } })

  const season = await prisma.season.create({ data: { name: 'Stagione Demo', start: new Date(), end: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), groupId: group.id } })

  const event1 = await prisma.event.create({ data: { title: 'Cena Demo', startsAt: new Date(), endsAt: new Date(Date.now() + 1000 * 60 * 60 * 3), groupId: group.id } })
  const event2 = await prisma.event.create({ data: { title: 'Festa Demo', startsAt: new Date(), endsAt: new Date(Date.now() + 1000 * 60 * 60 * 6), groupId: group.id } })

  for (let i = 1; i <= 10; i++) {
    await prisma.character.create({ data: { name: `Personaggio ${i}`, nickname: `P${i}`, groupId: group.id } })
  }

  const sampleCards = [
    'Qualcuno parlerà di politica.',
    'Chi arriverà per ultimo?',
    'Quante volte verrà detta la frase: ai miei tempi?',
    'Qualcuno farà una domanda sul matrimonio?',
    'Un bicchiere verrà rovesciato.',
    'Verrà nominato un ex.',
    'Qualcuno racconterà una storia già sentita.',
    'Il cane ruberà qualcosa dal tavolo.',
    'Qualcuno si addormenterà sul divano.',
    'Scoppierà una discussione.'
  ]

  for (let i = 0; i < 40; i++) {
    const title = sampleCards[i % sampleCards.length] + ` #${i + 1}`
    await prisma.dramaCard.create({ data: { title, basePoints: 5, type: 'YES_NO', rarity: 'COMMON', author: 'seed' } })
  }

  console.log('Seeding completed')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
