package com.devprep.api.repository;

import com.devprep.api.domain.QuestionImage;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface QuestionImageRepository extends JpaRepository<QuestionImage, Long> {

    /**
     * Все ключи, на которые ссылается база. Нужны уборщику объектов-сирот: файл, которого нет
     * в этом списке и который старше суток, не принадлежит ни одному вопросу.
     */
    @Query("select image.storageKey from QuestionImage image")
    List<String> findAllStorageKeys();
}
