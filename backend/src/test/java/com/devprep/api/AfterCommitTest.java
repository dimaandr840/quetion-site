package com.devprep.api;

import com.devprep.api.service.AfterCommit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class AfterCommitTest {
    @Autowired PlatformTransactionManager manager;
    @Test void rollbackNeverExecutesExternalMutation() {
        AtomicInteger calls = new AtomicInteger();
        new TransactionTemplate(manager).executeWithoutResult(tx -> {
            AfterCommit.run(calls::incrementAndGet);
            assertThat(calls.get()).isZero();
            tx.setRollbackOnly();
        });
        assertThat(calls.get()).isZero();
    }
    @Test void commitExecutesMutationOnceAfterCommit() {
        AtomicInteger calls = new AtomicInteger();
        new TransactionTemplate(manager).executeWithoutResult(tx -> {
            AfterCommit.run(calls::incrementAndGet);
            assertThat(calls.get()).isZero();
        });
        assertThat(calls.get()).isEqualTo(1);
    }
}
