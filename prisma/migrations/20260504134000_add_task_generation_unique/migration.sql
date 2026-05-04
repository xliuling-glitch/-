-- Make generated daily tasks idempotent.
CREATE UNIQUE INDEX "Task_date_userId_type_key" ON "Task"("date", "userId", "type");
