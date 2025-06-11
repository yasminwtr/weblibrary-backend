import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const librarian = await prisma.users.create({
        data: {
            email: 'bibliotecario@weblibrary.com',
            password: '123',
            name: 'Usuário Bibliotecário',
            userType: 'librarian',
        },
    })

    const reader = await prisma.users.create({
        data: {
            email: 'leitor@weblibrary.com',
            password: '123',
            name: 'Usuário Leitor',
            userType: 'reader',
        },
    })

    const romanceCategory = await prisma.category.create({
        data: {
            name: 'Romance',
        },
    })

    const thrillerCategory = await prisma.category.create({
        data: {
            name: 'Suspense',
        },
    })

    const book1 = await prisma.book.create({
        data: {
            title: 'Orgulho e Preconceito',
            author: 'Jane Austen',
            publisher: 'Editora Penguin',
            year: 1813,
            image: "capa1.jpg",
            synopsis: 'Um romance clássico sobre amor, sociedade e os mal-entendidos que surgem entre eles.',
            totalCopies: 5,
            categories: {
                connect: { id: romanceCategory.id },
            },
        },
    })

    const book2 = await prisma.book.create({
        data: {
            title: 'O Homem de Giz',
            author: 'C. J. Tudor',
            publisher: 'Intrínseca',
            year: 2024,
            image: "capa2.jpg",
            synopsis: 'Um suspense envolvente onde segredos da infância voltam para assombrar um grupo de amigos.',
            totalCopies: 3,
            categories: {
                connect: { id: thrillerCategory.id },
            },
        },
    })

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 3);

    await prisma.reservation.create({
        data: {
            userId: reader.id,
            bookId: book1.id,
            status: 'Pendente',
            expiresAt: expiresAt
        },
    })

    await prisma.loan.create({
        data: {
            userId: reader.id,
            bookId: book2.id,
            dueDate: new Date('2025-04-10'),
            status: 'Ativo',
        },
    })

    await prisma.review.create({
        data: {
            userId: reader.id,
            bookId: book1.id,
            comment: 'Livro excelente!',
            createdAt: new Date(),
        },
    })
}

main()
    .then(() => {
        console.log('Seed executado com sucesso!')
        return prisma.$disconnect()
    })
    .catch((e) => {
        console.error('Erro no seed:', e)
        return prisma.$disconnect()
    })
