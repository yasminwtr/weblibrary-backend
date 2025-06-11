import { prisma } from '../lib/prisma.js'
import { verifyUser } from '../services/verifyUser.js';
import Joi from 'joi'
import { format } from 'date-fns';

export async function fineRoutes(fastify) {
    // pegar todas as multas
    fastify.get('/fines', async (request, reply) => {
        const fines = await prisma.fine.findMany({
            include: {
                user: { select: { id: true, name: true } },
                loan: { select: { id: true, bookId: true } }
            }
        })

        return reply.status(200).send(fines)
    })

    // pegar multas por emprestimo
    fastify.get('/loans/:id/fines', { preHandler: verifyUser }, async (request, reply) => {
        const paramsSchema = Joi.object({
            id: Joi.number().integer().required()
        })

        const { error, value } = paramsSchema.validate(request.params)

        if (error) {
            return reply.status(400).send({ error: error.details[0].message })
        }

        const { id } = value

        const fines = await prisma.fine.findMany({
            where: { loanId: id },
            orderBy: { createdAt: 'desc' },
        })

        const formattedFines = [
            ...fines.map(fine => ({
                id: fine.id,
                amount: `R$ ${fine.amount.toFixed(2).replace('.', ',')}`,
                createdAt: format(new Date(fine.createdAt), 'dd/MM/yyyy')
            }))
        ];

        return reply.status(200).send(formattedFines)
    })
}
