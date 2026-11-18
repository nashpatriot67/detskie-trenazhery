'use strict';
// Preserve the original v5 -> current upgrade regression while sharing the
// expanded stage-1 suite. The original frozen P0 implementation is untouched.
process.env.STAGE1_BASELINE=process.env.P0_BASELINE||'/workspace/github-trainers';
process.env.STAGE1_REVIEW_DIR=process.env.P0_REVIEW_DIR||process.env.STAGE1_REVIEW_DIR||'/workspace/scratch/stage1-review';
process.env.STAGE1_REPORT_NAME='p0-pwa-report.json';
require('./stage1-pwa.cjs');
