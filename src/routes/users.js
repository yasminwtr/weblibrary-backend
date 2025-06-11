import { prisma } from '../lib/prisma.js'
import { verifyUser } from '../services/verifyUser.js';
import Joi from 'joi'

export async function userRoutes(fastify) {
    // criar usuario
    fastify.post('/users', { preHandler: verifyUser }, async (request, reply) => {
        const userSchema = Joi.object({
            email: Joi.string().email().required(),
            password: Joi.string().min(1).required(),
            name: Joi.string().min(1).required(),
            userType: Joi.string().valid('librarian', 'reader').required(),
        })

        const { error, value } = userSchema.validate(request.body)

        if (error) {
            return reply.status(400).send({ error: error.details[0].message })
        }

        const { email, password, name, userType } = value

        const user = await prisma.users.create({
            data: {
                email,
                password,
                name,
                userType,
            },
        })

        return reply.status(201).send({ userId: user.id })
    })

    // pegar todos os usuarios
    fastify.get('/users', { preHandler: verifyUser }, async (request, reply) => {
        const { userType } = request.user;

        if (userType !== 'librarian') {
            return reply.status(403).send({ error: 'Acesso negado. Somente bibliotecários podem acessar esta rota.' });
        }

        const users = await prisma.users.findMany()
        return reply.status(200).send(users)
    })

    // pegar usuário por id
    fastify.get('/users/:id', { preHandler: verifyUser }, async (request, reply) => {
        const getUserIdSchema = Joi.object({
            id: Joi.number().integer().required(),
        })

        const { error, value } = getUserIdSchema.validate(request.params)

        if (error) {
            return reply.status(400).send({ error: error.details[0].message })
        }

        const { id } = value

        const user = await prisma.users.findUnique({
            where: { id: id },
        })

        if (!user) {
            return reply.status(404).send({ error: 'User not found' })
        }

        return reply.status(200).send(user)
    })

    fastify.patch('/users/:id', { preHandler: verifyUser }, async (request, reply) => {
        const getUserIdSchema = Joi.object({
            id: Joi.number().integer().required(),
        });

        const updateUserSchema = Joi.object({
            name: Joi.string().min(1).optional(),
            email: Joi.string().email().optional(),
        }).or('name', 'email'); 

        const { error: idError, value: idValue } = getUserIdSchema.validate(request.params);
        if (idError) {
            return reply.status(400).send({ error: idError.details[0].message });
        }

        const { error: bodyError, value: updateData } = updateUserSchema.validate(request.body);
        if (bodyError) {
            return reply.status(400).send({ error: bodyError.details[0].message });
        }

        const { id } = idValue;

        const user = await prisma.users.findUnique({ where: { id } });
        if (!user) {
            return reply.status(404).send({ error: 'Usuário não encontrado' });
        }

        const updated = await prisma.users.update({
            where: { id },
            data: updateData,
        });

        return reply.status(200).send(updated);
    });
}