# Clinical Study Extraction - Validation Questions

## Test Sample: Won2024.pdf
**Title**: Functional Outcomes in Conservatively vs Surgically Treated Cerebellar Infarcts  
**Journal**: JAMA Neurology  
**Study Type**: Retrospective multicenter cohort study  
**Pages**: 10 pages

---

## Category 1: PICO-T Extraction (AI-Powered)

### Question 1.1: Population
**What to extract**: Patient population characteristics
**Expected answer**: 
- Patients with cerebellar infarcts
- 531 total patients
- 301 (57%) male
- Mean age 68 (SD 14.4) years
- Treated at 5 medical centers (2018-2022)

**Validation criteria**:
- ✅ Correctly identifies patient type (cerebellar infarcts)
- ✅ Extracts sample size (531)
- ✅ Includes demographics (age, gender)
- ✅ Mentions study centers and timeframe

---

### Question 1.2: Intervention
**What to extract**: Surgical treatment details
**Expected answer**:
- Surgical treatment group
- Posterior fossa decompression
- Craniotomy with necrosectomy
- Ventriculostomy placement
- 127 patients received surgical treatment

**Validation criteria**:
- ✅ Identifies surgical procedures
- ✅ Lists specific intervention types
- ✅ Includes sample size for intervention group

---

### Question 1.3: Comparator
**What to extract**: Conservative management details
**Expected answer**:
- Conservative management (medical standard of care)
- Ventriculostomy for intracranial pressure management
- 404 patients received conservative treatment
- No surgical intervention

**Validation criteria**:
- ✅ Identifies control group treatment
- ✅ Describes conservative approach
- ✅ Includes sample size for control group

---

### Question 1.4: Outcomes
**What to extract**: Primary and secondary outcomes
**Expected answer**:
- Primary: Functional status (modified Rankin Scale - mRS)
- Favorable outcome: mRS 0-3
- Unfavorable outcome: mRS 4-6
- Measured at discharge and 1-year follow-up
- Secondary: Mortality rates, complications

**Validation criteria**:
- ✅ Identifies primary outcome measure (mRS)
- ✅ Defines favorable vs unfavorable outcomes
- ✅ Mentions timing of assessment
- ✅ Lists secondary outcomes

---

### Question 1.5: Timing
**What to extract**: Study duration and follow-up periods
**Expected answer**:
- Study period: 2018-2022
- Outcomes measured at discharge
- 1-year follow-up assessment
- Retrospective analysis

**Validation criteria**:
- ✅ Identifies study timeframe
- ✅ Lists follow-up periods
- ✅ Mentions study design timing

---

### Question 1.6: Study Type
**What to extract**: Study design classification
**Expected answer**:
- Retrospective multicenter cohort study
- 5 medical centers
- Observational design
- Comparative effectiveness study

**Validation criteria**:
- ✅ Correctly classifies study design
- ✅ Identifies multicenter nature
- ✅ Recognizes retrospective approach

---

## Category 2: Baseline Characteristics (AI-Powered)

### Question 2.1: Sample Sizes
**What to extract**: Patient numbers for each group
**Expected answer**:
- Total N: 531
- Surgical N: 127
- Conservative N: 404

**Validation criteria**:
- ✅ Correct total sample size
- ✅ Correct intervention group size
- ✅ Correct control group size
- ✅ Numbers add up correctly

---

### Question 2.2: Demographics
**What to extract**: Age and gender distribution
**Expected answer**:
- Age Mean: 68 years
- Age SD: 14.4 years
- Male N: 301 (57%)
- Female N: 230 (43%)

**Validation criteria**:
- ✅ Correct mean age
- ✅ Correct standard deviation
- ✅ Correct gender distribution
- ✅ Percentages calculated correctly

---

### Question 2.3: Clinical Scores
**What to extract**: Baseline clinical assessment scores
**Expected answer**:
- GCS (Glasgow Coma Scale) mean: 13.34
- NIHSS (if reported)
- Pre-stroke mRS (if reported)

**Validation criteria**:
- ✅ Identifies relevant clinical scores
- ✅ Extracts correct values
- ✅ Handles missing data appropriately

---

## Category 3: Vision-Based Table Extraction

### Question 3.1: Table 1 - Baseline Characteristics
**Location**: Page 4 (approximately)
**What to extract**: Complete baseline characteristics table
**Expected content**:
- Demographics (age, sex)
- Clinical presentation
- Imaging findings
- Comorbidities
- Comparison between surgical and conservative groups

**Validation criteria**:
- ✅ Correctly identifies table location
- ✅ Extracts all column headers
- ✅ Extracts all row labels
- ✅ Preserves numerical values accurately
- ✅ Maintains table structure (rows/columns)
- ✅ Includes statistical comparisons (p-values)
- ✅ Converts to markdown or structured format

**Test command**:
```bash
curl -X POST "http://localhost:8000/api/extract-tables-vision" \
  -F "file=@Won2024.pdf" \
  -F "pages=4" \
  -F "provider=gemini"
```

---

### Question 3.2: Table 2 - Outcomes
**Location**: Page 5-6 (approximately)
**What to extract**: Primary and secondary outcomes table
**Expected content**:
- mRS scores at discharge
- mRS scores at 1-year
- Mortality rates
- Complications
- Statistical comparisons

**Validation criteria**:
- ✅ Identifies outcome measures
- ✅ Extracts values for both groups
- ✅ Preserves statistical significance markers
- ✅ Maintains temporal relationships (discharge vs 1-year)

**Test command**:
```bash
curl -X POST "http://localhost:8000/api/extract-tables-vision" \
  -F "file=@Won2024.pdf" \
  -F "pages=5,6" \
  -F "provider=claude"
```

---

### Question 3.3: Table Structure Validation
**What to test**: Accuracy of table structure preservation
**Validation criteria**:
- ✅ Column alignment preserved
- ✅ Row groupings maintained
- ✅ Nested headers handled correctly
- ✅ Footnotes and annotations captured
- ✅ Units of measurement included
- ✅ Missing data indicated appropriately

---

## Category 4: Vision-Based Figure Extraction

### Question 4.1: Figure 1 - Study Flow Diagram
**Location**: Page 3 (approximately)
**What to extract**: Patient flow through study
**Expected content**:
- Initial patient screening
- Inclusion/exclusion criteria application
- Final patient numbers
- Reasons for exclusion

**Validation criteria**:
- ✅ Figure detected and extracted as image
- ✅ AI description captures flow structure
- ✅ Patient numbers identified
- ✅ Exclusion reasons listed
- ✅ Image saved with correct filename

**Test command**:
```bash
curl -X POST "http://localhost:8000/api/extract-figures-complete" \
  -F "file=@Won2024.pdf" \
  -F "pages=3" \
  -F "provider=gemini"
```

---

### Question 4.2: Figure 2 - Outcomes Visualization
**Location**: Page 5-6 (approximately)
**What to extract**: Stacked bar chart or similar visualization
**Expected content**:
- mRS distribution visualization
- Comparison between groups
- Color-coded outcomes
- Legend and labels

**Validation criteria**:
- ✅ Figure type identified (bar chart, etc.)
- ✅ Data categories recognized
- ✅ Comparative nature described
- ✅ Visual elements (colors, patterns) mentioned
- ✅ Quantitative data extracted from visual

**Test command**:
```bash
curl -X POST "http://localhost:8000/api/extract-figures-complete" \
  -F "file=@Won2024.pdf" \
  -F "pages=5,6" \
  -F "provider=claude"
```

---

### Question 4.3: Figure Caption Extraction
**What to test**: Accuracy of figure caption and title extraction
**Validation criteria**:
- ✅ Figure title extracted
- ✅ Caption text captured
- ✅ Figure number identified
- ✅ Statistical notes included

---

## Category 5: Enhanced Text Extraction

### Question 5.1: Methods Section Extraction
**What to extract**: Complete methods section text
**Validation criteria**:
- ✅ Section boundaries correctly identified
- ✅ Layout preserved (paragraphs, lists)
- ✅ No text truncation
- ✅ Special characters handled correctly
- ✅ References maintained

**Test command**:
```bash
curl -X POST "http://localhost:8000/api/extract-text-enhanced" \
  -F "file=@Won2024.pdf"
```

---

### Question 5.2: Results Section Extraction
**What to extract**: Results section with statistics
**Validation criteria**:
- ✅ Statistical values preserved accurately
- ✅ P-values formatted correctly
- ✅ Confidence intervals maintained
- ✅ Percentages and ratios correct

---

## Category 6: Section-Specific AI Extraction

### Question 6.1: Methods-Only Extraction
**What to test**: AI extracts only from Methods section
**Validation criteria**:
- ✅ No data from Abstract
- ✅ No data from Introduction
- ✅ No data from Discussion
- ✅ Only Methods and Results used

**Test approach**:
- Compare extraction with and without section filtering
- Verify no interpretive language from Discussion

---

### Question 6.2: Results-Only Extraction
**What to test**: AI extracts only from Results section
**Validation criteria**:
- ✅ Focuses on reported findings
- ✅ Excludes background information
- ✅ Excludes interpretations and conclusions

---

## Category 7: AI Provider Comparison

### Question 7.1: Gemini vs Claude - Table Extraction
**What to test**: Compare accuracy between providers
**Test approach**:
1. Extract same table with Gemini
2. Extract same table with Claude
3. Compare results

**Validation criteria**:
- ✅ Both providers detect table
- ✅ Numerical accuracy comparison
- ✅ Structure preservation comparison
- ✅ Speed comparison

---

### Question 7.2: Gemini vs Claude - Figure Description
**What to test**: Compare description quality
**Validation criteria**:
- ✅ Level of detail comparison
- ✅ Accuracy of visual element description
- ✅ Quantitative data extraction comparison

---

## Category 8: End-to-End Workflow

### Question 8.1: Complete Extraction Pipeline
**What to test**: Full workflow from PDF to structured data
**Steps**:
1. Load PDF
2. Extract enhanced text
3. Extract PICO-T with AI
4. Extract baseline data with AI
5. Extract tables with vision AI
6. Extract figures with vision AI
7. Export to JSON

**Validation criteria**:
- ✅ All steps complete without errors
- ✅ Data consistency across extractions
- ✅ Provenance tracking works
- ✅ Export includes all data
- ✅ Total time < 2 minutes

---

### Question 8.2: PDF Highlighting and Provenance
**What to test**: Source linking functionality
**Validation criteria**:
- ✅ Extracted data links to PDF page
- ✅ Highlighting works in UI
- ✅ Extraction log shows sources
- ✅ Page numbers accurate

---

## Category 9: Edge Cases and Error Handling

### Question 9.1: Missing Data Handling
**What to test**: How system handles incomplete information
**Scenarios**:
- Table with missing cells
- Figure without caption
- Incomplete baseline data

**Validation criteria**:
- ✅ Graceful handling of missing data
- ✅ Clear indication of unavailable information
- ✅ No crashes or errors

---

### Question 9.2: Complex Table Structures
**What to test**: Nested headers, merged cells
**Validation criteria**:
- ✅ Handles multi-level headers
- ✅ Preserves cell merging information
- ✅ Maintains relationships

---

## Category 10: Performance and Quality Metrics

### Question 10.1: Extraction Speed
**What to measure**:
- Text extraction time
- Table extraction time (per table)
- Figure extraction time (per figure)
- AI processing time
- Total pipeline time

**Target benchmarks**:
- Text extraction: < 10 seconds
- Table extraction: < 15 seconds per table
- Figure extraction: < 20 seconds per figure
- Total pipeline: < 2 minutes

---

### Question 10.2: Accuracy Metrics
**What to measure**:
- Numerical accuracy (% correct)
- Text accuracy (% correct)
- Structure preservation (% correct)
- Missing data rate

**Target benchmarks**:
- Numerical accuracy: > 95%
- Text accuracy: > 90%
- Structure preservation: > 85%
- Missing data rate: < 10%

---

## Testing Checklist

### Pre-Test Setup
- [ ] Backend server running
- [ ] Frontend server running
- [ ] API keys configured (Gemini & Anthropic)
- [ ] Won2024.pdf available in test_samples/
- [ ] Test environment clean

### Core Features
- [ ] PDF loading works
- [ ] Enhanced text extraction works
- [ ] PICO-T AI extraction works
- [ ] Baseline data AI extraction works
- [ ] Vision-based table extraction works (Gemini)
- [ ] Vision-based table extraction works (Claude)
- [ ] Figure extraction works (Gemini)
- [ ] Figure extraction works (Claude)
- [ ] AI provider toggle works
- [ ] Section-specific extraction works

### Data Quality
- [ ] Numerical values accurate
- [ ] Text formatting preserved
- [ ] Table structure maintained
- [ ] Figure descriptions detailed
- [ ] Provenance tracking works

### Export and Integration
- [ ] JSON export works
- [ ] CSV export works
- [ ] Audit report works
- [ ] PDF highlighting works
- [ ] All 8 form steps populate correctly

### Performance
- [ ] Text extraction < 10s
- [ ] Table extraction < 15s per table
- [ ] Figure extraction < 20s per figure
- [ ] Total pipeline < 2 minutes
- [ ] No memory leaks
- [ ] No crashes

---

## Expected Results Summary

### High Priority (Must Pass)
1. ✅ PICO-T extraction accuracy > 90%
2. ✅ Baseline data extraction accuracy > 90%
3. ✅ Table numerical accuracy > 95%
4. ✅ Figure detection rate 100%
5. ✅ No crashes or errors

### Medium Priority (Should Pass)
1. ✅ Table structure preservation > 85%
2. ✅ Figure descriptions detailed and accurate
3. ✅ Section-specific extraction working
4. ✅ Both AI providers functional
5. ✅ Performance within benchmarks

### Low Priority (Nice to Have)
1. ✅ Perfect table formatting
2. ✅ Complex nested structures handled
3. ✅ All edge cases covered
4. ✅ Sub-10-second total extraction

---

## Automated Testing Script

See `validation_test.py` for automated testing of all questions.

---

*This validation framework ensures comprehensive testing of all enhanced features in the clinical study extraction application.*
