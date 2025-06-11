import { prisma } from '../lib/prisma.js'
import { verifyUser } from '../services/verifyUser.js';
import { format } from 'date-fns';
import Joi from 'joi'

export async function reservationRoutes(fastify) {
    // pegar todas as reservas
    fastify.get('/reservations', { preHandler: verifyUser }, async (request, reply) => {
        const { userType } = request.user;

        if (userType !== 'librarian') {
            return reply.status(403).send({ error: 'Acesso negado. Somente bibliotecários podem acessar esta rota.' });
        }

        const reservations = await prisma.reservation.findMany({
            include: {
                user: { select: { id: true, name: true, email: true } },
                book: { select: { id: true, title: true, author: true } }
            },
            orderBy: { createdAt: 'desc' }
        })

        const formattedReservations = [
            ...reservations.map(reservation => ({
                id: reservation.id,
                userId: reservation.userId,
                userName: reservation.user.name,
                userEmail: reservation.user.email,
                bookId: reservation.book.id,
                bookTitle: reservation.book.title,
                bookAuthor: reservation.book.author,
                createdAt: format(new Date(reservation.createdAt), 'dd/MM/yyyy'),
                expiresAt: reservation.expiresAt ? format(new Date(reservation.expiresAt), 'dd/MM/yyyy') : null,
                status: reservation.status
            }))
        ];

        return reply.status(200).send(formattedReservations)
    })

    // criar reserva
    fastify.post('/reservations', { preHandler: verifyUser }, async (request, reply) => {
        const { userId } = request.user;

        const bodySchema = Joi.object({
            bookId: Joi.number().integer().required()
        });

        const { error, value } = bodySchema.validate(request.body);

        if (error) {
            return reply.status(400).send({ error: error.details[0].message });
        }

        const { bookId } = value;

        try {
            // verificando se ja existe uma reserva pendente para o mesmo usuário e livro
            const existingReservation = await prisma.reservation.findFirst({
                where: {
                    userId,
                    bookId,
                    status: 'Pendente',
                },
            });

            if (existingReservation) {
                return reply.status(409).send({ error: 'Você já possui uma reserva pendente para este livro.' });
            }

            // verificando se ja existe um emprestimo ativo ou atrasado para o mesmo usuário e livro
            const existingLoan = await prisma.loan.findFirst({
                where: {
                    userId,
                    bookId,
                    status: {
                        in: ['Ativo', 'Atrasado'],
                    },
                },
            });

            if (existingLoan) {
                return reply.status(409).send({ error: 'Você possui um empréstimo ativo ou atrasado deste livro, não é possível reservá-lo até que o empréstimo anterior seja concluído.' });
            }

            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 3)

            // se td certo finalmente criando a reserva
            const newReservation = await prisma.reservation.create({
                data: {
                    userId,
                    bookId,
                    expiresAt: expiresAt,
                    status: 'Pendente',
                },
            });

            return reply.status(201).send(newReservation);
        } catch (err) {
            console.error(err);
            return reply.status(500).send({ error: 'Erro ao criar reserva.' });
        }
    });

    // cancelar reserva 
    fastify.patch('/reservations/:id/cancel', async (request, reply) => {
        const paramsSchema = Joi.object({
            id: Joi.number().integer().required()
        })

        const { error, value } = paramsSchema.validate(request.params)

        if (error) {
            return reply.status(400).send({ error: error.details[0].message })
        }

        const { id } = params

        try {
            const canceledReservation = await prisma.reservation.update({
                where: { id },
                data: { status: 'Cancelada' },
            })

            return reply.status(200).send(canceledReservation)

        } catch (err) {
            console.error(err)
            return reply.status(404).send({ error: 'Erro ao dar update no status da reserva' })
        }
    })

    // concluir reserva e criar empréstimo
    fastify.patch('/reservations/:id/conclude', async (request, reply) => {
        const paramsSchema = Joi.object({
            id: Joi.number().integer().required()
        })

        const bodySchema = Joi.object({
            userId: Joi.number().integer().required(),
            bookId: Joi.number().integer().required()
        })

        const { error: paramsError, value: params } = paramsSchema.validate(request.params)
        const { error: bodyError, value: body } = bodySchema.validate(request.body)

        if (paramsError) {
            return reply.status(400).send({ error: paramsError.details[0].message })
        }

        if (bodyError) {
            return reply.status(400).send({ error: bodyError.details[0].message })
        }

        const { id } = params
        const { userId, bookId } = body
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14)

        try {
            const result = await prisma.$transaction(async (tx) => {
                const updatedReservation = await tx.reservation.update({
                    where: { id },
                    data: { status: 'Concluída' },
                })

                const newLoan = await tx.loan.create({
                    data: {
                        userId,
                        bookId,
                        dueDate,
                        status: 'Ativo'
                    }
                })

                return { updatedReservation, newLoan }
            })

            return reply.status(200).send(result)
        } catch (err) {
            console.error(err)
            return reply.status(500).send({ error: 'Erro ao concluir reserva e criar empréstimo' })
        }
    })

    // pegar reservas por usuário
    fastify.get('/users/reservations', { preHandler: verifyUser }, async (request, reply) => {
        const { userType } = request.user;

        if (userType !== 'reader') {
            return reply.status(403).send({ error: 'Acesso negado. Somente usuários podem acessar esta rota.' });
        }

        const { userId } = request.user;

        const reservations = await prisma.reservation.findMany({
            where: { userId },
            include: {
                book: { select: { id: true, title: true } }
            }
        });

        return reply.status(200).send(reservations);
    });

    fastify.get('/users/reservations-and-loans', { preHandler: verifyUser }, async (request, reply) => {
        const { userId } = request.user;

        try {
            const reservations = await prisma.reservation.findMany({
                where: {
                    userId,
                },
                orderBy: {
                    createdAt: 'desc',
                },
                include: {
                    book: {
                        select: {
                            title: true,
                            author: true,
                        },
                    },
                },
            });

            const loans = await prisma.loan.findMany({
                where: {
                    userId,
                },
                orderBy: {
                    createdAt: 'desc',
                },
                include: {
                    fines: true,
                    book: {
                        select: {
                            title: true,
                            author: true,
                        },
                    },
                },
            });

            const allItems = [
                ...reservations.map(reservation => ({
                    type: 'reservation',
                    id: reservation.id,
                    userId: reservation.userId,
                    bookTitle: reservation.book.title,
                    bookAuthor: reservation.book.author,
                    createdAt: format(new Date(reservation.createdAt), 'dd/MM/yyyy'),
                    expiresAt: reservation.expiresAt ? format(new Date(reservation.expiresAt), 'dd/MM/yyyy') : null,
                    status: reservation.status
                })),

                ...loans.map(loan => ({
                    type: 'loan',
                    id: loan.id,
                    userId: loan.userId,
                    bookTitle: loan.book.title,
                    bookAuthor: loan.book.author,
                    createdAt: format(new Date(loan.createdAt), 'dd/MM/yyyy'),
                    dueDate: loan.dueDate ? format(new Date(loan.dueDate), 'dd/MM/yyyy') : null,
                    returnedAt: loan.returnedAt ? format(new Date(loan.returnedAt), 'dd/MM/yyyy') : null,
                    status: loan.status,
                    hasFines: loan.fines.length > 0
                })),
            ];

            allItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            return reply.status(200).send(allItems);

        } catch (err) {
            console.error(err);
            return reply.status(500).send({ error: 'Erro ao buscar reservas, empréstimos e multas.' });
        }
    });


}
