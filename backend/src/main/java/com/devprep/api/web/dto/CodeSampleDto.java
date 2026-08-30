package com.devprep.api.web.dto;

import java.util.List;

public record CodeSampleDto(String language, String title, List<String> lines) {}
