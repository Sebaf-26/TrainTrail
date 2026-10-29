-- CreateTable
CREATE TABLE "journey_ticket" (
    "id" SERIAL NOT NULL,
    "journey_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "barcode_format" TEXT NOT NULL,
    "barcode_data" TEXT NOT NULL,
    "passenger_name" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journey_ticket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "journey_ticket_journey_id_user_id_key" ON "journey_ticket"("journey_id", "user_id");

-- AddForeignKey
ALTER TABLE "journey_ticket" ADD CONSTRAINT "journey_ticket_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_ticket" ADD CONSTRAINT "journey_ticket_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Constraints that Prisma cannot express
ALTER TABLE "journey_ticket"
  ADD CONSTRAINT "journey_ticket_barcode_format_check"
    CHECK ("barcode_format" IN ('aztec', 'qr', 'pdf417', 'code128'));
