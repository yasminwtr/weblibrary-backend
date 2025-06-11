import { prisma } from '../lib/prisma.js'
import { authenticateUser } from '../services/authService.js'
import Joi from 'joi'

export async function auth(fastify) {
    fastify.post('/auth', async (request, reply) => {
        const userSchema = Joi.object({
            email: Joi.string().email().required(),
            password: Joi.string().min(1).required(),
        })

        const { error, value } = userSchema.validate(request.body)

        if (error) {
            return reply.status(400).send({ error: error.details[0].message })
        }

        const { email, password } = value

        try {
            const user = await authenticateUser(email, password);
    
            const token = fastify.jwt.sign(
                {
                    userId: user.id,
                    email: user.email,
                    name: user.name,
                    userType: user.userType
                },
                { expiresIn: '3h' }
            );
    
            return reply.status(201).send({ token })
            
        } catch (err) {
            return reply.status(400).send({ error: err.message })
        }
    })

    fastify.get('/verifytoken', async (request, reply) => {
        try {
            await request.jwtVerify()
            const user = request.user

            return reply.send(user)

        } catch (err) {
            return reply.status(401).send({ error: 'Token inválido ou expirado' })
        }
    })
}