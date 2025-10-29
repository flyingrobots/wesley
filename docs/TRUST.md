# TRUST & Certificates

Wesley emits evidence artifacts (bundle, scores, SHIPME) to build trust in generated plans. Certificates include hashes and metadata so deployments are auditable.

In CI, HOLMES/Watson consume the bundle to investigate/verify/predict. See `.github/workflows/wesley-holmes.yml` for the flow. Scores are non-blocking until artifacts are consistently present.

