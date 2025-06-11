import { prisma } from '../lib/prisma.js'
import { verifyUser } from '../services/verifyUser.js';
import { format } from 'date-fns';
import Joi from 'joi'

export async function loanRoutes(fastify) {
    // pegar todos os empréstimos
    fastify.get('/loans', { preHandler: verifyUser }, async (request, reply) => {
        const { userType } = request.user;

        if (userType !== 'librarian') {
            return reply.status(403).send({ error: 'Acesso negado. Somente bibliotecários podem acessar esta rota.' });
        }

        const loans = await prisma.loan.findMany({
            include: {
                user: { select: { id: true, name: true, email: true } },
                book: { select: { id: true, title: true, author: true } },
                fines: true
            },
            orderBy: { createdAt: 'desc' }
        })

        const formattedLoans = [
            ...loans.map(loan => ({
                id: loan.id,
                userId: loan.userId,
                userName: loan.user.name,
                userEmail: loan.user.email,
                bookTitle: loan.book.title,
                bookAuthor: loan.book.author,
                createdAt: format(new Date(loan.createdAt), 'dd/MM/yyyy'),
                dueDate: loan.dueDate ? format(new Date(loan.dueDate), 'dd/MM/yyyy') : null,
                returnedAt: loan.returnedAt ? format(new Date(loan.returnedAt), 'dd/MM/yyyy') : null,
                status: loan.status,
                hasFines: loan.fines.length > 0,
            }))
        ];

        return reply.status(200).send(formattedLoans)
    })

    // pegar empréstimos por usuário
    fastify.get('/users/loans', { preHandler: verifyUser }, async (request, reply) => {
        const { userId } = request.user;

        const loans = await prisma.loan.findMany({
            where: { userId },
            include: {
                book: { select: { id: true, title: true } }
            }
        })

        return reply.status(200).send(loans)
    })


    // concluir emprestimo
    fastify.patch('/loans/:id/conclude', async (request, reply) => {
        const paramsSchema = Joi.object({
            id: Joi.number().integer().required()
        })

        const { error, value } = paramsSchema.validate(request.params)

        if (error) {
            return reply.status(400).send({ error: error.details[0].message })
        }

        const { id } = value

        try {
            const updatedLoan = await prisma.loan.update({
                where: { id },
                data: { status: 'Concluído' },
            })

            return reply.status(200).send(updatedLoan)

        } catch (err) {
            console.error(err)
            return reply.status(404).send({ error: 'Erro ao concluir empréstimo' })
        }
    })
}
