package com.devprep.api.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Never delete external objects or publish an index mutation before DB commit.
 * Best effort only: this is NOT a durable outbox. Failed index operations need reindexing;
 * orphaned media is handled by the existing maintenance job.
 */
@Slf4j
public final class AfterCommit {
    private AfterCommit() {}
    public static void run(Runnable action) {
        if (!TransactionSynchronizationManager.isActualTransactionActive()
                || !TransactionSynchronizationManager.isSynchronizationActive()) {
            action.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                try { action.run(); }
                catch (RuntimeException e) {
                    // The commit already happened. Do not tell the caller that the DB write failed.
                    log.error("Post-commit side effect failed; reconciliation required: {}", e.getClass().getSimpleName());
                }
            }
        });
    }
}
