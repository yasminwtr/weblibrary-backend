/*
  Warnings:

  - You are about to drop the column `paid` on the `Fine` table. All the data in the column will be lost.
  - Added the required column `image` to the `Book` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "image" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Fine" DROP COLUMN "paid";
