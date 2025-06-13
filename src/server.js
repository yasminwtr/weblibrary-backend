import Fastify from 'fastify'
import fastifyJwt from '@fastify/jwt'
import cors from '@fastify/cors'
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url'
import { auth } from './routes/auth.js'
import { userRoutes } from './routes/users.js'
import { bookRoutes } from './routes/books.js'
import { categoryRoutes } from './routes/categories.js'
import { fineRoutes } from './routes/fines.js'
import { loanRoutes } from './routes/loans.js'
import { reservationRoutes } from './routes/reservations.js'
import { bookReviewsRoutes } from './routes/reviews.js'
import './services/generateFines.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const fastify = Fastify({
    logger: true
})

fastify.register(cors, {
    origin: ['https://weblibrary-frontend.vercel.app'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
})

fastify.register(fastifyCookie);
fastify.register(fastifyMultipart);
fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'uploads'), 
  prefix: '/uploads/', 
});

fastify.register(fastifyJwt, {
    secret: 'JVtpxe7ftgeLQrsleRGY3c9YDldWFyuf'
});

fastify.register(auth);
fastify.register(userRoutes);
fastify.register(bookRoutes);
fastify.register(categoryRoutes);
fastify.register(fineRoutes);
fastify.register(loanRoutes);
fastify.register(reservationRoutes);
fastify.register(bookReviewsRoutes);

fastify.listen({ port: 3001, host: '0.0.0.0' }).then(() => {
    console.log('Server is running')
})