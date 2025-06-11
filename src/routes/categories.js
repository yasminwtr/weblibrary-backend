import { prisma } from '../lib/prisma.js'
import { verifyUser } from '../services/verifyUser.js';
import Joi from 'joi'

export async function categoryRoutes(fastify) {
    // pegar todas as categorias
    fastify.get('/categories', { preHandler: verifyUser }, async (request, reply) => {
        const categories = await prisma.category.findMany()

        return reply.status(200).send(categories)
    })

    // criar categoria
    fastify.post('/categories', { preHandler: verifyUser }, async (request, reply) => {
        const bodySchema = Joi.object({
            name: Joi.string().required(),
        })

        const { error, value } = bodySchema.validate(request.body)

        if (error) {
            return reply.status(400).send({ error: error.details[0].message })
        }

        const { name } = value

        try {
            const newCategory = await prisma.category.create({
                data: { name },
            })

            return reply.status(201).send(newCategory)
        } catch (err) {
            if (err.code === 'P2002') {
                return reply.status(409).send({ error: 'Category already exists' })
            }

            console.error(err)
            return reply.status(500).send({ error: 'Failed to create category' })
        }
    })

    // atualizar categoria
    fastify.put('/categories/:id', { preHandler: verifyUser }, async (request, reply) => {
        const paramsSchema = Joi.object({
            id: Joi.number().integer().required(),
        })

        const bodySchema = Joi.object({
            name: Joi.string().required(),
        })

        const { error: paramsError, value: paramsValue } = paramsSchema.validate(request.params)
        const { error: bodyError, value: bodyValue } = bodySchema.validate(request.body)

        if (paramsError || bodyError) {
            return reply.status(400).send({ error: (paramsError || bodyError).details[0].message })
        }

        const { id } = paramsValue
        const { name } = bodyValue

        try {
            const updatedCategory = await prisma.category.update({
                where: { id },
                data: { name },
            })

            return reply.status(200).send(updatedCategory)
        } catch (err) {
            console.error(err)
            return reply.status(404).send({ error: 'Category not found' })
        }
    })

    // deletar uma categoria
    fastify.delete('/categories/:id', { preHandler: verifyUser }, async (request, reply) => {
        const paramsSchema = Joi.object({
            id: Joi.number().integer().required(),
        })

        const { error, value } = paramsSchema.validate(request.params)

        if (error) {
            return reply.status(400).send({ error: error.details[0].message })
        }

        const { id } = value

        try {
            await prisma.category.delete({
                where: { id },
            })

            return reply.status(204).send()
        } catch (err) {
            console.error(err)
            return reply.status(404).send({ error: 'Category not found' })
        }
    })
}