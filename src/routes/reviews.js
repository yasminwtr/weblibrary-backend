import { prisma } from '../lib/prisma.js'
import { verifyUser } from '../services/verifyUser.js';
import Joi from 'joi'

export async function bookReviewsRoutes(fastify) {
    // pegar todas as reviews de um livro
    fastify.get('/bookreviews/:id', async (request, reply) => {
        const { page = 1, limit = 25 } = request.query

        const pageNumber = Number(page)
        const limitNumber = Number(limit)

        const reviews = await prisma.review.findMany({
            where: {
                bookId: Number(request.params.id)
            },
            skip: (pageNumber - 1) * limitNumber,
            take: limitNumber,
            include: {
                user: {
                    select: { id: true, name: true }
                }
            },
        })

        const totalBookReviews = await prisma.review.count({
            where: {
                bookId: Number(request.params.id)
            },
        })

        const formattedReviews = reviews.map(review => ({
            id: review.id,
            userId: review.user.id,
            userName: review.user.name,
            bookId: review.bookId,
            rating: review.rating,
            comment: review.comment,
            createdAt: new Date(review.createdAt).toLocaleDateString('pt-BR'),
        }))

        return reply.status(200).send({
            reviews: formattedReviews,
            totalBookReviews,
            page: pageNumber,
            totalPages: Math.ceil(totalBookReviews / limitNumber)
        })
    })

    // criar review
    fastify.post('/bookreviews', { preHandler: verifyUser }, async (request, reply) => {
        const { userId } = request.user;

        const bodySchema = Joi.object({
            bookId: Joi.number().integer().required(),
            comment: Joi.string().allow('', null), 
        })

        const { error, value } = bodySchema.validate(request.body)

        if (error) {
            return reply.status(400).send({ error: error.details[0].message })
        }

        const { bookId, comment } = value

        try {
            const newReview = await prisma.review.create({
                data: {
                    userId,
                    bookId,
                    rating: 5,
                    comment,
                    createdAt: new Date()
                }
            })

            return reply.status(201).send(newReview)
        } catch (err) {
            if (err.code === 'P2002') {
                return reply.status(409).send({ error: 'Você já fez uma avaliação para esse livro.' })
            }

            console.error(err)
            return reply.status(500).send({ error: 'Failed to create review' })
        }
    })

    // deletar review
    fastify.delete('/bookreviews/:id', { preHandler: verifyUser }, async (request, reply) => {
        const paramsSchema = Joi.object({
            id: Joi.number().integer().required(),
        })

        const { error, value } = paramsSchema.validate(request.params)

        if (error) {
            return reply.status(400).send({ error: error.details[0].message })
        }

        const { id } = value

        try {
            await prisma.review.delete({
                where: { id },
            })

            return reply.status(204).send()
        } catch (err) {
            console.error(err)
            return reply.status(404).send({ error: 'Review not found' })
        }
    })
}