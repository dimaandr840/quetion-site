package com.devprep.api.service;

import com.devprep.api.domain.Question;
import com.devprep.api.repository.CategoryRepository;
import com.devprep.api.repository.QuestionRepository;
import com.devprep.api.web.dto.QuestionDetailDto;
import com.devprep.api.web.dto.QuestionSummaryDto;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Повторяет getQuestions/getQuestion/getPopularQuestions/getQuestionsByCategory/
 * getRelatedQuestions/getSiblingQuestions из lib/queries.ts.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class QuestionService {

    private static final int DEFAULT_POPULAR_LIMIT = 5;
    private static final int DEFAULT_RELATED_LIMIT = 3;

    private final QuestionRepository questionRepository;
    private final CategoryRepository categoryRepository;
    private final ContentMapper mapper;

    public List<QuestionSummaryDto> getQuestions() {
        return questionRepository.findByPublishedTrueOrderByIdAsc().stream()
                .map(mapper::toSummary)
                .toList();
    }

    public List<QuestionSummaryDto> getPopularQuestions(Integer limit) {
        int effective = limit == null || limit <= 0 ? DEFAULT_POPULAR_LIMIT : limit;
        return questionRepository
                .findByPopularTrueAndPublishedTrueOrderByIdAsc(PageRequest.of(0, effective))
                .stream()
                .map(mapper::toSummary)
                .toList();
    }

    public List<QuestionSummaryDto> getQuestionsByCategory(
            String professionSlug, String categorySlug) {
        if (categoryRepository.findByProfessionSlugAndSlug(professionSlug, categorySlug).isEmpty()) {
            throw ResourceNotFoundException.category(professionSlug, categorySlug);
        }
        return questionRepository
                .findByProfessionSlugAndCategorySlugAndPublishedTrueOrderByIdAsc(
                        professionSlug, categorySlug)
                .stream()
                .map(mapper::toSummary)
                .toList();
    }

    public QuestionDetailDto getQuestion(String slug) {
        Question question =
                questionRepository
                        .findWithAnswerBySlug(slug)
                        .filter(Question::isPublished)
                        .orElseThrow(() -> ResourceNotFoundException.question(slug));

        List<QuestionSummaryDto> related = related(question, DEFAULT_RELATED_LIMIT);
        List<Question> siblings =
                questionRepository.findByProfessionSlugAndCategorySlugAndPublishedTrueOrderByIdAsc(
                        question.getProfession().getSlug(), question.getCategory().getSlug());

        int index = indexOf(siblings, question.getSlug());
        QuestionSummaryDto previous =
                index > 0 ? mapper.toSummary(siblings.get(index - 1)) : null;
        QuestionSummaryDto next =
                index >= 0 && index < siblings.size() - 1
                        ? mapper.toSummary(siblings.get(index + 1))
                        : null;

        return mapper.toDetail(question, related, previous, next);
    }

    public List<QuestionSummaryDto> getRelatedQuestions(String slug, Integer limit) {
        Question question =
                questionRepository
                        .findBySlug(slug)
                        .filter(Question::isPublished)
                        .orElseThrow(() -> ResourceNotFoundException.question(slug));
        return related(question, limit == null || limit <= 0 ? DEFAULT_RELATED_LIMIT : limit);
    }

    /**
     * Скоринг как во фронтенде: та же категория +2, каждый общий тег +1, та же профессия +1;
     * сам вопрос исключается, нулевые совпадения отбрасываются.
     */
    private List<QuestionSummaryDto> related(Question question, int limit) {
        Set<String> tags = question.getTags();
        String professionSlug = question.getProfession().getSlug();
        String categorySlug = question.getCategory().getSlug();

        record Scored(Question question, int score) {}

        return questionRepository.findByPublishedTrueOrderByIdAsc().stream()
                .filter(other -> !other.getSlug().equals(question.getSlug()))
                .map(
                        other -> {
                            int score = 0;
                            if (other.getCategory().getSlug().equals(categorySlug)) {
                                score += 2;
                            }
                            if (other.getProfession().getSlug().equals(professionSlug)) {
                                score += 1;
                            }
                            for (String tag : other.getTags()) {
                                if (tags.contains(tag)) {
                                    score += 1;
                                }
                            }
                            return new Scored(other, score);
                        })
                .filter(scored -> scored.score() > 0)
                .sorted(Comparator.comparingInt(Scored::score).reversed())
                .limit(limit)
                .map(scored -> mapper.toSummary(scored.question()))
                .toList();
    }

    private static int indexOf(List<Question> questions, String slug) {
        for (int i = 0; i < questions.size(); i++) {
            if (questions.get(i).getSlug().equals(slug)) {
                return i;
            }
        }
        return -1;
    }
}
