-- Defense-in-depth: the application already guards every debit with an
-- atomic `updateMany` + `balance: { gte: amount }` conditional update, but
-- this CHECK makes a negative balance impossible at the database level too,
-- independent of application logic. Not representable in schema.prisma
-- (Prisma has no CHECK constraint syntax), so this migration is
-- hand-written and carries no corresponding schema diff.
ALTER TABLE "UserBalance" ADD CONSTRAINT "UserBalance_balance_non_negative" CHECK ("balance" >= 0);
