-- Payment feature removed: contract acceptance now settles the application
-- directly (ContractTx.MarkApplicationSettled), and managers never confirm a
-- payment. Nothing else references the payments table.
DROP TABLE payments;
DROP TYPE payment_status;
