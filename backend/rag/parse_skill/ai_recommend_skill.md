---
description: Analyze document pre-parsing metrics for 知微知识库 and
  recommend RAG chunking strategy parameters, including chunk size,
  overlap, separators, element-aware handling, retrieval TopK, quality
  gates, and explanations. Use when designing or reviewing a document
  chunking recommendation workflow.
name: zh微-rag-chunking-metrics
---

# 知微知识库：文档指标分析与分块推荐 Skill

## 1. Purpose

Use this skill to turn pre-parsed document metrics into an explainable,
validated RAG chunking recommendation.

The skill must: 1. Interpret document structure and content metrics. 2.
Select a primary chunking strategy and element-specific strategies. 3.
Recommend chunk size, overlap, separators, table/image context windows,
and retrieval TopK. 4. Explain which metrics triggered each
recommendation. 5. Identify missing metrics, uncertainty, conflicts, and
validation requirements. 6. Return machine-readable JSON that can be
consumed by the backend rule engine.

Do not claim that heuristic thresholds are universal or optimal. Treat
them as configurable starting points until calibrated against real
retrieval evaluation.

## 2. Operating principles

-   **Rules constrain; the AI explains and ranks.** Do not let the model
    invent arbitrary parameter values outside configured bounds.
-   **Preserve semantic atoms.** Do not split a QA pair, code function,
    table header/body relationship, list item group, or image-caption
    relationship merely to hit a target chunk size.
-   **Separate primary strategy from element strategies.** A document
    may use `qa` as its primary strategy while using `code_aware` for
    code and `table_aware` for tables.
-   **Do not confuse preprocessing with chunking.** OCR repair,
    reading-order correction, and header/footer detection happen before
    final chunking.
-   **TopK is a retrieval parameter.** Document metrics can suggest a
    starting range, but evaluation data and context budget determine
    final values.
-   **Keep provenance.** Preserve document ID, page number, heading
    path, source span/coordinates, and element type wherever available.
-   **Make uncertainty explicit.** Missing or low-confidence metrics
    must produce warnings, not fabricated values.
-   **Do not silently discard content.** Header/footer removal must be
    evidence-based and auditable.

## 3. Input contract

Accept a JSON object containing `document`, `metrics`, optional
`retrieval_context`, and optional `constraints`.

### 3.1 Document metadata

Recommended fields:

-   `document_id`: string
-   `file_type`:
    `pdf | docx | markdown | html | txt | csv | xlsx | code | other`
-   `language`: language tag, such as `zh-CN` or `en`
-   `page_count`: integer or null
-   `total_tokens`: integer or null
-   `document_type_hint`: optional user/system hint
-   `parser_name`, `parser_version`: optional

### 3.2 Core structure metrics

  ------------------------------------------------------------------------------
  Metric                         Type / unit             Meaning
  ------------------------------ ----------------------- -----------------------
  `heading_structure`            enum: `clear`,          Whether heading
                                 `partial`, `none`,      hierarchy can be
                                 `unknown`               reliably detected

  `heading_hierarchy_coverage`   0--1                    Proportion of content
                                                         with a usable heading
                                                         path

  `heading_density`              headings per 1,000      Heading frequency;
                                 tokens or normalized    units must be
                                 0--1                    explicitly identified

  `paragraph_count`              integer                 Number of detected
                                                         paragraphs

  `avg_paragraph_tokens`         tokens                  Mean paragraph length

  `p50_paragraph_tokens`         tokens                  Median paragraph length

  `p90_paragraph_tokens`         tokens                  90th percentile
                                                         paragraph length

  `paragraph_length_cv`          non-negative number     Standard deviation /
                                                         mean of paragraph
                                                         lengths

  `long_paragraph_ratio`         0--1                    Fraction of paragraphs
                                                         exceeding a configured
                                                         length threshold

  `list_ratio`                   0--1                    Fraction of content
                                                         represented by lists

  `topic_count_estimate`         integer or null         Estimated number of
                                                         distinct topics

  `topic_switch_rate`            0--1 or documented unit Estimated frequency of
                                                         topic changes
  ------------------------------------------------------------------------------

### 3.3 Table metrics

  -------------------------------------------------------------------------------
  Metric                          Type / unit             Meaning
  ------------------------------- ----------------------- -----------------------
  `table_count`                   integer                 Detected tables

  `table_token_ratio`             0--1                    Fraction of total
                                                          tokens inside tables

  `large_table_ratio`             0--1                    Fraction of tables
                                                          exceeding configured
                                                          row/token threshold

  `table_header_detection_rate`   0--1                    Fraction of tables with
                                                          identified headers

  `table_structure_confidence`    0--1                    Confidence in
                                                          row/column
                                                          reconstruction

  `table_text_dependency`         enum: `low`, `medium`,  How much table
                                  `high`, `unknown`       interpretation depends
                                                          on nearby prose
  -------------------------------------------------------------------------------

### 3.4 Image and multimodal metrics

  --------------------------------------------------------------------------------
  Metric                           Type / unit             Meaning
  -------------------------------- ----------------------- -----------------------
  `image_count`                    integer                 Detected images/figures

  `image_density`                  0--1 or explicitly      Image density;
                                   documented rate         denominator must be
                                                           specified

  `figure_caption_coverage`        0--1                    Fraction of figures
                                                           with detected captions

  `image_text_dependency`          enum: `low`, `medium`,  Need for nearby prose
                                   `high`, `unknown`       to interpret figures

  `ocr_page_ratio`                 0--1                    Fraction of pages
                                                           requiring OCR

  `ocr_confidence`                 0--1 or null            OCR confidence, with
                                                           aggregation method
                                                           documented

  `layout_confidence`              0--1 or null            Confidence in layout
                                                           detection

  `reading_order_violation_rate`   0--1 or null            Rate of suspected
                                                           reading-order errors
  --------------------------------------------------------------------------------

### 3.5 Special-content metrics

  ---------------------------------------------------------------------------------
  Metric                            Type / unit             Meaning
  --------------------------------- ----------------------- -----------------------
  `is_qa_document`                  boolean or null         Whether the document is
                                                            primarily
                                                            question-answer content

  `qa_pair_count`                   integer or null         Number of detected QA
                                                            pairs

  `qa_pair_integrity`               0--1 or null            Confidence that
                                                            questions and answers
                                                            are correctly paired

  `qa_detection_confidence`         0--1 or null            QA classifier
                                                            confidence

  `code_ratio`                      0--1                    Fraction of content
                                                            classified as code

  `is_code_dense`                   boolean or null         Whether code density
                                                            exceeds configured
                                                            threshold

  `code_detection_confidence`       0--1 or null            Confidence in code
                                                            detection

  `function_class_detection_rate`   0--1 or null            Fraction of code with
                                                            recognized syntax
                                                            boundaries

  `formula_ratio`                   0--1 or null            Fraction of
                                                            mathematical/formula
                                                            content

  `citation_density`                0--1 or documented unit Density of
                                                            references/citations

  `boilerplate_ratio`               0--1                    Estimated fraction of
                                                            template/repeated
                                                            content
  ---------------------------------------------------------------------------------

### 3.6 Quality and retrieval context

-   `parse_quality_score`: 0--1, with documented formula
-   `header_footer_repeat_rate`: 0--1
-   `header_footer_candidate_count`: integer or null
-   `source_mapping_coverage`: 0--1 or null
-   `target_query_type`:
    `fact_lookup | semantic_qa | multi_hop | table_lookup | code_lookup | summarization | unknown`
-   `embedding_model_max_tokens`: integer or null
-   `generation_context_tokens`: integer or null
-   `reserved_prompt_tokens`: integer or null
-   `reranker_enabled`: boolean or null
-   `retrieval_eval`: optional object containing Recall@K, MRR, nDCG,
    citation accuracy, latency, and cost by candidate K.

**Metric hygiene:** all ratios must be in `[0,1]`; percentages must be
normalized to ratios before rules run. Every rate must define its
denominator. A missing value is `null`/unknown, not zero.

## 4. Initial configurable thresholds

These are starting heuristics, not universal truths. Store them in
versioned backend configuration so they can be calibrated.

``` json
{
  "thresholds": {
    "qa_confidence_min": 0.80,
    "code_confidence_min": 0.80,
    "heading_coverage_high": 0.80,
    "table_token_ratio_high": 0.15,
    "table_token_ratio_medium": 0.05,
    "image_density_high": 0.10,
    "image_density_medium": 0.03,
    "ocr_page_ratio_review": 0.10,
    "parse_quality_block": 0.50,
    "overlap_warning_percent": 20,
    "header_footer_repeat_min": 0.80
  }
}
```

The definition of `image_density` must be fixed across parsers. For
example, it may mean figures per page normalized to a bounded range, or
image tokens/regions per page; do not compare incompatible definitions.

## 5. Decision procedure

Execute in this order.

### P0 --- Validate input and parse quality

1.  Validate types, ranges, units, and required fields.
2.  If `parse_quality_score` is below `parse_quality_block`, or
    OCR/layout/reading-order metrics indicate serious corruption, set
    `status = "needs_review"` or `status = "parse_repair_required"`.
3.  Do not compensate for bad parsing by merely changing chunk size.
4.  Keep any recommendation provisional until source mapping and reading
    order are checked.

### P1 --- Identify semantic atoms and element-specific handlers

Detect and preserve, where present:

-   QA pair: keep question and answer linked.
-   Code: preserve function/class/method or syntax-node boundaries.
-   Table: preserve table identity, header, units, and row/column
    relations.
-   Figure: link caption, alt text/OCR description, and relevant nearby
    prose.
-   Contract/policy clauses: preserve article/section numbering and
    parent path.
-   Headings and lists: preserve hierarchy and list-item relationships.

Element-level handling takes precedence over generic text splitting
within that element.

### P2 --- Select primary strategy

Use confidence-aware priority, not raw booleans alone:

1.  If `is_qa_document = true` and
    `qa_detection_confidence >= qa_confidence_min`, primary strategy =
    `qa`.
2.  Otherwise, if `is_code_dense = true` and
    `code_detection_confidence >= code_confidence_min`, primary strategy
    = `code_aware`.
3.  Otherwise, if heading structure is `clear` and
    `heading_hierarchy_coverage >= heading_coverage_high`, primary
    strategy = `structure_aware`.
4.  Otherwise, use `recursive`.
5.  If document classification is mixed or uncertain, choose the safest
    general primary strategy and attach element-specific handlers for
    QA/code/table/image. Explain the conflict in `warnings`.

Do not let a secondary feature, such as a 20% table ratio, automatically
replace a well-supported QA primary strategy. Instead, activate
`table_aware` for table elements.

### P3 --- Recommend chunk size

Use a baseline based on paragraph distribution, then apply type-specific
bounds and semantic-atom constraints.

Baseline heuristic:

`base_chunk_size = clamp(2 * p50_paragraph_tokens, 256, 640)`

If `p50_paragraph_tokens` is missing, use a conservative default
(e.g. 512) and mark the recommendation as lower confidence.

Adjustments: - FAQ/QA: usually 128--350 tokens; never split a short QA
pair just to meet target size. - General prose: usually 350--550. -
Clear technical structure: usually 400--700. - Paper/report: usually
500--800. - Contract/policy: usually 350--600, respecting clause
boundaries. - Table-heavy: usually 250--500 for text chunks, but use a
dedicated table handler. - Code-heavy: usually 300--700, preserving
syntax boundaries. - OCR-heavy: start around 300--500 only after parse
quality is acceptable.

Use `p90_paragraph_tokens` to estimate oversize risk: - If P90 is at or
below target size, no increase is needed solely for paragraph length. -
If P90 exceeds target, determine whether paragraphs are semantically
atomic. Increase target size only when preserving a coherent paragraph
is beneficial and system limits allow it. - If long paragraphs mix
topics, split semantically rather than simply increasing size. - Chunk
size is a target, not a command to break atomic structures.

Enforce configured embedding/model bounds. If an atomic element exceeds
the limit, apply a type-specific splitter and emit a warning.

### P4 --- Recommend overlap

Starting ranges: - QA pairs: 0%. - Clear heading/section boundaries:
0--5%. - General continuous prose: 5--12%. - Long continuous prose with
cross-boundary references: 10--15%. - Code: 0--5%, with syntax-aware
boundaries. - Tables: prefer repeated headers and row-group context
rather than generic token overlap.

Choose the lowest overlap that protects boundary meaning. Do not
automatically add overlap to structures already kept intact. Warn when
overlap exceeds the configured normal range (initially 20%).

`overlap_tokens = floor(chunk_size * overlap_percent / 100)` is only an
approximate implementation; the actual splitter must document whether
overlap is measured in tokens, characters, or separator units.

### P5 --- Recommend separators

Separators must be strategy-specific and ordered from strongest semantic
boundary to weakest fallback.

-   `qa`: QA pair boundary → question/answer boundary → paragraph →
    sentence.
-   `structure_aware`: heading/section → paragraph → sentence.
-   `recursive`: `\n\n` → `\n` → language-specific sentence punctuation
    → whitespace/token fallback.
-   `table_aware`: table boundary → header → row group; never flatten a
    table blindly into punctuation-separated prose.
-   `code_aware`: module → class → function/method → syntax node →
    logical line.
-   `contract_aware`: chapter → article → clause → item → paragraph.
-   `paper_aware`: section → subsection → paragraph → sentence.

For Chinese prose, a practical recursive fallback may include `\n\n`,
`\n`, `。`, `！`, `？`, `；`, `，`, and whitespace. For English, include
paragraph boundaries and `.`, `!`, `?`, `;`. Do not use punctuation
splitting before structure-aware parsing.

### P6 --- Recommend table/image context windows

Initial heuristic: - Table token ratio \>= 0.15: table context window
128 tokens. - Table token ratio \>= 0.05 and \< 0.15: 64 tokens. -
Otherwise: 0 or only essential metadata. - High image density
(configured threshold, initially \>= 0.10) with meaningful
caption/nearby-text dependency: image context 96 tokens. - Medium image
density (initially \>= 0.03): 48 tokens. - Otherwise: 0 or caption-only
metadata.

These values are starting points. Preserve table headers, units,
caption, source page, and figure/table IDs as structured metadata.
Context windows should not accidentally duplicate the entire table or
image description.

### P7 --- Header/footer removal

Do not remove headers/footers solely because
`has_template_noise = true`.

Require evidence such as: - high repetition across pages (initial
starting threshold 0.80), - consistent page-edge location, - low
semantic variation, - and exclusion of meaningful identifiers.

Preserve document title, version, confidentiality marking, contract
number, policy ID, page-specific warnings, and other
business-significant text. Store raw parse output or an audit record so
removals can be reversed.

### P8 --- Recommend TopK

TopK cannot be uniquely inferred from document metrics alone.

Recommend separate parameters: - `candidate_top_k`: initial candidate
retrieval size. - `rerank_top_k`: number retained after reranking. -
`final_context_k`: chunks included in generation context.

Cold-start ranges: - FAQ: candidate 10--20, rerank 3--5, final 3--5. -
General QA: candidate 20--40, rerank 5--10, final 4--8. -
Technical/multi-hop: candidate 30--50, rerank 8--15, final 5--10. -
Table/multi-evidence: candidate 30--50, rerank 8--15, final 5--12. -
Code: candidate 20--40, rerank 5--10, final 3--8.

Adjust with measured Recall@K saturation, MRR/nDCG, citation accuracy,
latency, and context budget. If retrieval evaluation is absent, label
TopK as a cold-start recommendation.

Approximate context budget bound:

`max_context_chunks = floor((generation_context_tokens - reserved_prompt_tokens) / average_actual_chunk_tokens)`

This constrains final context count, not necessarily candidate TopK.

### P9 --- Validate and explain

Validate: - all numeric values against configured ranges; - separators
are compatible with the chosen strategy; - QA/code/table preservation
flags are consistent with element handlers; - chunk and overlap units
are explicit; - `source_mapping_coverage` is sufficient for
citation-required workflows; - header/footer removal is
evidence-backed; - final context K respects context budget; - warnings
exist for low confidence, missing metrics, oversize atomic elements, and
untested TopK.

Return parameter-specific reasons, not a single unexplained confidence
score.

## 6. Conflict priority

Use this order when recommendations conflict:

1.  Parsing quality, source integrity, and safety.
2.  Semantic atom integrity (QA, code, table, figure-caption, legal
    clause).
3.  Primary document strategy.
4.  Chunk size and separator configuration.
5.  Overlap.
6.  Retrieval TopK and context budget.
7.  Header/footer cleanup and optional enrichment.
8.  Final validation and user confirmation.

A later rule must not override a higher-priority requirement. For
example, `chunk_size=350` must not cause a QA pair or function to be
split if a type-aware alternative exists.

## 7. Output contract

Return valid JSON with this shape. Use `null` for unknown values and
provide warnings for missing data; do not fabricate metrics.

``` json
{
  "schema_version": "1.0",
  "rule_version": "chunk-advisor-1.0.0",
  "status": "recommended",
  "strategy": {
    "primary": "qa",
    "elements": {
      "code": "code_aware",
      "table": "table_aware",
      "image": "caption_linked"
    }
  },
  "chunking": {
    "size": 350,
    "size_unit": "tokens",
    "max_size": 700,
    "max_size_is_hard_limit": false,
    "overlap_percent": 0,
    "overlap_unit": "tokens",
    "separators": ["<qa_pair_boundary>", "\n\n", "\n", "。", "！", "？"],
    "respect_heading_boundaries": true,
    "preserve_qa_pairs": true,
    "preserve_code_blocks": true,
    "preserve_table_headers": true,
    "preserve_image_caption_relation": true
  },
  "context": {
    "table_window_tokens": 128,
    "image_window_tokens": 96,
    "include_heading_path": true,
    "include_source_metadata": true
  },
  "retrieval": {
    "candidate_top_k": 30,
    "rerank_top_k": 8,
    "final_context_k": 5,
    "basis": "cold_start",
    "enable_reranking": true
  },
  "preprocessing": {
    "remove_headers_footers": true,
    "header_footer_removal_mode": "confirmed_only",
    "require_source_mapping": true
  },
  "validation": {
    "min_chunk_tokens": 20,
    "warn_above_tokens": 700,
    "qa_pair_integrity": true,
    "table_header_integrity": true,
    "source_mapping_required": true
  },
  "parameter_reasons": {
    "chunk_size": ["Reason tied to measured paragraph distribution and document type"],
    "overlap_percent": ["Reason tied to semantic boundary continuity"],
    "separators": ["Reason tied to detected structure"],
    "top_k": ["Cold-start until retrieval evaluation is available"]
  },
  "warnings": []
}
```

`<qa_pair_boundary>` is a symbolic placeholder for a parser-level
boundary, not a literal text separator. The backend must map it to the
actual element boundary representation.

## 8. Response behavior

When given metrics: 1. Summarize the document profile in 2--5 bullet
points. 2. List missing or unreliable metrics. 3. Recommend the primary
and element-level strategies. 4. Return the full JSON configuration. 5.
Explain each major parameter using the specific input metrics. 6. List
warnings and validation steps. 7. Clearly distinguish rules-based
decisions from AI inferences. 8. If asked for "optimal" parameters
without retrieval evaluation, say "recommended initial configuration,"
not "proven optimal configuration."

## 9. Example for mixed QA/code/table content

Given: - clear headings, - table token ratio = 0.20, - image density =
0.10, - P90 paragraph tokens = 260, - OCR page ratio = 0.10, - QA
document = true, - code dense = true, - confirmed template noise = true,

and QA/code detection confidence \>= 0.80, a reasonable initial
recommendation is: - primary strategy `qa`; - element handlers
`code_aware`, `table_aware`, and `caption_linked`; - chunk size 350
tokens; - overlap 0%; - table context 128 tokens; - image context 96
tokens; - candidate/rerank/final TopK = 30/8/5 as cold-start values; -
OCR pages checked for parsing quality; - remove only confirmed template
noise.

This is a starting recommendation. It must be validated with real chunk
previews and retrieval evaluation before being treated as optimal.
