import cron from 'node-cron'
import { prisma } from '../lib/prisma.js'

const DAILY_FINE_VALUE = 2.5

async function generateFines() {
  const today = new Date()

  const overdueLoans = await prisma.loan.findMany({
    where: {
      status: 'Atrasado',
      returnedAt: null,
      fines: { none: {} }
    },
    include: { user: true }
  })

  for (const loan of overdueLoans) {
    const dueDate = new Date(loan.expectedReturnDate)
    const daysLate = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24))

    if (daysLate > 0) {
      const fineAmount = parseFloat((daysLate * DAILY_FINE_VALUE).toFixed(2))

      await prisma.fine.create({
        data: {
          userId: loan.userId,
          loanId: loan.id,
          amount: fineAmount
        }
      })

      console.log(
        `Multa de R$ ${fineAmount} gerada para usuário ${loan.user.name} (empréstimo #${loan.id})`
      )
    }
  }
}

cron.schedule('0 0 * * *', async () => {
  console.log('Rodando script automático de geração de multas...')
  try {
    await generateFines()
    console.log('Script de multas finalizado com sucesso.')
  } catch (err) {
    console.error('Erro ao gerar multas:', err)
  }
})