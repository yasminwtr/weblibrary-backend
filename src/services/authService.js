import { prisma } from '../lib/prisma.js'

export async function authenticateUser(email, password) {
    const user = await prisma.users.findUnique({
        where: { email },
    });

    if (!user || password !== user.password) {
        throw new Error("Verifique suas credenciais.");
    }

    return user;
}