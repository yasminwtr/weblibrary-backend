import { prisma } from '../lib/prisma.js'
import { saveImage } from '../services/saveImage.js';
import Joi from 'joi'

export async function bookRoutes(fastify) {
    // pegar todos os livros
    fastify.get('/books', async (request, reply) => {
        const { page = 1, limit = 25, search, category } = request.query

        const pageNumber = Number(page)
        const limitNumber = Number(limit)

        const filters = {};

        if (search) {
            filters.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { author: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (category) {
            filters.categories = {
                some: {
                    name: {
                        equals: category,
                        mode: 'insensitive',
                    },
                },
            };
        }

        const books = await prisma.book.findMany({
            skip: (pageNumber - 1) * limitNumber,
            take: limitNumber,
            where: filters,
            include: {
                categories: {
                    select: { id: true }
                }
            },
        })

        const booksWithCategoryFormated = books.map(book => ({
            ...book,
            categories: book.categories.map(cat => cat.id)
        }))

        const availableCategories = await prisma.category.findMany({
            where: {
                books: {
                    some: {
                        id: {
                            in: books.map((book) => book.id),
                        },
                    },
                },
            },
            select: {
                name: true,
                id: true,
            },
        })

        const availableYears = [...new Set(books.map((book) => book.year))]

        const totalBooks = await prisma.book.count()

        return reply.status(200).send({
            books: booksWithCategoryFormated,
            totalBooks,
            availableCategories,
            availableYears,
            page: pageNumber,
            totalPages: Math.ceil(totalBooks / limitNumber)
        })
    })

    // pegar livro por id
    fastify.get('/books/:id', async (request, reply) => {
        const getBookIdSchema = Joi.object({
            id: Joi.number().integer().required(),
        })

        const { error, value } = getBookIdSchema.validate(request.params)

        if (error) {
            return reply.status(400).send({ error: error.details[0].message })
        }

        const { id } = value

        const book = await prisma.book.findUnique({
            where: { id: id },
        })

        if (!book) {
            return reply.status(404).send({ error: 'Book not found' })
        }

        return reply.status(200).send(book)
    })

    // verificar disponibilidade do livro
    fastify.get('/books/:id/availability', async (request, reply) => {
        const getBookIdSchema = Joi.object({
            id: Joi.number().integer().required(),
        })

        const { error, value } = getBookIdSchema.validate(request.params)

        if (error) {
            return reply.status(400).send({ error: error.details[0].message })
        }

        const { id } = value

        const book = await prisma.book.findUnique({
            where: { id },
            select: { totalCopies: true },
        })

        if (!book) {
            return reply.status(404).send({ error: 'Book not found' })
        }

        const activeLoans = await prisma.loan.count({
            where: {
                bookId: id,
                status: { in: ['Ativo', 'Atrasado'] },
            },
        })

        const activeReservations = await prisma.reservation.count({
            where: {
                bookId: id,
                status: 'Pendente',
            },
        })

        const availableCopies = book.totalCopies - (activeLoans + activeReservations)

        return reply.status(200).send({
            availableCopies: Math.max(availableCopies, 0),
        })
    })

    // criar livro
    fastify.post('/books', async (request, reply) => {
        const parts = request.parts();
        const data = {};
        let categoriesList = [];

        for await (const part of parts) {
            if (part.type === 'file' && part.fieldname === 'image') {
                const imagePath = await saveImage(part);
                data.image = imagePath;

            } else if (part.type === 'field') {
                if (part.fieldname === 'categories') {
                    try {
                        const parsed = JSON.parse(part.value);
                        if (Array.isArray(parsed)) {
                            categoriesList = parsed.map(Number);
                        }
                    } catch {
                        categoriesList = part.value.split(',').map(Number);
                    }
                } else {
                    data[part.fieldname] = part.value;
                }
            }
        }

        data.categories = categoriesList;

        const bodySchema = Joi.object({
            title: Joi.string().required(),
            author: Joi.string().required(),
            publisher: Joi.string().required(),
            year: Joi.number().integer().required(),
            synopsis: Joi.string().required(),
            totalCopies: Joi.number().integer().required(),
            categories: Joi.array().items(Joi.number().integer()).default([]),
            image: Joi.string().required()
        })

        const { error, value } = bodySchema.validate(data)

        if (error) {
            return reply.status(400).send({ error: error.details[0].message })
        }

        const { categories = [], ...bookData } = value;

        try {
            const newBook = await prisma.book.create({
                data: {
                    ...bookData,
                    categories: {
                        connect: categories.map(id => ({ id }))
                    }
                },
                include: {
                    categories: { select: { id: true } }
                }
            })

            const formattedBook = {
                ...newBook,
                categories: newBook.categories.map(cat => cat.id)
            }

            return reply.status(201).send(formattedBook)

        } catch (err) {
            console.error(err)
            return reply.status(500).send({ error: 'Erro ao criar o livro' })
        }
    })

    // editar livro
    fastify.patch('/books/:id', async (request, reply) => {
        const paramsSchema = Joi.object({
            id: Joi.number().integer().required(),
        });

        const { error: paramsError, value: paramsValue } = paramsSchema.validate(request.params);
        if (paramsError) {
            return reply.status(400).send({ error: paramsError.details[0].message });
        }

        const { id } = paramsValue;

        const parts = request.parts();
        const data = {};
        let categoriesList = [];

        for await (const part of parts) {
            if (part.type === 'file' && part.fieldname === 'image') {
                const imagePath = await saveImage(part);
                data.image = imagePath;

            } else if (part.type === 'field') {
                if (part.fieldname === 'categories') {
                    try {
                        const parsed = JSON.parse(part.value);
                        if (Array.isArray(parsed)) {
                            categoriesList = parsed.map(Number);
                        }
                    } catch {
                        categoriesList = part.value.split(',').map(Number);
                    }
                } else {
                    data[part.fieldname] = part.value;
                }
            }
        }

        if (categoriesList.length) {
            data.categories = categoriesList;
        }

        const bodySchema = Joi.object({
            title: Joi.string().optional(),
            author: Joi.string().optional(),
            publisher: Joi.string().optional(),
            year: Joi.number().integer().optional(),
            synopsis: Joi.string().optional(),
            totalCopies: Joi.number().integer().optional(),
            image: Joi.string().optional(),
            categories: Joi.array().items(Joi.number().integer()).optional()
        }).min(1);

        const { error: bodyError, value: bodyValue } = bodySchema.validate(data);

        if (bodyError) {
            return reply.status(400).send({ error: bodyError.details[0].message });
        }

        try {
            const updatedBook = await prisma.book.update({
                where: { id },
                data: {
                    ...bodyValue,
                    categories: bodyValue.categories
                        ? { set: bodyValue.categories.map((id) => ({ id })) }
                        : undefined
                },
                include: {
                    categories: { select: { id: true } }
                }
            });

            const formattedBook = {
                ...updatedBook,
                categories: updatedBook.categories.map((cat) => cat.id)
            };

            return reply.status(200).send(formattedBook);

        } catch (err) {
            return reply.status(404).send({ error: 'Livro não encontrado ou erro ao atualizar' });
        }
    });

    // deletar livro
    fastify.delete('/books/:id', async (request, reply) => {
        const paramsSchema = Joi.object({
            id: Joi.number().integer().required(),
        })

        const { error, value } = paramsSchema.validate(request.params)

        if (error) {
            return reply.status(400).send({ error: error.details[0].message })
        }

        const { id } = value

        try {
            await prisma.book.delete({
                where: { id },
            })

            return reply.status(204).send()
        } catch (error) {
            return reply.status(404).send({ error: 'Book not found' })
        }
    })

}